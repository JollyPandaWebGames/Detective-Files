/**
 * Workstation
 *
 * Purpose:
 *   The root orchestrator of Detective Files / CID OS.
 *   Controls the complete startup sequence from boot screen to desktop.
 *
 * Boot Sequence:
 *   1.  Apply theme  — CSS variables before any rendering
 *   2.  Boot screen  — visual fake OS startup
 *   3.  Desktop DOM  — DesktopManager builds layers
 *   4.  App registry — ApplicationManager loads app metadata
 *   5.  Taskbar      — TaskbarManager populates start menu + clock
 *   6.  Desktop icons — DesktopIconManager renders grid
 *   7.  Window system — WindowManager initializes (Mission 03)
 *   8.  Test windows — TestWindows launcher (Mission 03, removed in 04)
 *   9.  Show desktop — fade-in transition
 *
 * Rules:
 *   Workstation never contains gameplay logic.
 *   Workstation never knows what applications do.
 *   All UI and behavior is delegated to managers and subsystems.
 *
 * Dependencies:
 *   BootScreen         — visual boot sequence
 *   ThemeManager       — CSS variable injection
 *   DesktopManager     — desktop DOM and layers
 *   TaskbarManager     — taskbar, clock, start menu
 *   ApplicationManager — application plugin registry
 *   WindowManager      — window lifecycle (Mission 03)
 *   TestWindows        — test launcher (Mission 03 only)
 *   EventBus           — system-wide event bus
 */

import EventBus           from './EventBus.js';
import BootScreen         from './BootScreen.js';
import ThemeManager       from '../managers/ThemeManager.js';
import DesktopManager     from '../managers/DesktopManager.js';
import TaskbarManager     from '../managers/TaskbarManager.js';
import ApplicationManager from '../managers/ApplicationManager.js';
import WindowManager      from '../managers/WindowManager.js';
import TestWindows        from './TestWindows.js';

class Workstation {

    constructor() {

        /**
         * The #workstation-root DOM element.
         * @type {HTMLElement|null}
         */
        this._root = null;

    }

    /**
     * Entry point — begin the full CID OS startup sequence.
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

        // ── 1. Theme ─────────────────────────────────────────────
        // CSS variables must exist before any UI renders.
        await ThemeManager.initialize();

        // ── 2. Boot Screen ────────────────────────────────────────
        this._injectStylesheet( './css/boot/boot.css' );
        const bootScreen = new BootScreen();
        await bootScreen.run( this._root );

        // ── 3. Desktop DOM ────────────────────────────────────────
        DesktopManager.initialize( this._root );

        // ── 4. Application Registry ───────────────────────────────
        // Load before taskbar and icons — both need the full app list.
        await ApplicationManager.initialize();
        const installedApps = ApplicationManager.getInstalledApps();

        // ── 5. Taskbar ────────────────────────────────────────────
        TaskbarManager.initialize( DesktopManager.getTaskbar(), installedApps );

        // ── 6. Desktop Icons ──────────────────────────────────────
        DesktopManager.renderIcons( installedApps );

        // ── 7. Window System ──────────────────────────────────────
        // Must initialize after DesktopManager so the window layer exists.
        WindowManager.initialize();

        // ── 8. Test Windows (Mission 03 only) ─────────────────────
        // Temporary launcher — replaced by real app launch in Mission 04.
        TestWindows.initialize();

        // ── 9. Show Desktop ───────────────────────────────────────
        DesktopManager.show();

        // ── Boot Complete ─────────────────────────────────────────
        console.info( 'Workstation: CID OS ready.' );
        EventBus.emit( 'workstation:ready' );

    }

    /**
     * Inject a stylesheet link into document head (idempotent).
     *
     * @param {string} href
     * @returns {void}
     */
    _injectStylesheet( href ) {

        if ( document.querySelector( `link[href="${ href }"]` ) ) return;

        const link  = document.createElement( 'link' );
        link.rel    = 'stylesheet';
        link.href   = href;
        document.head.appendChild( link );

    }

}

// ── Entry Point ──────────────────────────────────────────────────
const workstation = new Workstation();
workstation.boot();
