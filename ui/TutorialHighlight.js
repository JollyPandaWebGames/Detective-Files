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
 *   - Track that element's position (scroll/resize/drag) and keep
 *     the highlight box aligned to it
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

class TutorialHighlightClass {

    constructor() {

        /** @type {HTMLElement|null} */
        this._box = null;

        /** @type {HTMLElement|null} */
        this._target = null;

        /** @type {number|null} */
        this._rafId = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Show the highlight box around the first element matching
     * `selector`, optionally scoped to reduce ambiguity.
     *
     * @param {string}      selector - CSS selector for the target.
     * @param {string|null} [scope]  - 'desktop', 'window:<appId>', or
     *                                 null/undefined to search the
     *                                 whole document.
     * @returns {boolean} - Whether a target element was found.
     */
    show( selector, scope = null ) {

        const target = this._resolveTarget( selector, scope );

        if ( !target ) {
            this.hide();
            return false;
        }

        this._target = target;

        if ( !this._box ) {
            this._box = document.createElement( 'div' );
            this._box.className = 'tutorial-highlight';
            document.body.appendChild( this._box );
        }

        this._track();

        return true;

    }

    /**
     * Remove the highlight box and stop tracking.
     *
     * @returns {void}
     */
    hide() {

        if ( this._rafId !== null ) {
            cancelAnimationFrame( this._rafId );
            this._rafId = null;
        }

        if ( this._box && this._box.parentNode ) {
            this._box.parentNode.removeChild( this._box );
        }

        this._box    = null;
        this._target = null;

    }

    /**
     * The element currently highlighted, if any.
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
    // Position Tracking
    // ─────────────────────────────────────────────────────────────

    /**
     * Continuously align the highlight box to the target's bounding
     * rect. Cheap — only runs while a highlight is active.
     *
     * @returns {void}
     */
    _track() {

        const step = () => {

            if ( !this._box || !this._target || !this._target.isConnected ) {
                this.hide();
                return;
            }

            const rect = this._target.getBoundingClientRect();

            this._box.style.top    = `${ rect.top - 6 }px`;
            this._box.style.left   = `${ rect.left - 6 }px`;
            this._box.style.width  = `${ rect.width + 12 }px`;
            this._box.style.height = `${ rect.height + 12 }px`;

            this._rafId = requestAnimationFrame( step );

        };

        step();

    }

}

const TutorialHighlight = new TutorialHighlightClass();
export default TutorialHighlight;
