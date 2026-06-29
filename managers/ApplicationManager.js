/**
 * ApplicationManager
 *
 * Purpose:
 *   The sole authority for launching and managing application lifecycle.
 *   Bridges AppLoader → BaseApp → WindowManager.
 *
 * Responsibilities:
 *   - Discover and preload all applications via AppLoader at boot
 *   - Launch applications on request (open window + call lifecycle)
 *   - Enforce singleton: focus existing window instead of opening twice
 *   - Track running state per app
 *   - Handle close events from WindowManager and update state
 *   - Emit EventBus events on all lifecycle changes
 *
 * Application launch flow:
 *   launch(appId)
 *     → if singleton + already running → WindowManager.focus()
 *     → else → WindowManager.create() → get contentEl
 *             → app.create(contentEl)
 *             → app.open()
 *             → emit app:opened
 *
 * Close flow (triggered by window X button or WindowManager):
 *   _onWindowClosed(windowId)
 *     → app.close()
 *     → app.destroy()
 *     → remove from _running
 *     → emit app:closed
 *
 * Rules:
 *   Only ApplicationManager calls app lifecycle methods.
 *   Only ApplicationManager calls WindowManager.create() for real apps.
 *   Applications never call WindowManager directly.
 *
 * Dependencies:
 *   AppLoader     — discovers and instantiates app classes
 *   WindowManager — creates and manages windows
 *   EventBus      — lifecycle events
 */

import AppLoader     from '../core/AppLoader.js';
import WindowManager from './WindowManager.js';
import EventBus      from '../core/EventBus.js';

class ApplicationManagerClass {

