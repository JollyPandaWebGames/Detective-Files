/**
 * DesktopManager
 *
 * Purpose:
 *   Creates and manages the CID OS desktop environment.
 *   Owns the desktop DOM, wallpaper layer, icon area,
 *   window layer, and taskbar placeholder.
 *
 * Responsibilities:
 *   - Build the desktop DOM structure
 *   - Apply wallpaper from configuration
 *   - Expose layer references for other managers (Mission 02+)
 *   - Manage desktop visibility state
 *
 * Rules:
 *   DesktopManager never launches applications directly.
 *   Icon rendering is added in Mission 02.
 *   Taskbar content is added in Mission 02.
 *   Window management is WindowManager's responsibility.
 *
 * Dependencies:
 *   EventBus — to emit desktop-level events
 */

import EventBus from '../core/EventBus.js';

class DesktopManagerClass {

    constructor() {

        /**
         * The workstation root element the desktop mounts into.
         * @type {HTMLElement|null}
         */
        this._root = null;

        /**
         * The desktop root element.
         * @type {HTMLElement|null}
         */
        this._desktop = null;

        /**
         * The wallpaper layer element.
         * @type {HTMLElement|null}
         */
        this._wallpaperEl = null;

        /**
         * The desktop icon area element.
         * Exposed for DesktopIconManager in Mission 02.
         * @type {HTMLElement|null}
         */
        this._iconArea = null;

        /**
         * The window layer element.
         * Exposed for WindowManager in Mission 03.
         * @type {HTMLElement|null}
         */
        this._windowLayer = null;

        /**
         * The taskbar placeholder element.
         * Populated by TaskbarManager in Mission 02.
         * @type {HTMLElement|null}
         */
        this._taskbar = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the desktop DOM and mount it inside the workstation root.
     * Called by Workstation after BootScreen finishes.
     *
     * @param {HTMLElement} root - The #workstation-root element.
     * @returns {void}
     */
    initialize( root ) {

        this._root = root;
        this._build();

        console.info( 'DesktopManager: Desktop initialized.' );

    }

    /**
     * Make the desktop visible.
     * Called by Workstation after the boot screen has faded out.
     *
     * @returns {void}
     */
    show() {

        if ( !this._desktop ) return;

        // Remove entering class, add visible class to trigger the fade-in.
        requestAnimationFrame( () => {
            this._desktop.classList.remove( 'cid-desktop--entering' );
            this._desktop.classList.add( 'cid-desktop--visible' );
        } );

        EventBus.emit( 'desktop:visible' );

    }

    // ─────────────────────────────────────────────────────────────
    // Wallpaper
    // ─────────────────────────────────────────────────────────────

    /**
     * Set the desktop wallpaper image.
     *
     * @param {string} imagePath - Path to the wallpaper image file.
     * @returns {void}
     */
    setWallpaper( imagePath ) {

        if ( !this._wallpaperEl ) return;

        this._wallpaperEl.style.backgroundImage = `url('${ imagePath }')`;

        console.info( `DesktopManager: Wallpaper set to "${ imagePath }".` );

    }

    /**
     * Clear the wallpaper (shows solid background color).
     *
     * @returns {void}
     */
    clearWallpaper() {

        if ( !this._wallpaperEl ) return;

        this._wallpaperEl.style.backgroundImage = 'none';

    }

    // ─────────────────────────────────────────────────────────────
    // Icon Rendering (stub — implementation in Mission 02)
    // ─────────────────────────────────────────────────────────────

    /**
     * Render desktop icons for all installed applications.
     * Implementation added in Mission 02.
     *
     * @param {Object[]} apps - Array of app config objects.
     * @returns {void}
     */
    renderIcons( apps ) {
        // Mission 02.
        console.info( `DesktopManager: renderIcons() deferred to Mission 02 (${ apps.length } apps queued).` );
    }

    // ─────────────────────────────────────────────────────────────
    // Layer Access (used by other managers)
    // ─────────────────────────────────────────────────────────────

    /**
     * Return the icon area element.
     * Used by DesktopIconManager (Mission 02).
     *
     * @returns {HTMLElement|null}
     */
    getIconArea() {
        return this._iconArea;
    }

    /**
     * Return the window layer element.
     * Used by WindowManager (Mission 03).
     *
     * @returns {HTMLElement|null}
     */
    getWindowLayer() {
        return this._windowLayer;
    }

    /**
     * Return the taskbar element.
     * Used by TaskbarManager (Mission 02).
     *
     * @returns {HTMLElement|null}
     */
    getTaskbar() {
        return this._taskbar;
    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the full desktop DOM structure and append to root.
     *
     * @returns {void}
     */
    _build() {

        // Inject the desktop stylesheet.
        this._injectStylesheet( './css/desktop/desktop.css' );

        // ── Desktop root ─────────────────────────────────────────
        this._desktop = document.createElement( 'div' );
        this._desktop.className = 'cid-desktop cid-desktop--entering';
        this._desktop.setAttribute( 'aria-label', 'CID OS Desktop' );
        this._desktop.setAttribute( 'role', 'main' );

        // ── Wallpaper layer ──────────────────────────────────────
        this._wallpaperEl = document.createElement( 'div' );
        this._wallpaperEl.className = 'cid-desktop__wallpaper';

        // ── Icon area ────────────────────────────────────────────
        this._iconArea = document.createElement( 'div' );
        this._iconArea.className = 'cid-desktop__icon-area';
        this._iconArea.setAttribute( 'aria-label', 'Desktop icons' );

        // ── Window layer ─────────────────────────────────────────
        this._windowLayer = document.createElement( 'div' );
        this._windowLayer.className = 'cid-desktop__window-layer';

        // ── Taskbar placeholder ──────────────────────────────────
        this._taskbar = document.createElement( 'div' );
        this._taskbar.className = 'cid-desktop__taskbar';
        this._taskbar.setAttribute( 'aria-label', 'Taskbar' );
        this._taskbar.setAttribute( 'role', 'navigation' );

        // ── Assemble ─────────────────────────────────────────────
        this._desktop.appendChild( this._wallpaperEl );
        this._desktop.appendChild( this._iconArea );
        this._desktop.appendChild( this._windowLayer );
        this._desktop.appendChild( this._taskbar );

        this._root.appendChild( this._desktop );

    }

    /**
     * Inject a stylesheet link into the document head if not already present.
     *
     * @param {string} href - Path to the stylesheet.
     * @returns {void}
     */
    _injectStylesheet( href ) {

        const existing = document.querySelector( `link[href="${ href }"]` );
        if ( existing ) return;

        const link  = document.createElement( 'link' );
        link.rel    = 'stylesheet';
        link.href   = href;
        document.head.appendChild( link );

    }

}

// Singleton — one shared desktop manager for the entire workstation.
const DesktopManager = new DesktopManagerClass();

export default DesktopManager;
