/**
 * DesktopIconManager
 *
 * Purpose:
 *   Creates, positions, and manages all desktop icons.
 *   Handles icon selection, double-click to open, and grid reflow
 *   when the browser window resizes.
 *
 * Responsibilities:
 *   - Render one icon per installed application
 *   - Lay icons out on a grid aligned to desktop column/row spacing
 *   - Handle single-click selection (one at a time)
 *   - Handle double-click to request application launch
 *   - Reflow icon grid on resize
 *
 * Rules:
 *   DesktopIconManager never launches applications directly.
 *   It emits EventBus events; ApplicationManager handles launching.
 *   Never manage the taskbar or windows here.
 *
 * Dependencies:
 *   EventBus      — to emit launch requests
 *   DesktopManager — to receive the icon area container
 */

import EventBus from '../core/EventBus.js';
import { debounce } from '../utils/Utils.js';

// Grid spacing constants (match UI_GUIDELINES.md / desktop.json).
const ICON_COLUMN_WIDTH = 80;
const ICON_ROW_HEIGHT   = 88;
const GRID_MARGIN       = 16;

class DesktopIconManagerClass {

    constructor() {

        /**
         * The icon area container element (from DesktopManager).
         * @type {HTMLElement|null}
         */
        this._container = null;

        /**
         * All rendered icon elements, keyed by app id.
         * @type {Map<string, HTMLElement>}
         */
        this._icons = new Map();

        /**
         * The currently selected icon's app id.
         * @type {string|null}
         */
        this._selectedId = null;

        /**
         * Bound delegated click handler on the container.
         * Handles icon selection and blank-area deselection.
         * @type {Function|null}
         */
        this._clickHandler = null;

        /**
         * Bound delegated dblclick handler on the container.
         * Handles application launch on double-click.
         * @type {Function|null}
         */
        this._dblClickHandler = null;

        /**
         * Bound delegated keydown handler on the container.
         * Handles Enter/Space activation for keyboard users.
         * @type {Function|null}
         */
        this._keydownHandler = null;

        /**
         * Bound resize handler reference for cleanup.
         * @type {Function|null}
         */
        this._resizeHandler = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Initialize and render icons from the provided app list.
     *
     * @param {HTMLElement} container - The icon area element from DesktopManager.
     * @param {Object[]}    apps      - Installed app configs from ApplicationManager.
     * @returns {void}
     */
    initialize( container, apps ) {

        this._container = container;

        this._buildIcons( apps );
        this._positionAll();
        this._bindEvents();

        console.info( `DesktopIconManager: Rendered ${ apps.length } icon(s).` );

    }

    // ─────────────────────────────────────────────────────────────
    // Icon Rendering
    // ─────────────────────────────────────────────────────────────

    /**
     * Build icon DOM elements for all apps and append to container.
     *
     * @param {Object[]} apps - Installed app configs.
     * @returns {void}
     */
    _buildIcons( apps ) {

        apps.forEach( ( app ) => {

            const icon = this._createIconElement( app );
            this._icons.set( app.id, icon );
            this._container.appendChild( icon );

        } );

    }

    /**
     * Create a single icon element for an application.
     * No event listeners are attached here — all interaction is handled
     * via delegated listeners on the container in _bindEvents().
     *
     * @param {Object} app - App config object.
     * @returns {HTMLElement}
     */
    _createIconElement( app ) {

        const icon = document.createElement( 'div' );
        icon.className = 'desktop-icon';
        icon.dataset.appId = app.id;
        icon.setAttribute( 'tabindex', '0' );
        icon.setAttribute( 'role', 'button' );
        icon.setAttribute( 'aria-label', `Open ${ app.title }` );

        // Icon image area — PNG with automatic emoji fallback.
        const imageArea = this._buildIconImage( app );

        // Application name label.
        const label = document.createElement( 'div' );
        label.className   = 'desktop-icon__label';
        label.textContent = app.title;

        icon.appendChild( imageArea );
        icon.appendChild( label );

        return icon;

    }

    /**
     * Build the icon image area for an application.
     *
     * Rendering priority:
     *   1. PNG from "icon" field — resolved relative to assets/ folder.
     *   2. Emoji from "emoji" field if the PNG fails to load.
     *   3. Default folder emoji (📁) if neither field is defined.
     *
     * Icons live in the shared assets/ folder, not inside each app folder.
     * Example path: assets/icons/Case Management.png
     *
     * @param {Object} app - App config object.
     * @returns {HTMLElement} - The wrapper div.
     */
    _buildIconImage( app ) {

        const DEFAULT_EMOJI = '📁';
        const fallbackEmoji = app.emoji ?? DEFAULT_EMOJI;

        const wrapper = document.createElement( 'div' );
        wrapper.className = 'desktop-icon__image';
        wrapper.setAttribute( 'aria-hidden', 'true' );

        if ( app.icon ) {

            const img = document.createElement( 'img' );
            img.className = 'desktop-icon__image-png';
            img.alt       = '';
            img.src       = `assets/${ app.icon }`;

            img.addEventListener( 'error', () => {

                img.remove();
                wrapper.appendChild( this._buildEmojiSpan( fallbackEmoji ) );
                wrapper.classList.add( 'desktop-icon__image--emoji' );

            } );

            wrapper.appendChild( img );

        }
        else {

            wrapper.appendChild( this._buildEmojiSpan( fallbackEmoji ) );
            wrapper.classList.add( 'desktop-icon__image--emoji' );

        }

        return wrapper;

    }

    /**
     * Build the emoji fallback span element.
     *
     * @param {string} emoji - The emoji character(s) to display.
     * @returns {HTMLElement}
     */
    _buildEmojiSpan( emoji ) {

        const span = document.createElement( 'span' );
        span.className   = 'desktop-icon__image-emoji';
        span.textContent = emoji;
        return span;

    }

    // ─────────────────────────────────────────────────────────────
    // Grid Positioning
    // ─────────────────────────────────────────────────────────────

    /**
     * Position all icons on the grid.
     * Calculates column count from container width and lays out top-to-bottom.
     *
     * @returns {void}
     */
    _positionAll() {

        if ( !this._container ) return;

        const containerHeight = this._container.offsetHeight;
        const rowCount = Math.max( 1, Math.floor( ( containerHeight - GRID_MARGIN ) / ICON_ROW_HEIGHT ) );

        let col = 0;
        let row = 0;

        for ( const icon of this._icons.values() ) {

            const x = GRID_MARGIN + col * ICON_COLUMN_WIDTH;
            const y = GRID_MARGIN + row * ICON_ROW_HEIGHT;

            icon.style.left = `${ x }px`;
            icon.style.top  = `${ y }px`;

            row++;
            if ( row >= rowCount ) {
                row = 0;
                col++;
            }

        }

    }

    // ─────────────────────────────────────────────────────────────
    // Selection
    // ─────────────────────────────────────────────────────────────

    /**
     * Handle a single click on an icon — select it.
     *
     * @param {string} appId - The clicked application id.
     * @returns {void}
     */
    _handleIconSingleClick( appId ) {

        this._selectIcon( appId );

    }

    /**
     * Select a single icon and deselect all others.
     *
     * @param {string} appId
     * @returns {void}
     */
    _selectIcon( appId ) {

        // Deselect previous.
        if ( this._selectedId && this._selectedId !== appId ) {
            const prev = this._icons.get( this._selectedId );
            if ( prev ) {
                prev.classList.remove( 'desktop-icon--selected' );
                prev.setAttribute( 'aria-selected', 'false' );
            }
        }

        const icon = this._icons.get( appId );
        if ( !icon ) return;

        icon.classList.add( 'desktop-icon--selected' );
        icon.setAttribute( 'aria-selected', 'true' );
        this._selectedId = appId;

    }

    /**
     * Deselect all icons.
     *
     * @returns {void}
     */
    _deselectAll() {

        if ( this._selectedId ) {
            const icon = this._icons.get( this._selectedId );
            if ( icon ) {
                icon.classList.remove( 'desktop-icon--selected' );
                icon.setAttribute( 'aria-selected', 'false' );
            }
            this._selectedId = null;
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Launch
    // ─────────────────────────────────────────────────────────────

    /**
     * Request that an application is launched.
     * Mission 02: only logs. ApplicationManager handles in Mission 03+.
     *
     * @param {string} appId
     * @returns {void}
     */
    _requestLaunch( appId ) {

        console.info( `Opening: ${ appId }` );
        EventBus.emit( 'application:requested', { appId } );

    }

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    /**
     * Bind all container-level delegated event listeners.
     *
     * Three listeners, all on the container — never on individual icons:
     *
     *   click    → select the icon, or deselect all if blank area was clicked
     *   dblclick → launch the application (native browser event, always reliable)
     *   keydown  → Enter/Space on a focused icon launches the application
     *
     * Because listeners live on the container (which never changes), they
     * survive icon DOM re-renders, window open/close cycles, and anything
     * else that touches individual icon elements.
     *
     * @returns {void}
     */
    _bindEvents() {

        // ── Delegated single click — selection ────────────────────
        this._clickHandler = ( e ) => {

            const icon = e.target.closest( '.desktop-icon' );

            if ( !icon ) {
                // Clicked blank desktop area — deselect everything.
                this._deselectAll();
                return;
            }

            const appId = icon.dataset.appId;
            if ( appId ) this._handleIconSingleClick( appId );

        };

        this._container.addEventListener( 'click', this._clickHandler );

        // ── Delegated double-click — launch ───────────────────────
        this._dblClickHandler = ( e ) => {

            const icon = e.target.closest( '.desktop-icon' );
            if ( !icon ) return;

            const appId = icon.dataset.appId;
            if ( appId ) this._requestLaunch( appId );

        };

        this._container.addEventListener( 'dblclick', this._dblClickHandler );

        // ── Delegated keydown — keyboard activation ───────────────
        this._keydownHandler = ( e ) => {

            if ( e.key !== 'Enter' && e.key !== ' ' ) return;

            const icon = e.target.closest( '.desktop-icon' );
            if ( !icon ) return;

            const appId = icon.dataset.appId;
            if ( !appId ) return;

            e.preventDefault();
            this._requestLaunch( appId );

        };

        this._container.addEventListener( 'keydown', this._keydownHandler );

        // ── Resize — reflow icon grid ─────────────────────────────
        this._resizeHandler = debounce( () => this._positionAll(), 150 );
        window.addEventListener( 'resize', this._resizeHandler );

    }

    /**
     * Clean up all event listeners.
     *
     * @returns {void}
     */
    destroy() {

        if ( this._container ) {

            if ( this._clickHandler ) {
                this._container.removeEventListener( 'click', this._clickHandler );
            }

            if ( this._dblClickHandler ) {
                this._container.removeEventListener( 'dblclick', this._dblClickHandler );
            }

            if ( this._keydownHandler ) {
                this._container.removeEventListener( 'keydown', this._keydownHandler );
            }

        }

        if ( this._resizeHandler ) {
            window.removeEventListener( 'resize', this._resizeHandler );
        }

    }

}

// Singleton — one shared icon manager for the entire workstation.
const DesktopIconManager = new DesktopIconManagerClass();

export default DesktopIconManager;
