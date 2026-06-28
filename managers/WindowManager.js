/**
 * WindowManager
 *
 * Purpose:
 *   The sole authority over all application windows in CID OS.
 *   Creates, tracks, focuses, minimizes, restores, and destroys windows.
 *
 * Responsibilities:
 *   - Maintain the z-index stack for all open windows
 *   - Track the currently active (focused) window
 *   - Cascade new window spawn positions to avoid perfect overlap
 *   - Mount windows into the DesktopManager window layer
 *   - Inject the window stylesheet once at startup
 *   - Emit EventBus events on state changes so TaskbarManager can update
 *
 * Rules:
 *   WindowManager never knows what application logic a window contains.
 *   ApplicationManager calls WindowManager; not the other way around.
 *   Windows must never manipulate themselves directly.
 *
 * Dependencies:
 *   Window        — the reusable Window class
 *   DesktopManager — to obtain the window layer mount point
 *   EventBus      — to emit window lifecycle events
 */

import Window        from '../ui/Window.js';
import DesktopManager from './DesktopManager.js';
import EventBus      from '../core/EventBus.js';

// Starting spawn position and cascade step for new windows.
const SPAWN_ORIGIN_X  = 120;
const SPAWN_ORIGIN_Y  = 80;
const SPAWN_CASCADE   = 30;

// Base z-index for windows. Incremented on every focus() call.
const BASE_Z_INDEX = 200;

class WindowManagerClass {

