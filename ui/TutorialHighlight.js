/**
 * TutorialHighlight
 *
 * Purpose:
 *   Reusable visual highlighting mechanism for guided tutorials.
 *   Dims the rest of the screen and draws a pulsing outline around
 *   whatever element the current tutorial step wants the player to
 *   interact with.
 *
 * Responsibilities:
 *   - Locate a target element by CSS selector, optionally scoped to
 *     the desktop icon layer or a specific application window
 *   - Keep retrying that lookup for a bounded window if it isn't in
 *     the DOM yet — several apps (Evidence, CCTV, Messenger, Criminal
 *     Database, ...) load their case data asynchronously after their
 *     window opens, so the target frequently doesn't exist the instant
 *     'app:opened' fires (see fix note on RESOLVE_TIMEOUT_MS below)
 *   - Track that element's position (scroll/resize/drag) and keep
 *     the highlight box aligned to it; if the element is later
 *     removed from the DOM (e.g. the list re-renders with fresh
 *     nodes), resume searching instead of giving up permanently
 *   - Do nothing else — TutorialHighlight never blocks or allows
 *     clicks itself. Interaction locking is TutorialManager's job
 *     (see managers/TutorialManager.js), which is what makes this
 *     component safe to reuse for non-blocking hint highlights too.
 *
 * Rules:
 *   Purely visual. No gameplay logic, no EventBus locking decisions.
 *
 * Usage:
 *   TutorialHighlight.show( '[data-app-id="case-management"]', 'desktop' );
 *   TutorialHighlight.hide();
 */

// Bug fix (v1.1.5): the target for an instruction step is frequently not
// in the DOM the instant the step is entered — e.g. Evidence Database
// opens its window immediately but loads that case's evidence list via
// an async fetch (EvidenceManager.loadForCase), so '.ev__list-item'
// doesn't exist for a brief moment. Previously `show()` looked up the
// selector exactly once and gave up silently if it wasn't there yet,
// which left TutorialManager's lock with no valid click target at all —
// the whole screen appeared locked with nothing selectable. Now `show()`
// keeps retrying every frame until it finds a match or this timeout
// elapses, which comfortably covers real network/data-load latency.
const RESOLVE_TIMEOUT_MS = 8000;

class TutorialHighlightClass {

    constructor() {

        /** @type {HTMLElement|null} */
        this._box = null;

        /** @type {HTMLElement|null} */
        this._target = null;

        /** @type {number|null} */
        this._rafId = null;

        /** @type {string|null} Selector currently being searched/tracked */
        this._selector = null;

        /** @type {string|null} */
        this._scope = null;

        /** @type {number} performance.now() deadline to stop retrying */
        this._deadline = 0;

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Show the highlight box around the first element matching
     * `selector`, optionally scoped to reduce ambiguity. If the
     * element isn't in the DOM yet, keeps retrying until it appears
     * or RESOLVE_TIMEOUT_MS elapses.
     *
     * @param {string}      selector - CSS selector for the target.
     * @param {string|null} [scope]  - 'desktop', 'window:<appId>', or
     *                                 null/undefined to search the
     *                                 whole document.
     * @returns {void}
     */
    show( selector, scope = null ) {

        this._reset();

        this._selector = selector;
        this._scope    = scope;
        this._deadline = performance.now() + RESOLVE_TIMEOUT_MS;

        this._loop();

    }

    /**
     * Remove the highlight box and stop searching/tracking.
     *
     * @returns {void}
     */
    hide() {
        this._reset();
    }

    /**
     * The element currently highlighted, if any (null while still
     * searching, or if the target never appeared).
     *
     * @returns {HTMLElement|null}
     */
    getTarget() {
        return this._target;
    }

    // ─────────────────────────────────────────────────────────────
    // Resolution
    // ─────────────────────────────────────────────────────────────

    /**
     * Resolve a selector within a scope root.
     *
     * @param {string}      selector
     * @param {string|null} scope
     * @returns {HTMLElement|null}
     */
    _resolveTarget( selector, scope ) {

        let root = document;

        if ( scope === 'desktop' ) {
            root = document.querySelector( '.cid-desktop__icon-area' ) ?? document;
        } else if ( typeof scope === 'string' && scope.startsWith( 'window:' ) ) {
            const appId = scope.slice( 'window:'.length );
            root = document.querySelector( `[data-window-id="${ appId }"]` ) ?? document;
        }

        return root.querySelector( selector );

    }

    // ─────────────────────────────────────────────────────────────
    // Search + Position Loop
    // ─────────────────────────────────────────────────────────────

    /**
     * Single per-frame loop that both searches for the target (while
     * not yet found, or after it disappears from the DOM) and keeps
     * the highlight box aligned to it once found. Cheap — a single
     * `querySelector` per frame only while actively searching.
     *
     * @returns {void}
     */
    _loop() {

        const step = () => {

            if ( !this._target || !this._target.isConnected ) {

                this._target = this._resolveTarget( this._selector, this._scope );

                if ( !this._target ) {

                    if ( performance.now() > this._deadline ) {
                        // Gave up — the instruction banner text is still
                        // shown by TutorialManager regardless; there's
                        // just no element to circle.
                        this._rafId = null;
                        return;
                    }

                    this._rafId = requestAnimationFrame( step );
                    return;

                }

                this._ensureBox();

            }

            this._position();

            this._rafId = requestAnimationFrame( step );

        };

        step();

    }

    /**
     * Create the highlight box element if it doesn't exist yet.
     *
     * @returns {void}
     */
    _ensureBox() {

        if ( this._box ) return;

        this._box = document.createElement( 'div' );
        this._box.className = 'tutorial-highlight';
        document.body.appendChild( this._box );

    }

    /**
     * Align the highlight box to the current target's bounding rect.
     *
     * @returns {void}
     */
    _position() {

        const rect = this._target.getBoundingClientRect();

        this._box.style.top    = `${ rect.top - 6 }px`;
        this._box.style.left   = `${ rect.left - 6 }px`;
        this._box.style.width  = `${ rect.width + 12 }px`;
        this._box.style.height = `${ rect.height + 12 }px`;

    }

    /**
     * Cancel any in-flight search/tracking loop and remove the box.
     *
     * @returns {void}
     */
    _reset() {

        if ( this._rafId !== null ) {
            cancelAnimationFrame( this._rafId );
            this._rafId = null;
        }

        if ( this._box && this._box.parentNode ) {
            this._box.parentNode.removeChild( this._box );
        }

        this._box      = null;
        this._target   = null;
        this._selector = null;
        this._scope    = null;

    }

}

const TutorialHighlight = new TutorialHighlightClass();
export default TutorialHighlight;
