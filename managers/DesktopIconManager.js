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

// Double-click detection window in milliseconds.
const DOUBLE_CLICK_DELAY = 300;

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
         * Tracks last click time per icon for double-click detection.
         * @type {Map<string, number>}
         */
        this._lastClick = new Map();

        /**
         * Bound resize handler reference for cleanup.
         * @type {Function|null}
         */
        this._resizeHandler = null;

        /**
         * Bound deselect handler for clicks on the icon area itself.
         * @type {Function|null}
         */
        this._deselectHandler = null;

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

        // Pixel icon image area.
        const img = document.createElement( 'div' );
        img.className = 'desktop-icon__image';
        img.setAttribute( 'aria-hidden', 'true' );

        // Application name label.
        const label = document.createElement( 'div' );
        label.className   = 'desktop-icon__label';
        label.textContent = app.title;

        icon.appendChild( img );
        icon.appendChild( label );

        // Click: select + double-click detection.
        icon.addEventListener( 'click', ( e ) => {
            e.stopPropagation();
            this._handleIconClick( app.id );
        } );

        // Keyboard: Enter or Space activates.
        icon.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Enter' || e.key === ' ' ) {
                e.preventDefault();
                this._requestLaunch( app.id );
            }
        } );

        return icon;

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
     * Handle a click on an icon — select it and detect double-click.
     *
     * @param {string} appId - The clicked application id.
     * @returns {void}
     */
    _handleIconClick( appId ) {

        const now      = Date.now();
        const lastTime = this._lastClick.get( appId ) ?? 0;

        this._lastClick.set( appId, now );

        if ( now - lastTime < DOUBLE_CLICK_DELAY ) {
            // Double-click detected.
            this._requestLaunch( appId );
            return;
        }

        // Single click — select.
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
     * Bind resize and deselect handlers.
     *
     * @returns {void}
     */
    _bindEvents() {

        // Deselect when clicking blank desktop area.
        this._deselectHandler = () => this._deselectAll();
        this._container.addEventListener( 'click', this._deselectHandler );

        // Reflow grid on resize.
        this._resizeHandler = debounce( () => this._positionAll(), 150 );
        window.addEventListener( 'resize', this._resizeHandler );

    }

    /**
     * Clean up all event listeners.
     *
     * @returns {void}
     */
    destroy() {

        if ( this._resizeHandler ) {
            window.removeEventListener( 'resize', this._resizeHandler );
        }

        if ( this._deselectHandler && this._container ) {
            this._container.removeEventListener( 'click', this._deselectHandler );
        }

    }

}

// Singleton — one shared icon manager for the entire workstation.
const DesktopIconManager = new DesktopIconManagerClass();

export default DesktopIconManager;