    constructor() {

        /**
         * Loaded application instances, keyed by app id.
         * An entry exists here if the JS module loaded successfully.
         * @type {Map<string, import('../core/BaseApp.js').default>}
         */
        this._apps = new Map();

        /**
         * All registry configs from apps.json, keyed by app id.
         * Always populated — even when the JS module failed to load.
         * Used by TaskbarManager and DesktopIconManager for metadata.
         * @type {Map<string, Object>}
         */
        this._registry = new Map();

        /**
         * App ids that currently have an open window.
         * @type {Set<string>}
         */
        this._running = new Set();

        /**
         * Bound handler for window:closed events from WindowManager.
         * @type {Function}
         */
        this._onWindowClosed = this._handleWindowClosed.bind( this );

        /**
         * Bound handler for window:minimized events.
         * @type {Function}
         */
        this._onWindowMinimized = this._handleWindowMinimized.bind( this );

        /**
         * Bound handler for window:restored events.
         * @type {Function}
         */
        this._onWindowRestored = this._handleWindowRestored.bind( this );

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Discover all installed applications and preload their modules.
     * Called once by Workstation during boot.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        const registryConfigs = await AppLoader.loadRegistry();
        console.info( `ApplicationManager: Discovered ${ registryConfigs.length } application(s).` );

        for ( const registryConfig of registryConfigs ) {

            const appId = registryConfig.id;

            // Always store registry config — UI needs it even if JS module fails.
            this._registry.set( appId, registryConfig );

            const app = await AppLoader.load( registryConfig );

            if ( !app ) {
                console.warn( `ApplicationManager: Module unavailable for "${ appId }" — metadata only.` );
                continue;
            }

            this._apps.set( appId, app );

        }

        // Subscribe to WindowManager events so we can keep app state in sync
        // when windows are closed/minimized via their UI controls.
        EventBus.on( 'window:closed',    this._onWindowClosed    );
        EventBus.on( 'window:minimized', this._onWindowMinimized );
        EventBus.on( 'window:restored',  this._onWindowRestored  );

        EventBus.emit( 'applications:ready', { count: this._registry.size } );
        console.info( `ApplicationManager: Ready. ${ this._apps.size } module(s) loaded.` );

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Launch an application.
     *
     * Singleton apps: if already running, focus the existing window.
     * Closed apps: create window → inject content → call create() + open().
     *
     * @param {string} appId
     * @returns {void}
     */
    launch( appId ) {

        const config = this._registry.get( appId );

        if ( !config ) {
            console.error( `ApplicationManager: Unknown application "${ appId }".` );
            return;
        }

        // ── Singleton already running → focus ─────────────────────
        if ( config.singleton && this._running.has( appId ) ) {

            if ( WindowManager.isMinimized( appId ) ) {
                WindowManager.restore( appId );
            }
            else {
                WindowManager.focus( appId );
            }

            return;

        }

        // ── No JS module available → show error window ────────────
        const app = this._apps.get( appId );

        if ( !app ) {
            this._openErrorWindow( appId, config );
            return;
        }

        // ── Launch ────────────────────────────────────────────────
        const win = WindowManager.create( appId, {
            title:  config.title,
            emoji:  config.emoji,
            icon:   config.icon,
            width:  config.width  ?? 640,
            height: config.height ?? 480,
        } );

        if ( !win ) {
            console.error( `ApplicationManager: WindowManager failed to create window for "${ appId }".` );
            return;
        }

        // Wire the app to its window.
        app._window    = win;
        app._contentEl = win.contentEl;

        // Lifecycle: create → open.
        // Clear placeholder content before handing off contentEl.
        if ( win.contentEl ) {
            win.contentEl.innerHTML = '';
        }

        app.create( win.contentEl );
        app.isCreated = true;

        app.open();
        app.isOpen = true;

        this._running.add( appId );

        EventBus.emit( 'app:opened', { appId, title: config.title, emoji: config.emoji } );
        console.info( `ApplicationManager: "${ appId }" launched.` );

    }

    /**
     * Programmatically close a running application.
     * Also called internally when the window X button is pressed.
     *
     * @param {string} appId
     * @returns {void}
     */
    close( appId ) {

        if ( !this._running.has( appId ) ) return;

        const app = this._apps.get( appId );

        if ( app ) {
            app.close();
            app.isOpen     = false;
            app.isMinimized = false;
            app.isCreated  = false;
            app._window    = null;
            app._contentEl = null;
            app.destroy();
        }

        // WindowManager.close() destroys the DOM.
        // Guard: window may already be destroyed if close came from WindowManager.
        if ( WindowManager.isOpen( appId ) ) {
            WindowManager.close( appId );
        }

        this._running.delete( appId );

        EventBus.emit( 'app:closed', { appId } );

    }

    /**
     * Return metadata for all installed applications.
     * Used by TaskbarManager and DesktopIconManager.
     *
     * @returns {Object[]}
     */
    getInstalledApps() {
        return Array.from( this._registry.values() );
    }

    /**
     * Return ids of all currently running applications.
     *
     * @returns {string[]}
     */
    getRunningAppIds() {
        return Array.from( this._running );
    }

    /**
     * Check whether an application is currently running.
     *
     * @param {string} appId
     * @returns {boolean}
     */
    isRunning( appId ) {
        return this._running.has( appId );
    }

    // ─────────────────────────────────────────────────────────────
    // EventBus Handlers
    // ─────────────────────────────────────────────────────────────

    /**
     * Called when WindowManager emits 'window:closed'.
     * This happens when the user clicks the window's X button.
     * We must clean up the app state to match.
     *
     * @param {{ windowId: string }} payload
     * @returns {void}
     */
    _handleWindowClosed( { windowId } ) {

        if ( !this._running.has( windowId ) ) return;

        const app = this._apps.get( windowId );

        if ( app ) {
            app.close();
            app.isOpen     = false;
            app.isMinimized = false;
            app.isCreated  = false;
            app._window    = null;
            app._contentEl = null;
            app.destroy();
        }

        this._running.delete( windowId );

        EventBus.emit( 'app:closed', { appId: windowId } );

    }

    /**
     * Called when WindowManager emits 'window:minimized'.
     *
     * @param {{ windowId: string }} payload
     * @returns {void}
     */
    _handleWindowMinimized( { windowId } ) {

        const app = this._apps.get( windowId );
        if ( !app || !this._running.has( windowId ) ) return;

        app.minimize();
        app.isMinimized = true;

        EventBus.emit( 'app:minimized', { appId: windowId } );

    }

    /**
     * Called when WindowManager emits 'window:restored'.
     *
     * @param {{ windowId: string }} payload
     * @returns {void}
     */
    _handleWindowRestored( { windowId } ) {

        const app = this._apps.get( windowId );
        if ( !app ) return;

        app.restore();
        app.isMinimized = false;
        app.isOpen      = true;

        EventBus.emit( 'app:restored', { appId: windowId } );

    }

    // ─────────────────────────────────────────────────────────────
    // Error Handling
    // ─────────────────────────────────────────────────────────────

    /**
     * Open a generic error window when an application module could not load.
     * Does not crash CID OS.
     *
     * @param {string} appId
     * @param {Object} config
     * @returns {void}
     */
    _openErrorWindow( appId, config ) {

        const errorId = `error-${ appId }`;

        if ( WindowManager.isOpen( errorId ) ) {
            WindowManager.focus( errorId );
            return;
        }

        const win = WindowManager.create( errorId, {
            title: `Error — ${ config.title ?? appId }`,
            emoji: '⚠️',
            width: 400,
            height: 240,
        } );

        if ( win && win.contentEl ) {
            win.contentEl.innerHTML = `
                <div class="baseapp-placeholder">
                    <div class="baseapp-placeholder__emoji">⚠️</div>
                    <div class="baseapp-placeholder__title">${ config.title ?? appId }</div>
                    <div class="baseapp-placeholder__sub">
                        This application could not be loaded.<br>
                        The module may be missing or contain errors.
                    </div>
                </div>
            `;
        }

        console.error( `ApplicationManager: Could not launch "${ appId }" — module unavailable.` );

    }

}

// Singleton — one shared application manager for the entire workstation.
const ApplicationManager = new ApplicationManagerClass();

export default ApplicationManager;
