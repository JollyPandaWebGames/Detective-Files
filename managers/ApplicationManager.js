/**
 * ApplicationManager
 *
 * Purpose:
 *   Manages the complete lifecycle of all installed workstation applications.
 *   Acts as the intermediary between the workstation shell and application plugins.
 *
 * Responsibilities:
 *   - Load applications via AppLoader
 *   - Track all installed and running applications
 *   - Launch, focus, minimize, restore, and terminate applications
 *   - Enforce singleton rules (only one instance per app when configured)
 *   - Notify EventBus of application state changes
 *
 * Rules:
 *   ApplicationManager never knows what an application does.
 *   It only manages their lifecycle.
 *   Never hardcode application names or ids.
 *
 * Dependencies:
 *   AppLoader      — to discover and instantiate application plugins
 *   WindowManager  — to create and manage windows
 *   EventBus       — to broadcast application state changes
 */

import AppLoader     from '../core/AppLoader.js';
import WindowManager from './WindowManager.js';
import EventBus      from '../core/EventBus.js';

class ApplicationManagerClass {

    constructor() {

        /**
         * All loaded application instances, keyed by app id.
         * @type {Map<string, BaseApp>}
         */
        this._apps = new Map();

        /**
         * Registry configs loaded from apps.json, keyed by app id.
         * Used by UI components that need metadata without instantiating apps.
         * @type {Map<string, Object>}
         */
        this._registry = new Map();

        /**
         * Set of app ids that are currently running (window is open).
         * @type {Set<string>}
         */
        this._running = new Set();

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Discover all installed applications and load their metadata.
     * Stores registry configs for UI use regardless of whether the
     * JS module loads successfully.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        const registryConfigs = await AppLoader.loadRegistry();
        console.info( `ApplicationManager: Discovered ${ registryConfigs.length } application(s).` );

        for ( const registryConfig of registryConfigs ) {

            const appId = registryConfig.id;

            // Always store registry config — UI needs it even if the module fails.
            this._registry.set( appId, registryConfig );

            const app = await AppLoader.load( registryConfig );

            if ( !app ) {
                console.warn( `ApplicationManager: Module for "${ appId }" unavailable — metadata available only.` );
                continue;
            }

            this._apps.set( appId, app );
            console.info( `ApplicationManager: Loaded "${ appId }".` );

        }

        EventBus.emit( 'applications:ready', { count: this._registry.size } );

    }

    // ─────────────────────────────────────────────────────────────
    // Application Lifecycle
    // ─────────────────────────────────────────────────────────────

    /**
     * Launch an application by id.
     * If the application is a singleton and already running, focus it instead.
     *
     * @param {string} appId - The application identifier.
     * @returns {void}
     */
    launch( appId ) {

        const app = this._apps.get( appId );

        if ( !app ) {
            // Mission 02: log only — window system not implemented yet.
            console.info( `Opening: ${ appId }` );
            EventBus.emit( 'application:requested', { appId } );
            return;
        }

        // Singleton enforcement — bring to front if already open.
        if ( app.config.singleton && this._running.has( appId ) ) {
            WindowManager.focus( appId );
            return;
        }

        // First launch — initialize the application.
        if ( !app.isCreated ) {
            app.create();
            app.isCreated = true;
        }

        WindowManager.create( appId, app.config );
        app.open();
        app.isOpen = true;

        this._running.add( appId );

        EventBus.emit( 'application:launched', { appId } );

    }

    /**
     * Minimize a running application.
     *
     * @param {string} appId
     * @returns {void}
     */
    minimize( appId ) {

        const app = this._apps.get( appId );
        if ( !app || !this._running.has( appId ) ) return;

        WindowManager.minimize( appId );
        app.minimize();

        EventBus.emit( 'application:minimized', { appId } );

    }

    /**
     * Restore a minimized application.
     *
     * @param {string} appId
     * @returns {void}
     */
    restore( appId ) {

        const app = this._apps.get( appId );
        if ( !app ) return;

        WindowManager.restore( appId );
        app.restore();
        app.isOpen = true;

        EventBus.emit( 'application:restored', { appId } );

    }

    /**
     * Close a running application.
     *
     * @param {string} appId
     * @returns {void}
     */
    close( appId ) {

        const app = this._apps.get( appId );
        if ( !app || !this._running.has( appId ) ) return;

        app.close();
        app.isOpen = false;
        WindowManager.close( appId );

        this._running.delete( appId );

        EventBus.emit( 'application:closed', { appId } );

    }

    /**
     * Fully unload an application from memory.
     *
     * @param {string} appId
     * @returns {void}
     */
    destroy( appId ) {

        const app = this._apps.get( appId );
        if ( !app ) return;

        if ( this._running.has( appId ) ) {
            this.close( appId );
        }

        app.destroy();
        this._apps.delete( appId );

        EventBus.emit( 'application:destroyed', { appId } );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return metadata for all installed applications.
     * Uses registry configs — available even if module failed to load.
     * Used by TaskbarManager and DesktopIconManager to render UI.
     *
     * @returns {Object[]} - Array of app config objects.
     */
    getInstalledApps() {
        return Array.from( this._registry.values() );
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

}

// Singleton — one shared application manager for the entire workstation.
const ApplicationManager = new ApplicationManagerClass();

export default ApplicationManager;
