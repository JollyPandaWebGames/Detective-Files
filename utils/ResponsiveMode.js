/**
 * ResponsiveMode
 *
 * Purpose:
 *   Detects the current viewport mode (desktop / tablet / phone) and
 *   provides a single source of truth for layout decisions across
 *   the window framework.
 *
 * Responsibilities:
 *   - Evaluate viewport width against defined breakpoints
 *   - Broadcast mode changes via EventBus
 *   - Expose the current mode synchronously for instant queries
 *
 * Rules:
 *   Window components query this module — they never sniff the viewport
 *   themselves. This keeps responsive logic in one place.
 *   Applications must never know which mode is active.
 *
 * Breakpoints (matching UI_GUIDELINES.md — desktop-first, 1280px minimum):
 *   phone   → width < 640px
 *   tablet  → 640px ≤ width < 1024px
 *   desktop → width ≥ 1024px
 *
 * Dependencies:
 *   EventBus — to emit 'responsive:changed' when the mode shifts
 */

import EventBus from '../core/EventBus.js';

const BREAKPOINT_PHONE  = 640;
const BREAKPOINT_TABLET = 1024;

export const MODE_PHONE   = 'phone';
export const MODE_TABLET  = 'tablet';
export const MODE_DESKTOP = 'desktop';

class ResponsiveModeClass {

    constructor() {

        /**
         * Current detected mode.
         * @type {string}
         */
        this._mode = this._detect();

        /**
         * Bound resize handler for cleanup.
         * @type {Function}
         */
        this._onResize = this._handleResize.bind( this );

        window.addEventListener( 'resize', this._onResize );

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Return the current viewport mode.
     *
     * @returns {string} - One of MODE_PHONE | MODE_TABLET | MODE_DESKTOP
     */
    get() {
        return this._mode;
    }

    /**
     * Return true if the current mode is phone.
     *
     * @returns {boolean}
     */
    isPhone() {
        return this._mode === MODE_PHONE;
    }

    /**
     * Return true if the current mode is tablet.
     *
     * @returns {boolean}
     */
    isTablet() {
        return this._mode === MODE_TABLET;
    }

    /**
     * Return true if the current mode is desktop.
     *
     * @returns {boolean}
     */
    isDesktop() {
        return this._mode === MODE_DESKTOP;
    }

    /**
     * Return true if dragging should be enabled (desktop or tablet).
     *
     * @returns {boolean}
     */
    isDraggable() {
        return this._mode !== MODE_PHONE;
    }

    // ─────────────────────────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────────────────────────

    /**
     * Detect the current mode from viewport width.
     *
     * @returns {string}
     */
    _detect() {

        const w = window.innerWidth;

        if ( w < BREAKPOINT_PHONE )  return MODE_PHONE;
        if ( w < BREAKPOINT_TABLET ) return MODE_TABLET;
        return MODE_DESKTOP;

    }

    /**
     * Handle viewport resize — emit event only when mode actually changes.
     *
     * @returns {void}
     */
    _handleResize() {

        const newMode = this._detect();

        if ( newMode !== this._mode ) {
            const previousMode = this._mode;
            this._mode = newMode;
            EventBus.emit( 'responsive:changed', { mode: newMode, previousMode } );
            console.info( `ResponsiveMode: ${ previousMode } → ${ newMode }` );
        }

    }

}

// Singleton — evaluated once, shared everywhere.
const ResponsiveMode = new ResponsiveModeClass();

export default ResponsiveMode;
