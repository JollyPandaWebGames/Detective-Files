/**
 * SplashScreen
 *
 * Purpose:
 *   The very first thing the player sees. Shows studio branding,
 *   the game name, and the current version before CID OS boots.
 *
 * Responsibilities:
 *   - Build and mount the splash DOM
 *   - Hold for a short, professional duration (or until loading
 *     work passed in by the caller resolves — whichever is longer)
 *   - Fade out and resolve when complete
 *
 * Rules:
 *   SplashScreen is purely presentational — no gameplay or manager
 *   logic lives here. It never reads localStorage or case data.
 *   Version text comes exclusively from VersionManager — see
 *   docs/VERSIONING.md and docs/SPLASH_SCREEN.md.
 *
 * Dependencies:
 *   VersionManager — for the version string shown on the splash.
 */

import VersionManager from '../managers/VersionManager.js';

// Studio branding — matches Settings → About (apps/settings/index.js).
const STUDIO_NAME = 'Jolly Panda Studio';

// Minimum time the splash stays visible so it never feels like a flash.
const MIN_VISIBLE_DURATION = 1500;

// Absolute ceiling — if real loading work is still pending past this,
// the splash still exits so the player is never stuck.
const MAX_VISIBLE_DURATION = 3000;

// Fade-out duration (must match CSS .splash-screen--fading transition).
const FADE_DURATION = 300;

class SplashScreen {

    constructor() {

        /** @type {HTMLElement|null} */
        this._element = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Mount the splash screen and hold it for a short, professional
     * duration. Optionally waits on real startup work (e.g. loading
     * VERSION.json) without extending the display past MAX_VISIBLE_DURATION.
     *
     * @param {HTMLElement}   root         - The workstation root container.
     * @param {Promise<any>} [loadingWork] - Optional work to wait on.
     * @returns {Promise<void>}
     */
    async run( root, loadingWork = Promise.resolve() ) {

        this._build( root );

        const minHold = new Promise( resolve => setTimeout( resolve, MIN_VISIBLE_DURATION ) );
        const maxHold = new Promise( resolve => setTimeout( resolve, MAX_VISIBLE_DURATION ) );

        // Wait for the minimum hold AND the real loading work, but never
        // longer than the maximum ceiling.
        await Promise.race( [
            Promise.all( [ minHold, loadingWork ] ),
            maxHold,
        ] );

        await this._exit();

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build and mount the splash DOM.
     *
     * @param {HTMLElement} root
     * @returns {void}
     */
    _build( root ) {

        this._element = document.createElement( 'div' );
        this._element.className = 'splash-screen';
        this._element.setAttribute( 'aria-hidden', 'true' );

        const displayVersion = VersionManager.getDisplayVersion();

        this._element.innerHTML = `
            <div class="splash-screen__content">
                <img class="splash-screen__studio-logo" src="./assets/branding/jolly-panda-logo.png" alt="" />
                <div class="splash-screen__studio-name">${ STUDIO_NAME }</div>
                <div class="splash-screen__presents">presents</div>

                <div class="splash-screen__divider"></div>

                <div class="splash-screen__game-badge">🕵️</div>
                <div class="splash-screen__game-title">DETECTIVE FILES</div>
                <div class="splash-screen__game-version">${ displayVersion }</div>

                <div class="splash-screen__spinner" aria-hidden="true"></div>
            </div>
        `;

        root.appendChild( this._element );

        // Trigger fade-in on next frame.
        requestAnimationFrame( () => {
            this._element.classList.add( 'splash-screen--visible' );
        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Exit
    // ─────────────────────────────────────────────────────────────

    /**
     * Fade out and remove the splash screen.
     *
     * @returns {Promise<void>}
     */
    _exit() {

        return new Promise( resolve => {

            if ( !this._element ) {
                resolve();
                return;
            }

            this._element.classList.add( 'splash-screen--fading' );

            setTimeout( () => {
                if ( this._element && this._element.parentNode ) {
                    this._element.parentNode.removeChild( this._element );
                }
                this._element = null;
                resolve();
            }, FADE_DURATION );

        } );

    }

}

export default SplashScreen;
