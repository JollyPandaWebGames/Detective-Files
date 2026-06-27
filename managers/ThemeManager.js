/**
 * ThemeManager
 *
 * Purpose:
 *   Manages visual themes for the workstation.
 *   Applies theme configuration by injecting CSS custom property overrides.
 *
 * Responsibilities:
 *   - Load theme configuration from theme.json
 *   - Apply theme values as CSS variables on the document root
 *   - Notify applications of theme changes via EventBus
 *   - Persist the active theme selection
 *
 * Rules:
 *   ThemeManager only manages themes.
 *   It never touches window layout or application state.
 *
 * Dependencies:
 *   EventBus       — to notify applications of theme changes
 *   StorageManager — to persist the selected theme
 */

import EventBus      from '../core/EventBus.js';
import StorageManager from './StorageManager.js';

const STORAGE_KEY_THEME = 'active-theme';

class ThemeManagerClass {

    constructor() {

        /**
         * The currently active theme configuration.
         * @type {Object|null}
         */
        this._activeTheme = null;

    }

    /**
     * Load and apply the default or previously saved theme.
     * Called once by Workstation during startup.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        try {
            const response = await fetch( './data/theme.json' );

            if ( !response.ok ) {
                throw new Error( `HTTP ${ response.status }` );
            }

            const theme = await response.json();
            this.apply( theme );

            console.info( 'ThemeManager: Default theme applied.' );
        }
        catch ( error ) {
            console.error( 'ThemeManager: Unable to load theme configuration (data/theme.json).', error );
        }

    }

    /**
     * Apply a theme by injecting its values as CSS variables.
     *
     * @param {Object} theme - Theme configuration object.
     * @returns {void}
     */
    apply( theme ) {
        // Implementation added in Mission 01.
        this._activeTheme = theme;
        console.info( 'ThemeManager: apply() called.' );
        EventBus.emit( 'theme:changed', theme );
    }

    /**
     * Return the currently active theme.
     *
     * @returns {Object|null}
     */
    getActiveTheme() {
        return this._activeTheme;
    }

}

// Singleton — one shared theme manager for the entire workstation.
const ThemeManager = new ThemeManagerClass();

export default ThemeManager;
