/**
 * BaseApp
 *
 * Purpose:
 *   Abstract base class for every workstation application.
 *   Defines the standard application lifecycle and enforces
 *   a consistent interface across all plugins.
 *
 * Responsibilities:
 *   - Provide lifecycle hook signatures (create, open, close, etc.)
 *   - Store application metadata from app.json
 *   - Expose the application's root DOM container
 *   - Enforce that no application manipulates windows directly
 *
 * Rules:
 *   Every application MUST extend BaseApp.
 *   Never instantiate BaseApp directly.
 *   Applications must never manipulate window DOM directly.
 *   Applications must never call other applications directly.
 *
 * Lifecycle Order:
 *   create() → open() → [minimize() / restore()] → close() → destroy()
 */

import EventBus from './EventBus.js';

class BaseApp {

    /**
     * @param {Object} config - The parsed contents of the application's app.json.
     */
    constructor( config ) {

        /**
         * Application configuration loaded from app.json.
         * @type {Object}
         */
        this.config = config;

        /**
         * Unique application identifier. Never changes after release.
         * @type {string}
         */
        this.id = config.id;

        /**
         * Human-readable application title shown in UI.
         * @type {string}
         */
        this.title = config.title;

        /**
         * Root DOM container for this application.
         * Created during create() and destroyed during destroy().
         * @type {HTMLElement|null}
         */
        this.container = null;

        /**
         * Whether the application is currently visible.
         * @type {boolean}
         */
        this.isOpen = false;

        /**
         * Whether the application has been initialized.
         * @type {boolean}
         */
        this.isCreated = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Required Lifecycle — Applications must override these.
    // ─────────────────────────────────────────────────────────────

    /**
     * Called once when the application is first loaded.
     * Build the DOM structure here.
     * Do not perform data loading or side effects.
     *
     * @returns {void}
     */
    create() {
        throw new Error( `${ this.id }: create() must be implemented.` );
    }

    /**
     * Called when the application window becomes visible.
     * Start event listeners and refresh data here.
     *
     * @returns {void}
     */
    open() {
        throw new Error( `${ this.id }: open() must be implemented.` );
    }

    /**
     * Called when the application window is closed.
     * Stop listeners. Do not destroy the DOM yet.
     *
     * @returns {void}
     */
    close() {
        throw new Error( `${ this.id }: close() must be implemented.` );
    }

    /**
     * Called when the application window is minimized.
     * Hide or pause activity as appropriate.
     *
     * @returns {void}
     */
    minimize() {
        throw new Error( `${ this.id }: minimize() must be implemented.` );
    }

    /**
     * Called when the application window is restored from minimized state.
     *
     * @returns {void}
     */
    restore() {
        throw new Error( `${ this.id }: restore() must be implemented.` );
    }

    /**
     * Called when the application is fully unloaded from memory.
     * Remove all event listeners, timers, and references.
     * Destroy the DOM container.
     *
     * @returns {void}
     */
    destroy() {
        throw new Error( `${ this.id }: destroy() must be implemented.` );
    }

    // ─────────────────────────────────────────────────────────────
    // Optional Lifecycle — Applications may override these.
    // ─────────────────────────────────────────────────────────────

    /**
     * Called when the application window receives focus.
     * @returns {void}
     */
    onFocus() {}

    /**
     * Called when the application window loses focus.
     * @returns {void}
     */
    onBlur() {}

    /**
     * Called when the application window is resized.
     * @param {{ width: number, height: number }} size
     * @returns {void}
     */
    onResize( size ) {}

    /**
     * Called when the workstation theme changes.
     * @param {Object} theme - The new theme configuration.
     * @returns {void}
     */
    onThemeChanged( theme ) {}

    /**
     * Called when the workstation requests a save snapshot.
     * Return any state that should be persisted.
     *
     * @returns {Object|null}
     */
    onSave() {
        return null;
    }

    /**
     * Called when persisted state is restored from storage.
     * @param {Object} state - Previously saved state.
     * @returns {void}
     */
    onRestore( state ) {}

    // ─────────────────────────────────────────────────────────────
    // Helpers — Shared utilities available to all applications.
    // ─────────────────────────────────────────────────────────────

    /**
     * Convenience wrapper around EventBus.emit.
     * Applications should prefer this over importing EventBus directly
     * to keep the dependency surface minimal.
     *
     * @param {string} eventName
     * @param {*}      [payload]
     * @returns {void}
     */
    emit( eventName, payload ) {
        EventBus.emit( eventName, payload );
    }

    /**
     * Convenience wrapper around EventBus.on.
     *
     * @param {string}   eventName
     * @param {Function} handler
     * @returns {void}
     */
    on( eventName, handler ) {
        EventBus.on( eventName, handler );
    }

}

export default BaseApp;
