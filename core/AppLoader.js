/**
 * AppLoader
 *
 * Purpose:
 *   Discovers, loads, and instantiates application plugins
 *   from the /apps directory at runtime.
 *
 * Responsibilities:
 *   - Read the apps registry (apps.json)
 *   - Dynamically import each application's index.js
 *   - Inject each application's style.css
 *   - Return instantiated application objects to ApplicationManager
 *
 * Rules:
 *   AppLoader never knows what an application does.
 *   AppLoader only knows how to find and load applications.
 *   Application identifiers must never be hardcoded here.
 *
 * Dependencies:
 *   apps.json — the source of installed application ids
 */

class AppLoaderClass {

    constructor() {

        /**
         * Base path where all applications live.
         * @type {string}
         */
        this._appsPath = './apps';

        /**
         * Tracks which application stylesheets have been injected.
         * @type {Set<string>}
         */
        this._loadedStyles = new Set();

    }

    /**
     * Load the apps registry from configuration.
     * Returns the list of application ids that should be installed.
     *
     * @returns {Promise<string[]>} - Array of application ids.
     */
    async loadRegistry() {

        try {
            const response = await fetch( './data/apps.json' );

            if ( !response.ok ) {
                throw new Error( `HTTP ${ response.status }` );
            }

            const registry = await response.json();
            return registry.installed ?? [];
        }
        catch ( error ) {
            console.error( 'AppLoader: Unable to load application registry (data/apps.json).', error );
            return [];
        }

    }

    /**
     * Load an application's metadata from its app.json.
     *
     * @param {string} appId - The application identifier.
     * @returns {Promise<Object|null>} - Parsed app.json, or null on failure.
     */
    async loadConfig( appId ) {

        try {
            const response = await fetch( `${ this._appsPath }/${ appId }/app.json` );

            if ( !response.ok ) {
                throw new Error( `HTTP ${ response.status }` );
            }

            return await response.json();
        }
        catch ( error ) {
            console.error( `AppLoader: Unable to load config for "${ appId }".`, error );
            return null;
        }

    }

    /**
     * Dynamically import an application's JavaScript module.
     *
     * @param {string} appId - The application identifier.
     * @returns {Promise<Function|null>} - The application class, or null on failure.
     */
    async loadModule( appId ) {

        try {
            const module = await import( `../apps/${ appId }/index.js` );
            return module.default ?? null;
        }
        catch ( error ) {
            console.error( `AppLoader: Unable to load module for "${ appId }".`, error );
            return null;
        }

    }

    /**
     * Inject an application's stylesheet into the document head.
     * Safe to call multiple times — each stylesheet is only injected once.
     *
     * @param {string} appId - The application identifier.
     * @returns {void}
     */
    loadStyles( appId ) {

        if ( this._loadedStyles.has( appId ) ) {
            return;
        }

        const link = document.createElement( 'link' );
        link.rel  = 'stylesheet';
        link.href = `${ this._appsPath }/${ appId }/style.css`;

        document.head.appendChild( link );
        this._loadedStyles.add( appId );

    }

    /**
     * Fully load an application: config, styles, and module.
     * Returns an instantiated application object ready to be managed.
     *
     * @param {string} appId - The application identifier.
     * @returns {Promise<BaseApp|null>} - Instantiated app, or null on failure.
     */
    async load( appId ) {

        const config = await this.loadConfig( appId );
        if ( !config ) {
            return null;
        }

        const AppClass = await this.loadModule( appId );
        if ( !AppClass ) {
            return null;
        }

        this.loadStyles( appId );

        return new AppClass( config );

    }

}

// Singleton — one shared loader for the entire workstation.
const AppLoader = new AppLoaderClass();

export default AppLoader;
