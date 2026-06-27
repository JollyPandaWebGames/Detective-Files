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

import AppLoader        from '../core/AppLoader.js';
import WindowManager    from './WindowManager.js';
import EventBus         from '../core/EventBus.js';

class ApplicationManagerClass {

    constructor() {

        /**
         * All loaded application instances, keyed by app id.
         * @type {Map<string, BaseApp>}
         */
        this._apps = new Map();

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
     * Does not launch any applications — only prepares them.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        const appIds = await AppLoader.loadRegistry();
        console.info( `ApplicationManager: Discovered ${ appIds.length } application(s).` );

        for ( const appId of appIds ) {

            const app = await AppLoader.load( appId );

            if ( !app ) {
                console.warn( `ApplicationManager: Skipping "${ appId }" — failed to load.` );
                continue;
            }

            this._apps.set( appId, app );
            console.info( `ApplicationManager: Loaded "${ appId }".` );

        }

        EventBus.emit( 'applications:ready', { count: this._apps.size } );

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
            console.error( `ApplicationManager: Cannot launch unknown application "${ appId }".` );
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
     * @param {string} appId - The application identifier.
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
     * @param {string} appId - The application identifier.
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
     * @param {string} appId - The application identifier.
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
     * Rarely needed — only on workstation shutdown or plugin updates.
     *
     * @param {string} appId - The application identifier.
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
     * Used by DesktopManager to render desktop icons and the start menu.
     *
     * @returns {Object[]} - Array of app config objects.
     */
    getInstalledApps() {
        return Array.from( this._apps.values() ).map( app => app.config );
    }

    /**
     * Check whether an application is currently running.
     *
     * @param {string} appId - The application identifier.
     * @returns {boolean}
     */
    isRunning( appId ) {
        return this._running.has( appId );
    }

}

// Singleton — one shared application manager for the entire workstation.
const ApplicationManager = new ApplicationManagerClass();

export default ApplicationManager;
