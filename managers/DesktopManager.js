/**
 * DesktopManager
 *
 * Purpose:
 *   Creates and manages the CID OS desktop environment.
 *   Owns the desktop DOM structure and coordinates with sub-managers.
 *
 * Responsibilities:
 *   - Build the desktop DOM: wallpaper, icon area, window layer, taskbar
 *   - Apply and clear wallpaper
 *   - Control desktop visibility (boot → visible transition)
 *   - Delegate icon rendering to DesktopIconManager
 *   - Delegate context menu to ContextMenuManager
 *   - Expose layer references to other managers
 *
 * Rules:
 *   DesktopManager never launches applications directly.
 *   Window management belongs to WindowManager (Mission 03).
 *
 * Dependencies:
 *   EventBus           — desktop-level events
 *   DesktopIconManager — icon grid rendering and selection
 *   ContextMenuManager — right-click context menu
 */

import EventBus          from '../core/EventBus.js';
import DesktopIconManager from './DesktopIconManager.js';
import ContextMenuManager from './ContextMenuManager.js';

class DesktopManagerClass {

    constructor() {

        /** @type {HTMLElement|null} */
        this._root = null;

        /** @type {HTMLElement|null} Desktop root element */
        this._desktop = null;

        /** @type {HTMLElement|null} Wallpaper layer */
        this._wallpaperEl = null;

        /** @type {HTMLElement|null} Icon area — used by DesktopIconManager */
        this._iconArea = null;

        /** @type {HTMLElement|null} Window layer — used by WindowManager (Mission 03) */
        this._windowLayer = null;

        /** @type {HTMLElement|null} Taskbar element — used by TaskbarManager */
        this._taskbar = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Build and mount the desktop DOM into the workstation root.
     * Called by Workstation after BootScreen completes.
     *
     * @param {HTMLElement} root - The #workstation-root element.
     * @returns {void}
     */
    initialize( root ) {

        this._root = root;
        this._build();

        // Initialize context menu bound to the desktop element.
        ContextMenuManager.initialize( this._desktop );

        // React to wallpaper changes from SettingsManager.
        EventBus.on( 'wallpaper:changed', ( { path } ) => {
            if ( path ) {
                this.setWallpaper( path );
            }
            else {
                this.clearWallpaper();
            }
        } );

        console.info( 'DesktopManager: Desktop initialized.' );

    }

    /**
     * Trigger the desktop fade-in animation.
     * Called by Workstation after all managers are ready.
     *
     * @returns {void}
     */
    show() {

        if ( !this._desktop ) return;

        requestAnimationFrame( () => {
            this._desktop.classList.remove( 'cid-desktop--entering' );
            this._desktop.classList.add( 'cid-desktop--visible' );
        } );

        EventBus.emit( 'desktop:visible' );

    }

    /**
     * Render all desktop icons for the installed application list.
     * Delegates to DesktopIconManager.
     *
     * @param {Object[]} apps - Installed app configs from ApplicationManager.
     * @returns {void}
     */
    renderIcons( apps ) {

        DesktopIconManager.initialize( this._iconArea, apps );

    }

    // ─────────────────────────────────────────────────────────────
    // Wallpaper
    // ─────────────────────────────────────────────────────────────

    /**
     * Set the desktop wallpaper.
     * Accepts any valid CSS background value:
     *   - CSS gradient string: 'linear-gradient(...)'
     *   - Image URL string:    'url("assets/wallpapers/office.jpg")'
     *
     * @param {string} cssValue - Any valid CSS background value.
     * @returns {void}
     */
    setWallpaper( cssValue ) {

        if ( !this._wallpaperEl ) return;

        // Detect whether this is a plain file path (no CSS function) and wrap it.
        const isPlainPath = cssValue && !cssValue.includes( '(' );
        const value       = isPlainPath ? `url('${ cssValue }')` : cssValue;

        this._wallpaperEl.style.backgroundImage = value;

    }

    /**
     * Clear the desktop wallpaper.
     *
     * @returns {void}
     */
    clearWallpaper() {

        if ( !this._wallpaperEl ) return;
        this._wallpaperEl.style.backgroundImage = 'none';

    }

    // ─────────────────────────────────────────────────────────────
    // Layer Access
    // ─────────────────────────────────────────────────────────────

    /**
     * Return the taskbar element for TaskbarManager.
     * @returns {HTMLElement|null}
     */
    getTaskbar() {
        return this._taskbar;
    }

    /**
     * Return the window layer for WindowManager (Mission 03).
     * @returns {HTMLElement|null}
     */
    getWindowLayer() {
        return this._windowLayer;
    }

    /**
     * Return the icon area for DesktopIconManager.
     * @returns {HTMLElement|null}
     */
    getIconArea() {
        return this._iconArea;
    }

    /**
     * Return the desktop root element.
     * Used by ContextMenuManager and WindowManager.
     * @returns {HTMLElement|null}
     */
    getDesktopElement() {
        return this._desktop;
    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the full desktop DOM structure.
     *
     * @returns {void}
     */
    _build() {

        this._injectStylesheet( './css/desktop/desktop.css' );
        this._injectStylesheet( './css/taskbar/taskbar.css' );
        this._injectStylesheet( './css/icons/icons.css' );
        this._injectStylesheet( './css/context-menu/context-menu.css' );

        // Desktop root.
        this._desktop = document.createElement( 'div' );
        this._desktop.className = 'cid-desktop cid-desktop--entering';
        this._desktop.setAttribute( 'aria-label', 'CID OS Desktop' );
        this._desktop.setAttribute( 'role', 'main' );

        // Wallpaper layer.
        this._wallpaperEl = document.createElement( 'div' );
        this._wallpaperEl.className = 'cid-desktop__wallpaper';

        // Icon area.
        this._iconArea = document.createElement( 'div' );
        this._iconArea.className = 'cid-desktop__icon-area';
        this._iconArea.setAttribute( 'aria-label', 'Desktop icons' );

        // Window layer (populated in Mission 03).
        this._windowLayer = document.createElement( 'div' );
        this._windowLayer.className = 'cid-desktop__window-layer';

        // Taskbar.
        this._taskbar = document.createElement( 'div' );
        this._taskbar.className = 'cid-desktop__taskbar';
        this._taskbar.setAttribute( 'aria-label', 'Taskbar' );
        this._taskbar.setAttribute( 'role', 'navigation' );

        // Assemble.
        this._desktop.appendChild( this._wallpaperEl );
        this._desktop.appendChild( this._iconArea );
        this._desktop.appendChild( this._windowLayer );
        this._desktop.appendChild( this._taskbar );

        this._root.appendChild( this._desktop );

    }

    /**
     * Inject a stylesheet into document head (idempotent).
     *
     * @param {string} href
     * @returns {void}
     */
    _injectStylesheet( href ) {

        if ( document.querySelector( `link[href="${ href }"]` ) ) return;

        const link  = document.createElement( 'link' );
        link.rel    = 'stylesheet';
        link.href   = href;
        document.head.appendChild( link );

    }

}

// Singleton — one shared desktop manager for the entire workstation.
const DesktopManager = new DesktopManagerClass();

export default DesktopManager;