    constructor() {

        /**
         * All tracked Window instances, keyed by window id.
         * @type {Map<string, Window>}
         */
        this._windows = new Map();

        /**
         * Monotonically increasing z-index counter.
         * @type {number}
         */
        this._zIndexCounter = BASE_Z_INDEX;

        /**
         * The id of the currently focused (active) window.
         * @type {string|null}
         */
        this._activeId = null;

        /**
         * How many windows have been opened (drives cascade offset).
         * Resets to 0 when it would push windows off-screen.
         * @type {number}
         */
        this._spawnCount = 0;

        /**
         * Whether the window stylesheet has been injected.
         * @type {boolean}
         */
        this._styleInjected = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Prepare the WindowManager.
     * Injects the window stylesheet and registers global keyboard handler.
     * Called by Workstation during boot.
     *
     * @returns {void}
     */
    initialize() {

        this._injectStylesheet( './css/windows/window.css' );
        this._bindGlobalKeys();

        console.info( 'WindowManager: Initialized.' );

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Create and mount a new window.
     * Returns the Window instance for the caller to access the content area.
     *
     * @param {string} windowId    - Unique identifier (usually the app id).
     * @param {Object} config      - Window config: title, width, height, icon.
     * @returns {Window}
     */
    create( windowId, config ) {

        if ( this._windows.has( windowId ) ) {
            console.warn( `WindowManager: Window "${ windowId }" already exists. Focusing instead.` );
            this.focus( windowId );
            return this._windows.get( windowId );
        }

        const win = new Window(
            { id: windowId, ...config },
            {
                onFocus:    ( id ) => this.focus( id ),
                onClose:    ( id ) => this.close( id ),
                onMinimize: ( id ) => this.minimize( id ),
            }
        );

        // Set size from config.
        const width  = config.width  ?? 640;
        const height = config.height ?? 480;
        win.setSize( width, height );

        // Calculate cascade spawn position.
        const { x, y } = this._nextSpawnPosition( width, height );
        win.setPosition( x, y );

        // Mount into the window layer.
        const layer = DesktopManager.getWindowLayer();
        if ( layer ) {
            layer.style.pointerEvents = 'auto';
            layer.appendChild( win.element );
        }
        else {
            console.error( `WindowManager: Window layer not found. Cannot mount "${ windowId }".` );
            return win;
        }

        this._windows.set( windowId, win );

        // Focus the new window immediately.
        this.focus( windowId );

        EventBus.emit( 'window:created', { windowId, title: config.title } );
        console.info( `WindowManager: Window "${ windowId }" created.` );

        return win;

    }

    /**
     * Bring a window to front and mark it active.
     *
     * @param {string} windowId
     * @returns {void}
     */
    focus( windowId ) {

        const win = this._windows.get( windowId );
        if ( !win || win.isMinimized ) return;

        // Deactivate the previous active window.
        if ( this._activeId && this._activeId !== windowId ) {
            const prev = this._windows.get( this._activeId );
            if ( prev ) prev.deactivate();
        }

        // Bring this window to front.
        this._zIndexCounter++;
        win.setZIndex( this._zIndexCounter );
        win.activate();

        this._activeId = windowId;

        EventBus.emit( 'window:focused', { windowId } );

    }

    /**
     * Move a window to the given coordinates.
     *
     * @param {string} windowId
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    move( windowId, x, y ) {

        const win = this._windows.get( windowId );
        if ( !win ) return;

        win.setPosition( x, y );

    }

    /**
     * Resize a window.
     *
     * @param {string} windowId
     * @param {number} width
     * @param {number} height
     * @returns {void}
     */
    resize( windowId, width, height ) {

        const win = this._windows.get( windowId );
        if ( !win ) return;

        win.setSize( width, height );

    }

    /**
     * Minimize a window (hide, keep instance alive).
     *
     * @param {string} windowId
     * @returns {void}
     */
    minimize( windowId ) {

        const win = this._windows.get( windowId );
        if ( !win || win.isMinimized ) return;

        win.hide();
        win.deactivate();

        // Clear active tracking.
        if ( this._activeId === windowId ) {
            this._activeId = null;
            this._focusTopMostVisible();
        }

        EventBus.emit( 'window:minimized', { windowId } );
        console.info( `WindowManager: Window "${ windowId }" minimized.` );

    }

    /**
     * Restore a minimized window to the front.
     *
     * @param {string} windowId
     * @returns {void}
     */
    restore( windowId ) {

        const win = this._windows.get( windowId );
        if ( !win ) return;

        win.show();
        this.focus( windowId );

        EventBus.emit( 'window:restored', { windowId } );
        console.info( `WindowManager: Window "${ windowId }" restored.` );

    }

    /**
     * Close and destroy a window.
     * Removes DOM, clears references, prevents memory leaks.
     *
     * @param {string} windowId
     * @returns {void}
     */
    close( windowId ) {

        const win = this._windows.get( windowId );
        if ( !win ) return;

        win.destroy();
        this._windows.delete( windowId );

        // If this was the active window, focus the next visible one.
        if ( this._activeId === windowId ) {
            this._activeId = null;
            this._focusTopMostVisible();
        }

        EventBus.emit( 'window:closed', { windowId } );
        console.info( `WindowManager: Window "${ windowId }" closed.` );

    }

    /**
     * Check whether a window exists and is open.
     *
     * @param {string} windowId
     * @returns {boolean}
     */
    isOpen( windowId ) {
        return this._windows.has( windowId );
    }

    /**
     * Check whether a window exists and is minimized.
     *
     * @param {string} windowId
     * @returns {boolean}
     */
    isMinimized( windowId ) {
        const win = this._windows.get( windowId );
        return win ? win.isMinimized : false;
    }

    /**
     * Return the Window instance for an id.
     *
     * @param {string} windowId
     * @returns {Window|undefined}
     */
    getWindow( windowId ) {
        return this._windows.get( windowId );
    }

    /**
     * Return metadata for all open windows (for TaskbarManager in Mission 04).
     *
     * @returns {{ id: string, title: string, minimized: boolean }[]}
     */
    getOpenWindows() {

        return Array.from( this._windows.entries() ).map( ( [ id, win ] ) => ( {
            id,
            title:     win._config.title,
            minimized: win.isMinimized,
            active:    win.isActive,
        } ) );

    }

    // ─────────────────────────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────────────────────────

    /**
     * Calculate the spawn position for the next new window.
     * Cascades windows with SPAWN_CASCADE offset to avoid perfect overlap.
     * Resets the cascade when it would push windows too far off-screen.
     *
     * @param {number} width
     * @param {number} height
     * @returns {{ x: number, y: number }}
     */
    _nextSpawnPosition( width, height ) {

        const maxCascade = Math.floor(
            ( Math.min( window.innerWidth, window.innerHeight ) * 0.4 ) / SPAWN_CASCADE
        );

        const step = this._spawnCount % maxCascade;

        const x = SPAWN_ORIGIN_X + step * SPAWN_CASCADE;
        const y = SPAWN_ORIGIN_Y + step * SPAWN_CASCADE;

        this._spawnCount++;

        return { x, y };

    }

    /**
     * After the active window is closed or minimized, auto-focus the
     * top-most remaining visible window.
     *
     * @returns {void}
     */
    _focusTopMostVisible() {

        let topId    = null;
        let topZ     = -1;

        for ( const [ id, win ] of this._windows ) {

            if ( win.isMinimized ) continue;

            const z = parseInt( win.element.style.zIndex ?? '0', 10 );
            if ( z > topZ ) {
                topZ  = z;
                topId = id;
            }

        }

        if ( topId ) {
            this.focus( topId );
        }

    }

    /**
     * Bind Escape key to close the active focused window.
     *
     * @returns {void}
     */
    _bindGlobalKeys() {

        document.addEventListener( 'keydown', ( e ) => {

            if ( e.key !== 'Escape' ) return;
            if ( !this._activeId ) return;

            this.close( this._activeId );

        } );

    }

    /**
     * Inject a stylesheet into the document head (idempotent).
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

// Singleton — one shared window manager for the entire workstation.
const WindowManager = new WindowManagerClass();

export default WindowManager;
