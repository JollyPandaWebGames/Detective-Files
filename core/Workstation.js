/**
 * Workstation
 *
 * Purpose:
 *   The root orchestrator of Detective Files / CID OS.
 *   Controls the complete startup sequence from boot screen to desktop.
 *
 * Boot Sequence:
 *   1. Inject boot stylesheet
 *   2. Apply theme (CSS variables must exist before any UI)
 *   3. Show boot screen
 *   4. Boot screen completes → build desktop
 *   5. Show desktop
 *   6. Load application registry (Mission 04)
 *
 * Rules:
 *   The workstation never contains gameplay logic.
 *   The workstation never knows what applications do.
 *   All UI and behavior is delegated to managers and subsystems.
 *
 * Dependencies:
 *   BootScreen         — visual boot sequence
 *   ThemeManager       — CSS variable injection
 *   DesktopManager     — desktop DOM and layers
 *   ApplicationManager — application plugin registry
 *   EventBus           — system-wide event bus
 */

import EventBus           from './EventBus.js';
import BootScreen         from './BootScreen.js';
import ThemeManager       from '../managers/ThemeManager.js';
import DesktopManager     from '../managers/DesktopManager.js';
import ApplicationManager from '../managers/ApplicationManager.js';

class Workstation {

    constructor() {

        /**
         * The #workstation-root DOM element.
         * @type {HTMLElement|null}
         */
        this._root = null;

    }

    /**
     * Entry point — begin the full startup sequence.
     *
     * @returns {Promise<void>}
     */
    async boot() {

        console.info( 'Workstation: CID OS starting...' );

        this._root = document.getElementById( 'workstation-root' );

        if ( !this._root ) {
            console.error( 'Workstation: #workstation-root not found. Aborting.' );
            return;
        }

        // ── Step 1: Apply theme before anything renders ──────────
        // CSS variables must exist before boot screen or desktop paint.
        await ThemeManager.initialize();

        // ── Step 2: Inject boot screen stylesheet ────────────────
        this._injectStylesheet( './css/boot/boot.css' );

        // ── Step 3: Run the boot sequence ────────────────────────
        const bootScreen = new BootScreen();
        await bootScreen.run( this._root );

        // ── Step 4: Build the desktop ────────────────────────────
        DesktopManager.initialize( this._root );

        // ── Step 5: Make the desktop visible ─────────────────────
        DesktopManager.show();

        // ── Step 6: Load application registry ───────────────────
        // AppLoader and ApplicationManager are initialized here so
        // DesktopManager can receive the icon list (Mission 02+).
        await ApplicationManager.initialize();

        const installedApps = ApplicationManager.getInstalledApps();
        DesktopManager.renderIcons( installedApps );

        // ── Boot complete ────────────────────────────────────────
        console.info( 'Workstation: CID OS ready.' );
        EventBus.emit( 'workstation:ready' );

    }

    /**
     * Inject a stylesheet link into document head if not already present.
     *
     * @param {string} href - Stylesheet path.
     * @returns {void}
     */
    _injectStylesheet( href ) {

        const existing = document.querySelector( `link[href="${ href }"]` );
        if ( existing ) return;

        const link  = document.createElement( 'link' );
        link.rel    = 'stylesheet';
        link.href   = href;
        document.head.appendChild( link );

    }

}

// ── Entry Point ──────────────────────────────────────────────────
const workstation = new Workstation();
workstation.boot();
