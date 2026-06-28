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
 * apps.json format:
 *   A JSON array of app config objects, each with an "id" field.
 *   Example: [{ "id": "police-mail", "title": "...", ... }]
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
     * Load the full app registry from apps.json.
     * Returns the complete array of app config objects.
     *
     * @returns {Promise<Object[]>} - Array of app config objects.
     */
    async loadRegistry() {

        try {
            const response = await fetch( './data/apps.json' );

            if ( !response.ok ) {
                throw new Error( `HTTP ${ response.status }` );
            }

            const data = await response.json();

            // Support both formats:
            //   - Array: [{ id, title, ... }, ...]       (Mission 02+ format)
            //   - Object: { installed: ["id1", "id2"] }  (Mission 00 legacy)
            if ( Array.isArray( data ) ) {
                return data;
            }

            // Legacy format — return minimal config objects from id list.
            if ( data.installed && Array.isArray( data.installed ) ) {
                return data.installed.map( id => ( { id } ) );
            }

            console.warn( 'AppLoader: Unrecognized apps.json format.' );
            return [];
        }
        catch ( error ) {
            console.error( 'AppLoader: Unable to load application registry (data/apps.json).', error );
            return [];
        }

    }

    /**
     * Load an application's metadata from its app.json.
     * Falls back to the registry config if app.json is unavailable.
     *
     * @param {Object} registryConfig - Config object from apps.json.
     * @returns {Promise<Object|null>} - Merged config, or null on failure.
     */
    async loadConfig( registryConfig ) {

        const appId = registryConfig.id;

        try {
            const response = await fetch( `${ this._appsPath }/${ appId }/app.json` );

            if ( !response.ok ) {
                // Fall back to registry config — sufficient for icon/title display.
                console.warn( `AppLoader: No app.json for "${ appId }", using registry config.` );
                return registryConfig;
            }

            // Merge: app.json takes precedence, registry config fills gaps.
            const appJson = await response.json();
            return { ...registryConfig, ...appJson };
        }
        catch ( error ) {
            console.warn( `AppLoader: Could not load app.json for "${ appId }".`, error );
            return registryConfig;
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
     * @param {Object} registryConfig - Config entry from apps.json.
     * @returns {Promise<BaseApp|null>} - Instantiated app, or null on failure.
     */
    async load( registryConfig ) {

        const config = await this.loadConfig( registryConfig );
        if ( !config ) {
            return null;
        }

        const AppClass = await this.loadModule( config.id );
        if ( !AppClass ) {
            return null;
        }

        this.loadStyles( config.id );

        return new AppClass( config );

    }

}

// Singleton — one shared loader for the entire workstation.
const AppLoader = new AppLoaderClass();

export default AppLoader;
