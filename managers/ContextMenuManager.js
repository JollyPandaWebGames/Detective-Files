/**
 * ContextMenuManager
 *
 * Purpose:
 *   Creates and manages the right-click context menu on the desktop.
 *
 * Responsibilities:
 *   - Show a pixel-art context menu at the cursor position
 *   - Close on outside click or Escape
 *   - Keep the menu within viewport bounds
 *   - Log menu actions to console (placeholder implementations)
 *
 * Rules:
 *   Context menu actions are placeholders in Mission 02.
 *   Never manage windows, icons, or taskbar here.
 *
 * Dependencies:
 *   EventBus — to emit context menu actions for future use
 */

import EventBus from '../core/EventBus.js';

// Menu item definitions — id used for EventBus events, label shown to user.
const DESKTOP_MENU_ITEMS = [
    { id: 'refresh',    label: 'Refresh' },
    { id: 'sort-icons', label: 'Sort Icons' },
    { id: 'settings',   label: 'Settings' },
    { id: 'properties', label: 'Properties' },
];

class ContextMenuManagerClass {

    constructor() {

        /**
         * The context menu DOM element.
         * @type {HTMLElement|null}
         */
        this._menu = null;

        /**
         * Whether the menu is currently visible.
         * @type {boolean}
         */
        this._visible = false;

        /**
         * Bound document event handlers for cleanup.
         * @type {Function|null}
         */
        this._closeHandler  = null;
        this._keydownHandler = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Initialize the context menu and bind it to the desktop container.
     *
     * @param {HTMLElement} desktopEl - The desktop root element.
     * @returns {void}
     */
    initialize( desktopEl ) {

        this._build();
        this._bindDesktopEvents( desktopEl );
        this._bindGlobalEvents();

        console.info( 'ContextMenuManager: Initialized.' );

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the context menu element and append to document body.
     * Body-level placement prevents z-index stacking issues.
     *
     * @returns {void}
     */
    _build() {

        this._menu = document.createElement( 'div' );
        this._menu.className = 'context-menu';
        this._menu.setAttribute( 'role', 'menu' );
        this._menu.setAttribute( 'aria-label', 'Desktop context menu' );
        this._menu.setAttribute( 'hidden', '' );

        DESKTOP_MENU_ITEMS.forEach( ( item ) => {

            const btn = document.createElement( 'button' );
            btn.className   = 'context-menu__item';
            btn.textContent = item.label;
            btn.setAttribute( 'role', 'menuitem' );
            btn.setAttribute( 'tabindex', '-1' );

            btn.addEventListener( 'click', ( e ) => {
                e.stopPropagation();
                this._handleAction( item.id, item.label );
            } );

            this._menu.appendChild( btn );

        } );

        document.body.appendChild( this._menu );

    }

    // ─────────────────────────────────────────────────────────────
    // Visibility
    // ─────────────────────────────────────────────────────────────

    /**
     * Show the context menu at the specified viewport coordinates.
     *
     * @param {number} x - Cursor X position.
     * @param {number} y - Cursor Y position.
     * @returns {void}
     */
    _show( x, y ) {

        if ( !this._menu ) return;

        // Reveal briefly so we can measure its dimensions.
        this._menu.removeAttribute( 'hidden' );
        this._menu.classList.add( 'context-menu--visible' );

        // Keep within viewport bounds.
        const menuW = this._menu.offsetWidth;
        const menuH = this._menu.offsetHeight;
        const maxX  = window.innerWidth  - menuW - 4;
        const maxY  = window.innerHeight - menuH - 4;

        this._menu.style.left = `${ Math.min( x, maxX ) }px`;
        this._menu.style.top  = `${ Math.min( y, maxY ) }px`;

        this._visible = true;

        // Focus the first item for keyboard navigation.
        const firstItem = this._menu.querySelector( '.context-menu__item' );
        if ( firstItem ) {
            firstItem.setAttribute( 'tabindex', '0' );
            firstItem.focus();
        }

    }

    /**
     * Hide the context menu.
     *
     * @returns {void}
     */
    _hide() {

        if ( !this._menu ) return;

        this._menu.setAttribute( 'hidden', '' );
        this._menu.classList.remove( 'context-menu--visible' );
        this._visible = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Handle a context menu item selection.
     * All actions are placeholder console logs in Mission 02.
     *
     * @param {string} id    - The action identifier.
     * @param {string} label - The human-readable label.
     * @returns {void}
     */
    _handleAction( id, label ) {

        console.info( `Context menu: ${ label }` );
        EventBus.emit( `desktop:${ id }` );
        this._hide();

    }

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    /**
     * Bind right-click context menu to the desktop element.
     *
     * @param {HTMLElement} desktopEl
     * @returns {void}
     */
    _bindDesktopEvents( desktopEl ) {

        desktopEl.addEventListener( 'contextmenu', ( e ) => {
            e.preventDefault();
            this._show( e.clientX, e.clientY );
        } );

    }

    /**
     * Bind document-level close handlers.
     *
     * @returns {void}
     */
    _bindGlobalEvents() {

        this._closeHandler = ( e ) => {
            if ( this._visible && !this._menu.contains( e.target ) ) {
                this._hide();
            }
        };

        this._keydownHandler = ( e ) => {
            if ( e.key === 'Escape' && this._visible ) {
                this._hide();
            }
        };

        document.addEventListener( 'click', this._closeHandler );
        document.addEventListener( 'keydown', this._keydownHandler );

    }

    /**
     * Clean up all event listeners and remove the menu from DOM.
     *
     * @returns {void}
     */
    destroy() {

        if ( this._closeHandler ) {
            document.removeEventListener( 'click', this._closeHandler );
        }

        if ( this._keydownHandler ) {
            document.removeEventListener( 'keydown', this._keydownHandler );
        }

        if ( this._menu && this._menu.parentNode ) {
            this._menu.parentNode.removeChild( this._menu );
        }

    }

}

// Singleton — one shared context menu manager for the entire workstation.
const ContextMenuManager = new ContextMenuManagerClass();

export default ContextMenuManager;
