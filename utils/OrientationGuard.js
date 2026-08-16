/**
 * OrientationGuard
 *
 * Purpose:
 *   Detective Files is landscape-only. On touch devices (phone/tablet)
 *   this module detects portrait orientation and blocks the game
 *   behind a dedicated "please rotate your device" screen.
 *
 * Responsibilities:
 *   - Detect whether the current device is mobile/tablet
 *     (ResponsiveMode already distinguishes phone/tablet from desktop,
 *     but orientation is only meaningful on touch devices — a narrow
 *     desktop browser window is never asked to "rotate")
 *   - Watch orientation/resize and toggle the block screen
 *   - Recalculate viewport-dependent layout once landscape is restored
 *
 * Rules:
 *   OrientationGuard never touches window/desktop layout itself —
 *   it only shows/hides its own overlay and re-emits a
 *   'orientation:restored' event so DesktopManager/WindowManager can
 *   recalculate anything they own. See docs/PLATFORM_REQUIREMENTS.md.
 *   Desktop browsers (mouse/keyboard, no touch) are never blocked,
 *   even if the window is narrow and tall — landscape enforcement is
 *   a mobile/tablet device rule, not a generic aspect-ratio rule.
 *
 * Dependencies:
 *   EventBus — to announce restoration so layout can recalculate.
 */

import EventBus from '../core/EventBus.js';

class OrientationGuardClass {

    constructor() {

        /** @type {HTMLElement|null} */
        this._overlay = null;

        /** @type {HTMLElement|null} */
        this._root = null;

        /** @type {boolean} */
        this._blocking = false;

        this._onChange = this._evaluate.bind( this );

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Begin watching orientation. Mounts the overlay immediately if
     * the device is already in a blocked (portrait, touch) state.
     *
     * @param {HTMLElement} root - The workstation root container.
     * @returns {void}
     */
    initialize( root ) {

        this._root = root;

        window.addEventListener( 'resize', this._onChange );
        window.addEventListener( 'orientationchange', this._onChange );

        this._evaluate();

    }

    /**
     * Whether the game is currently blocked by the orientation screen.
     *
     * @returns {boolean}
     */
    isBlocking() {
        return this._blocking;
    }

    // ─────────────────────────────────────────────────────────────
    // Detection
    // ─────────────────────────────────────────────────────────────

    /**
     * A touch-capable device — the only category orientation applies to.
     * A desktop browser resized narrow-and-tall is not asked to rotate.
     *
     * @returns {boolean}
     */
    _isTouchDevice() {
        return ( 'ontouchstart' in window ) || navigator.maxTouchPoints > 0;
    }

    /**
     * Current orientation is portrait (taller than wide).
     *
     * @returns {boolean}
     */
    _isPortrait() {
        return window.innerHeight > window.innerWidth;
    }

    // ─────────────────────────────────────────────────────────────
    // Evaluation
    // ─────────────────────────────────────────────────────────────

    /**
     * Re-check device + orientation and show/hide the block screen.
     *
     * @returns {void}
     */
    _evaluate() {

        const shouldBlock = this._isTouchDevice() && this._isPortrait();

        if ( shouldBlock && !this._blocking ) {
            this._blocking = true;
            this._show();
            return;
        }

        if ( !shouldBlock && this._blocking ) {
            this._blocking = false;
            this._hide();
        }

    }

    // ─────────────────────────────────────────────────────────────
    // DOM
    // ─────────────────────────────────────────────────────────────

    /**
     * Mount the "please rotate your device" overlay.
     *
     * @returns {void}
     */
    _show() {

        if ( !this._root || this._overlay ) return;

        this._overlay = document.createElement( 'div' );
        this._overlay.className = 'orientation-guard';
        this._overlay.setAttribute( 'role', 'alert' );

        this._overlay.innerHTML = `
            <div class="orientation-guard__icon">🔄</div>
            <div class="orientation-guard__title">Please rotate your device</div>
            <div class="orientation-guard__message">
                Detective Files is designed for landscape mode.
            </div>
        `;

        this._root.appendChild( this._overlay );

    }

    /**
     * Remove the overlay and let dependent systems recalculate layout.
     *
     * @returns {void}
     */
    _hide() {

        if ( this._overlay && this._overlay.parentNode ) {
            this._overlay.parentNode.removeChild( this._overlay );
        }
        this._overlay = null;

        // Viewport-dependent layout (desktop icons, open windows, taskbar)
        // needs to recalculate now that the game is visible again.
        EventBus.emit( 'orientation:restored', {} );

    }

}

const OrientationGuard = new OrientationGuardClass();
export default OrientationGuard;
