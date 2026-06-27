/**
 * WindowManager
 *
 * Purpose:
 *   Manages the creation, positioning, focus, and lifecycle
 *   of all application windows inside the workstation.
 *
 * Responsibilities:
 *   - Create window DOM elements
 *   - Track open windows and their z-index stacking order
 *   - Handle window focus changes
 *   - Respond to move, resize, minimize, restore, and close requests
 *   - Enforce window boundaries within the desktop
 *
 * Rules:
 *   Applications must never manipulate window DOM directly.
 *   Applications request actions; WindowManager executes them.
 *   WindowManager never contains gameplay logic.
 *
 * Dependencies:
 *   EventBus — to broadcast window state changes
 */

import EventBus from '../core/EventBus.js';

class WindowManagerClass {

    constructor() {

        /**
         * Map of all open windows keyed by application id.
         * @type {Map<string, Object>}
         */
        this._windows = new Map();

        /**
         * Z-index counter. Incremented each time a window is focused.
         * @type {number}
         */
        this._zIndexCounter = 100;

        /**
         * The id of the currently focused application.
         * @type {string|null}
         */
        this._focusedAppId = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Create and register a new window for an application.
     * Called by ApplicationManager when launching an app.
     *
     * @param {string} appId        - The application identifier.
     * @param {Object} windowConfig - Width, height, title, icon, etc.
     * @returns {HTMLElement}       - The window root element.
     */
    create( appId, windowConfig ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: create() called for "${ appId }".` );
    }

    /**
     * Bring a window to the front and give it focus.
     *
     * @param {string} appId - The application identifier.
     * @returns {void}
     */
    focus( appId ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: focus() called for "${ appId }".` );
    }

    /**
     * Move a window to the specified desktop coordinates.
     *
     * @param {string} appId - The application identifier.
     * @param {number} x     - Left position in pixels.
     * @param {number} y     - Top position in pixels.
     * @returns {void}
     */
    move( appId, x, y ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: move() called for "${ appId }".` );
    }

    /**
     * Resize a window to the specified dimensions.
     *
     * @param {string} appId   - The application identifier.
     * @param {number} width   - New width in pixels.
     * @param {number} height  - New height in pixels.
     * @returns {void}
     */
    resize( appId, width, height ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: resize() called for "${ appId }".` );
    }

    /**
     * Minimize a window (hide from desktop, keep in taskbar).
     *
     * @param {string} appId - The application identifier.
     * @returns {void}
     */
    minimize( appId ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: minimize() called for "${ appId }".` );
    }

    /**
     * Restore a minimized window to its previous size and position.
     *
     * @param {string} appId - The application identifier.
     * @returns {void}
     */
    restore( appId ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: restore() called for "${ appId }".` );
    }

    /**
     * Close a window and notify the application.
     *
     * @param {string} appId - The application identifier.
     * @returns {void}
     */
    close( appId ) {
        // Implementation added in Mission 03.
        console.info( `WindowManager: close() called for "${ appId }".` );
    }

    /**
     * Check whether a window is currently open.
     *
     * @param {string} appId - The application identifier.
     * @returns {boolean}
     */
    isOpen( appId ) {
        return this._windows.has( appId );
    }

    /**
     * Return the record for a specific window.
     *
     * @param {string} appId - The application identifier.
     * @returns {Object|undefined}
     */
    getWindow( appId ) {
        return this._windows.get( appId );
    }

}

// Singleton — one shared window manager for the entire workstation.
const WindowManager = new WindowManagerClass();

export default WindowManager;
