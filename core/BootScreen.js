/**
 * BootScreen
 *
 * Purpose:
 *   Renders the CID OS boot sequence and manages its lifecycle.
 *   Displays simulated system initialization messages, then transitions
 *   to the desktop.
 *
 * Responsibilities:
 *   - Build and mount the boot screen DOM
 *   - Play through boot log lines with timed delays
 *   - Animate the progress bar
 *   - Fade out and call back when complete
 *
 * Rules:
 *   BootScreen is purely visual — no real loading happens here.
 *   It must never know about applications, managers, or cases.
 *   It resolves a Promise when the sequence is complete.
 *
 * Dependencies:
 *   None — BootScreen is self-contained.
 */

// Boot messages shown in sequence.
// Each entry: { text, delay (ms before appearing), isLast }
const BOOT_LINES = [
    { text: 'Initializing system hardware...',         delay: 200  },
    { text: 'Loading security module...',              delay: 600  },
    { text: 'Mounting investigation database...',      delay: 500  },
    { text: 'Loading forensics subsystem...',          delay: 500  },
    { text: 'Establishing secure connection...',       delay: 600  },
    { text: 'Loading workstation environment...',      delay: 500  },
    { text: 'CID OS ready.',                           delay: 400  },
];

// Total boot duration drives the progress bar width steps.
const TOTAL_BOOT_DELAY = BOOT_LINES.reduce( ( sum, line ) => sum + line.delay, 0 );

// How long the "ready" state is visible before transitioning.
const HOLD_AFTER_READY = 600;

// Fade-out animation duration (must match CSS .boot-screen--fading transition).
const FADE_DURATION = 250;

class BootScreen {

    constructor() {

        /**
         * Root element of the boot screen.
         * @type {HTMLElement|null}
         */
        this._element = null;

        /**
         * The log container where lines are appended.
         * @type {HTMLElement|null}
         */
        this._logContainer = null;

        /**
         * The progress bar fill element.
         * @type {HTMLElement|null}
         */
        this._progressFill = null;

        /**
         * All active setTimeout ids, stored for cleanup.
         * @type {number[]}
         */
        this._timers = [];

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Mount the boot screen into the given root element and begin the sequence.
     * Resolves when the boot sequence is fully complete and faded out.
     *
     * @param {HTMLElement} root - The workstation root container.
     * @returns {Promise<void>}
     */
    run( root ) {

        return new Promise( ( resolve ) => {

            this._build( root );
            this._playSequence( resolve );

        } );

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build and mount the boot screen DOM.
     *
     * @param {HTMLElement} root
     * @returns {void}
     */
    _build( root ) {

        this._element = document.createElement( 'div' );
        this._element.className = 'boot-screen';
        this._element.setAttribute( 'aria-live', 'polite' );
        this._element.setAttribute( 'aria-label', 'CID OS boot sequence' );

        this._element.innerHTML = `
            <div class="boot-screen__panel">

                <div class="boot-screen__title">CID OS v1.0</div>
                <div class="boot-screen__subtitle">Criminal Investigation Department</div>

                <div class="boot-screen__log" id="boot-log"></div>

                <div class="boot-screen__progress-wrap">
                    <div class="boot-screen__progress-fill" id="boot-progress"></div>
                </div>

                <div class="boot-screen__footer">
                    CLASSIFIED — AUTHORIZED PERSONNEL ONLY
                </div>

            </div>
        `;

        root.appendChild( this._element );

        this._logContainer  = this._element.querySelector( '#boot-log' );
        this._progressFill  = this._element.querySelector( '#boot-progress' );

    }

    // ─────────────────────────────────────────────────────────────
    // Sequence Playback
    // ─────────────────────────────────────────────────────────────

    /**
     * Schedule all boot log lines and the final transition.
     *
     * @param {Function} resolve - Called when the full sequence ends.
     * @returns {void}
     */
    _playSequence( resolve ) {

        let elapsed = 0;

        BOOT_LINES.forEach( ( line, index ) => {

            elapsed += line.delay;

            const timer = setTimeout( () => {

                this._appendLine( line.text, index === BOOT_LINES.length - 1 );
                this._updateProgress( elapsed );

            }, elapsed );

            this._timers.push( timer );

        } );

        // After all lines are shown, hold briefly then fade out.
        const exitTimer = setTimeout( () => {
            this._exit( resolve );
        }, elapsed + HOLD_AFTER_READY );

        this._timers.push( exitTimer );

    }

    /**
     * Append a log line to the boot screen.
     *
     * @param {string}  text   - The line text.
     * @param {boolean} isLast - If true, styled as the final ready line.
     * @returns {void}
     */
    _appendLine( text, isLast ) {

        if ( !this._logContainer ) return;

        // Mark previous lines as completed.
        const previous = this._logContainer.querySelectorAll( '.boot-screen__log-line--active' );
        previous.forEach( el => {
            el.classList.remove( 'boot-screen__log-line--active' );
            el.classList.add( 'boot-screen__log-line--ok' );
        } );

        const line = document.createElement( 'div' );

        line.className = [
            'boot-screen__log-line',
            'boot-screen__log-line--active',
            isLast ? 'boot-screen__log-line--ready' : '',
        ].join( ' ' ).trim();

        line.textContent = text;

        this._logContainer.appendChild( line );

        // Trigger fade-in on next frame.
        requestAnimationFrame( () => {
            line.classList.add( 'boot-screen__log-line--visible' );
        } );

    }

    /**
     * Update the progress bar based on elapsed time vs total duration.
     *
     * @param {number} elapsed - Milliseconds elapsed so far.
     * @returns {void}
     */
    _updateProgress( elapsed ) {

        if ( !this._progressFill ) return;

        const percent = Math.min( ( elapsed / TOTAL_BOOT_DELAY ) * 100, 100 );
        this._progressFill.style.width = `${ percent }%`;

    }

    /**
     * Fade out the boot screen and resolve the Promise.
     *
     * @param {Function} resolve
     * @returns {void}
     */
    _exit( resolve ) {

        if ( !this._element ) return;

        this._element.classList.add( 'boot-screen--fading' );

        setTimeout( () => {
            this._destroy();
            resolve();
        }, FADE_DURATION );

    }

    // ─────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────

    /**
     * Remove the boot screen from the DOM and clear all timers.
     *
     * @returns {void}
     */
    _destroy() {

        this._timers.forEach( id => clearTimeout( id ) );
        this._timers = [];

        if ( this._element && this._element.parentNode ) {
            this._element.parentNode.removeChild( this._element );
        }

        this._element       = null;
        this._logContainer  = null;
        this._progressFill  = null;

    }

}

export default BootScreen;
