/**
 * SettingsManager
 *
 * Purpose:
 *   Single source of truth for all CID OS user preferences.
 *   Loads settings from LocalStorage at boot, applies them immediately,
 *   and exposes a save/get/reset API for the Settings application.
 *
 * Responsibilities:
 *   - Define and maintain factory defaults
 *   - Load persisted settings over defaults at boot
 *   - Apply live effects: wallpaper, UI scale, animations
 *   - Save individual or batch setting changes
 *   - Reset to factory defaults on request
 *   - Emit EventBus events on every change so all systems can react
 *
 * Storage:
 *   Key: detective-files:settings  (via StorageManager)
 *   Format: flat JSON object — see DEFAULT_SETTINGS
 *
 * Events emitted:
 *   settings:changed     — any setting changed { key, value, all }
 *   theme:changed        — theme key changed    { theme }
 *   wallpaper:changed    — wallpaper changed    { wallpaper, path }
 *   ui-scale:changed     — UI scale changed     { scale }
 *
 * Rules:
 *   No module except StorageManager may access localStorage directly.
 *   Applications read settings via SettingsManager.get(key).
 *   Applications react to changes via EventBus, not polling.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY = 'settings';

/**
 * Factory defaults — the authoritative definition of every setting.
 * Always shallow-clone before returning to prevent mutation.
 */
const DEFAULT_SETTINGS = {
    language:         'en',
    theme:            'cid-dark',
    wallpaper:        'headquarters',
    uiScale:          100,
    confirmClose:     true,
    animations:       true,
    reduceAnimations: false,
    largerTitleText:  false,
    tooltipsEnabled:  true,
};

/**
 * Maps wallpaper ids to CSS background values.
 * Real location artwork lives in assets/wallpapers/. Each option corresponds
 * to a location visited during an investigation. 'none' falls back to the
 * flat CID OS background color.
 */
const WALLPAPER_PATHS = {
    'none':         null,
    'headquarters': 'url("assets/wallpapers/Police_headquarters.png")',
    'ashcroft':     'url("assets/wallpapers/Ashcroft Street.png")',
    'fogwood':      'url("assets/wallpapers/Fogwood Street.png")',
    'holloway':     'url("assets/wallpapers/Holloway Lane.png")',
    'ravenwood':    'url("assets/wallpapers/Ravenwood Street.png")',
};

class SettingsManagerClass {

    constructor() {

        /**
         * Current live settings (loaded defaults + user overrides).
         * @type {Object}
         */
        this._current = { ...DEFAULT_SETTINGS };

    }

    // ─────────────────────────────────────────────────────────────
    // Boot
    // ─────────────────────────────────────────────────────────────

    /**
     * Load persisted settings and apply all live effects.
     * Called once by Workstation during boot, before desktop renders.
     *
     * @returns {void}
     */
    initialize() {

        const saved = StorageManager.load( STORAGE_KEY, {} );

        // Merge saved values over defaults — unknown keys are ignored.
        for ( const key of Object.keys( DEFAULT_SETTINGS ) ) {
            if ( key in saved ) {
                this._current[ key ] = saved[ key ];
            }
        }

        // Apply all effects immediately so CID OS starts in the user's state.
        this._applyUIScale( this._current.uiScale );
        this._applyAnimations( this._current.reduceAnimations );
        this._applyLargerTitleText( this._current.largerTitleText );
        // Wallpaper is applied by DesktopManager once it exists.
        // SettingsManager emits the event; DesktopManager listens.

        console.info( 'SettingsManager: Initialized.', this._current );

    }

