/**
 * DesktopManager
 *
 * Purpose:
 *   Manages the desktop environment: icons, wallpaper,
 *   and desktop-level user interaction.
 *
 * Responsibilities:
 *   - Render desktop icons from installed application list
 *   - Manage icon grid layout and positions
 *   - Handle desktop click events (open apps, context menu)
 *   - Apply and change wallpaper
 *
 * Rules:
 *   DesktopManager never launches applications directly.
 *   It emits requests; ApplicationManager handles them.
 *   Never contain window or taskbar logic here.
 *
 * Dependencies:
 *   EventBus           — to request application launches
 *   ApplicationManager — to query the installed app list
 *   StorageManager     — to persist icon positions
 */

import EventBus from '../core/EventBus.js';

class DesktopManagerClass {

    constructor() {

        /**
         * The root desktop container element.
         * @type {HTMLElement|null}
         */
        this._container = null;

        /**
         * Double-click detection delay in milliseconds.
         * @type {number}
         */
        this._DOUBLE_CLICK_DELAY = 300;

    }

    /**
     * Initialize the desktop inside the given container element.
     * Called once by Workstation during startup.
     *
     * @param {HTMLElement} container - The desktop root element.
     * @returns {void}
     */
    initialize( container ) {
        // Implementation added in Mission 02.
        this._container = container;
        console.info( 'DesktopManager: Initialized.' );
    }

    /**
     * Render desktop icons for all installed applications.
     *
     * @param {Object[]} apps - Array of app config objects.
     * @returns {void}
     */
    renderIcons( apps ) {
        // Implementation added in Mission 02.
        console.info( `DesktopManager: renderIcons() called with ${ apps.length } app(s).` );
    }

    /**
     * Set the desktop wallpaper.
     *
     * @param {string} imagePath - Path to the wallpaper image.
     * @returns {void}
     */
    setWallpaper( imagePath ) {
        // Implementation added in Mission 02.
        console.info( `DesktopManager: setWallpaper() called with "${ imagePath }".` );
    }

}

// Singleton — one shared desktop manager for the entire workstation.
const DesktopManager = new DesktopManagerClass();

export default DesktopManager;
