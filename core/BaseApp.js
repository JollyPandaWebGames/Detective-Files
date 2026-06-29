/**
 * BaseApp
 *
 * Purpose:
 *   Abstract base class for every CID OS application.
 *   Provides a complete default lifecycle so placeholder applications
 *   need zero boilerplate — they simply extend BaseApp.
 *
 * Responsibilities:
 *   - Store application config and expose id, title, emoji
 *   - Hold a reference to the Window instance provided by WindowManager
 *   - Expose the window's content area (contentEl) for subclass DOM injection
 *   - Provide working default implementations of every lifecycle method
 *   - Enforce that applications never create windows directly
 *
 * Lifecycle (called by ApplicationManager — never directly):
 *
 *   create(contentEl)  — called once; build UI inside contentEl
 *   open()             — window is now visible; start listeners
 *   close()            — window closing; stop listeners
 *   minimize()         — window hidden
 *   restore()          — window restored from minimized
 *   destroy()          — full teardown; remove all references
 *
 * Rules:
 *   Never call WindowManager from inside an application.
 *   Never call other applications directly — use EventBus.
 *   Always call super() in constructor.
 *
 * Dependencies:
 *   EventBus — provided as emit() / on() / off() helpers
 */

import EventBus from './EventBus.js';

class BaseApp {

    /**
     * @param {Object} config - Parsed app.json config.
     */
    constructor( config ) {

        /** Full config object. @type {Object} */
        this.config = config;

        /** Unique app id. @type {string} */
        this.id = config.id;

        /** Display title. @type {string} */
        this.title = config.title;

        /** Emoji icon. @type {string} */
        this.emoji = config.emoji ?? '🖥️';

        /**
         * The Window instance assigned by ApplicationManager after launch.
         * Available from create() onward.
         * @type {import('../ui/Window.js').default|null}
         */
        this._window = null;

        /**
         * The content area DOM element inside the window.
         * Injected by ApplicationManager before create() is called.
         * Applications build their UI inside this element.
         * @type {HTMLElement|null}
         */
        this._contentEl = null;

        /** Whether create() has been called. @type {boolean} */
        this.isCreated = false;

        /** Whether the window is currently open and visible. @type {boolean} */
        this.isOpen = false;

        /** Whether the window is minimized. @type {boolean} */
        this.isMinimized = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle — default implementations
    // Subclasses override only what they need.
    // ─────────────────────────────────────────────────────────────

    /**
     * Called once when the application launches.
     * Receives the window's content area element.
     * Build all DOM here. Do not start timers or fetch data here.
     *
     * @param {HTMLElement} contentEl - The window content container.
     * @returns {void}
     */
    create( contentEl ) {

        // Default implementation renders a standard placeholder.
        // Subclasses override this to build real UI.
        this._renderPlaceholder( contentEl );

    }

    /**
     * Called when the window becomes visible.
     * Start event listeners and refresh data here.
     *
     * @returns {void}
     */
    open() {
        // Subclasses override to start listeners / load data.
    }

    /**
     * Called when the window is closed.
     * Stop event listeners. DOM is destroyed immediately after.
     *
     * @returns {void}
     */
    close() {
        // Subclasses override to clean up listeners.
    }

    /**
     * Called when the window is minimized.
     *
     * @returns {void}
     */
    minimize() {
        // Subclasses override if they need to pause activity.
    }

    /**
     * Called when the window is restored from minimized state.
     *
     * @returns {void}
     */
    restore() {
        // Subclasses override if they need to resume activity.
    }

    /**
     * Called when the application is fully unloaded from memory.
     * Remove all event listeners, timers, and DOM references.
     *
     * @returns {void}
     */
    destroy() {

        // Subclasses override to clean up timers / subscriptions.
        // Always null contentEl reference to help GC.
        this._contentEl = null;
        this._window    = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Optional hooks
    // ─────────────────────────────────────────────────────────────

    /** Called when this window gains focus. @returns {void} */
    onFocus() {}

    /** Called when this window loses focus. @returns {void} */
    onBlur() {}

    /** Called when the theme changes. @param {Object} theme @returns {void} */
    onThemeChanged( theme ) {}

    // ─────────────────────────────────────────────────────────────
    // EventBus helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Emit an event on the global bus.
     * @param {string} eventName
     * @param {*} [payload]
     */
    emit( eventName, payload ) {
        EventBus.emit( eventName, payload );
    }

    /**
     * Subscribe to an event.
     * @param {string} eventName
     * @param {Function} handler
     */
    on( eventName, handler ) {
        EventBus.on( eventName, handler );
    }

    /**
     * Unsubscribe from an event.
     * @param {string} eventName
     * @param {Function} handler
     */
    off( eventName, handler ) {
        EventBus.off( eventName, handler );
    }

    // ─────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Render the standard placeholder UI.
     * Used by the default create() implementation.
     * Real applications replace this with their own DOM.
     *
     * @param {HTMLElement} contentEl
     * @returns {void}
     */
    _renderPlaceholder( contentEl ) {

        contentEl.innerHTML = '';

        const wrap = document.createElement( 'div' );
        wrap.className = 'baseapp-placeholder';

        const emojiEl = document.createElement( 'div' );
        emojiEl.className   = 'baseapp-placeholder__emoji';
        emojiEl.textContent = this.emoji;

        const titleEl = document.createElement( 'div' );
        titleEl.className   = 'baseapp-placeholder__title';
        titleEl.textContent = this.title;

        const subEl = document.createElement( 'div' );
        subEl.className   = 'baseapp-placeholder__sub';
        subEl.textContent = 'This application is under development.';

        wrap.appendChild( emojiEl );
        wrap.appendChild( titleEl );
        wrap.appendChild( subEl );
        contentEl.appendChild( wrap );

    }

}

export default BaseApp;