    /**
     * Apply the saved wallpaper to the desktop.
     * Called by Workstation after DesktopManager is ready.
     *
     * @returns {void}
     */
    applyWallpaper() {

        const path = WALLPAPER_PATHS[ this._current.wallpaper ] ?? null;
        EventBus.emit( 'wallpaper:changed', { wallpaper: this._current.wallpaper, path } );

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Get a single setting value.
     *
     * @param {string} key - Setting key.
     * @returns {*}        - Current value, or undefined if key is unknown.
     */
    get( key ) {
        return this._current[ key ];
    }

    /**
     * Get all current settings as a shallow copy.
     *
     * @returns {Object}
     */
    getAll() {
        return { ...this._current };
    }

    /**
     * Get the factory defaults as a shallow copy.
     *
     * @returns {Object}
     */
    getDefaults() {
        return { ...DEFAULT_SETTINGS };
    }

    /**
     * Get all wallpaper options.
     *
     * @returns {{ id: string, label: string }[]}
     */
    getWallpaperOptions() {
        return [
            { id: 'none',         label: 'None' },
            { id: 'headquarters', label: 'Police Headquarters — Holloway Lane' },
            { id: 'ashcroft',     label: 'Ashcroft Street — Industrial District' },
            { id: 'fogwood',      label: 'Fogwood Street — Research Quarter' },
            { id: 'holloway',     label: 'Holloway Lane — City Centre' },
            { id: 'ravenwood',    label: 'Ravenwood Street — Westside' },
        ];
    }

    /**
     * Update a single setting, persist it, apply live effects, and emit events.
     *
     * @param {string} key   - Setting key.
     * @param {*}      value - New value.
     * @returns {void}
     */
    set( key, value ) {

        if ( !( key in DEFAULT_SETTINGS ) ) {
            console.warn( `SettingsManager: Unknown setting "${ key }".` );
            return;
        }

        this._current[ key ] = value;
        this._persist();
        this._applyEffect( key, value );

        EventBus.emit( 'settings:changed', { key, value, all: this.getAll() } );

    }

    /**
     * Reset all settings to factory defaults, persist, and re-apply all effects.
     *
     * @returns {void}
     */
    reset() {

        this._current = { ...DEFAULT_SETTINGS };
        this._persist();

        this._applyUIScale( this._current.uiScale );
        this._applyAnimations( this._current.reduceAnimations );
        this._applyLargerTitleText( this._current.largerTitleText );

        const wallpaperPath = WALLPAPER_PATHS[ this._current.wallpaper ] ?? null;
        EventBus.emit( 'wallpaper:changed', { wallpaper: this._current.wallpaper, path: wallpaperPath } );
        EventBus.emit( 'theme:changed',     { theme: this._current.theme } );
        EventBus.emit( 'ui-scale:changed',  { scale: this._current.uiScale } );
        EventBus.emit( 'settings:changed',  { key: null, value: null, all: this.getAll() } );

        console.info( 'SettingsManager: Reset to defaults.' );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — persistence
    // ─────────────────────────────────────────────────────────────

    /**
     * Save current settings to LocalStorage via StorageManager.
     *
     * @returns {void}
     */
    _persist() {
        StorageManager.save( STORAGE_KEY, this._current );
    }

    // ─────────────────────────────────────────────────────────────
    // Internal — live effect dispatch
    // ─────────────────────────────────────────────────────────────

    /**
     * Route a changed setting to its live-effect handler.
     *
     * @param {string} key
     * @param {*}      value
     * @returns {void}
     */
    _applyEffect( key, value ) {

        switch ( key ) {

            case 'wallpaper': {
                const path = WALLPAPER_PATHS[ value ] ?? null;
                EventBus.emit( 'wallpaper:changed', { wallpaper: value, path } );
                break;
            }

            case 'theme':
                EventBus.emit( 'theme:changed', { theme: value } );
                break;

            case 'uiScale':
                this._applyUIScale( value );
                EventBus.emit( 'ui-scale:changed', { scale: value } );
                break;

            case 'reduceAnimations':
                this._applyAnimations( value );
                break;

            case 'largerTitleText':
                this._applyLargerTitleText( value );
                break;

        }

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — CSS live effects
    // ─────────────────────────────────────────────────────────────

    /**
     * Apply UI scale by scaling the workstation root element.
     * Uses CSS transform so all pixel-based sizes scale uniformly,
     * regardless of whether they use px, em, or rem.
     *
     * @param {number} scale - 90 | 100 | 110 | 125
     * @returns {void}
     */
    _applyUIScale( scale ) {

        const factor = scale / 100;
        document.documentElement.style.setProperty( '--ui-scale', String( factor ) );

        const root = document.getElementById( 'workstation-root' );
        if ( !root ) return;

        if ( factor === 1 ) {
            root.style.transform       = '';
            root.style.transformOrigin = '';
            root.style.width           = '';
            root.style.height          = '';
        }
        else {
            // Scale from top-left; compensate size so content fills the viewport.
            root.style.transformOrigin = '0 0';
            root.style.transform       = `scale(${ factor })`;
            root.style.width           = `${ ( 1 / factor ) * 100 }%`;
            root.style.height          = `${ ( 1 / factor ) * 100 }%`;
        }

    }

    /**
     * Apply or remove the reduced-animation CSS class on :root.
     *
     * @param {boolean} reduce
     * @returns {void}
     */
    _applyAnimations( reduce ) {

        document.documentElement.classList.toggle( 'cid-reduce-animations', reduce );

    }

    /**
     * Apply or remove the larger-title-text CSS class on :root.
     *
     * @param {boolean} larger
     * @returns {void}
     */
    _applyLargerTitleText( larger ) {

        document.documentElement.classList.toggle( 'cid-larger-title-text', larger );

    }

}

// Singleton — one shared settings manager for the entire workstation.
const SettingsManager = new SettingsManagerClass();

export default SettingsManager;
