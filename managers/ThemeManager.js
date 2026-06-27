/**
 * ThemeManager
 *
 * Purpose:
 *   Manages visual themes for the workstation.
 *   Applies theme configuration by writing CSS custom properties
 *   directly onto the document root element at runtime.
 *
 * Responsibilities:
 *   - Load theme configuration from /data/theme.json
 *   - Map theme.json color keys to CSS custom properties
 *   - Apply theme values so all components update automatically
 *   - Notify the system of theme changes via EventBus
 *
 * Rules:
 *   ThemeManager only manages themes.
 *   Never touch window layout, application state, or storage here.
 *
 * Dependencies:
 *   EventBus — to notify applications of theme changes
 */

import EventBus from '../core/EventBus.js';

/**
 * Maps theme.json color keys to CSS custom property names.
 * Any key not listed here is ignored.
 */
const COLOR_MAP = {
    bgPrimary:      '--color-bg-primary',
    bgSecondary:    '--color-bg-secondary',
    bgWindow:       '--color-bg-window',
    bgTaskbar:      '--color-bg-taskbar',
    borderWindow:   '--color-border-window',
    titlebar:       '--color-titlebar',
    titlebarActive: '--color-titlebar-active',
    textPrimary:    '--color-text-primary',
    textSecondary:  '--color-text-secondary',
    highlight:      '--color-highlight',
    success:        '--color-success',
    warning:        '--color-warning',
    danger:         '--color-danger',
    disabled:       '--color-disabled',
};

class ThemeManagerClass {

    constructor() {

        /**
         * The currently active theme configuration.
         * @type {Object|null}
         */
        this._activeTheme = null;

    }

    /**
     * Load and apply the default theme from /data/theme.json.
     * Called once by Workstation during the boot sequence.
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

            console.info( `ThemeManager: Applied theme "${ theme.name }".` );
        }
        catch ( error ) {
            console.error( 'ThemeManager: Unable to load theme configuration (data/theme.json).', error );
        }

    }

    /**
     * Apply a theme configuration to the document.
     * Writes each color value as a CSS custom property on :root.
     *
     * @param {Object} theme - Parsed theme.json object.
     * @returns {void}
     */
    apply( theme ) {

        if ( !theme || !theme.colors ) {
            console.warn( 'ThemeManager: apply() received an invalid theme object.' );
            return;
        }

        const root = document.documentElement;

        for ( const [ key, cssVar ] of Object.entries( COLOR_MAP ) ) {

            const value = theme.colors[ key ];

            if ( value ) {
                root.style.setProperty( cssVar, value );
            }

        }

        this._activeTheme = theme;

        EventBus.emit( 'theme:changed', theme );

    }

    /**
     * Return the currently active theme configuration.
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
