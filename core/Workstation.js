/**
 * Workstation
 *
 * Purpose:
 *   The root orchestrator of Detective Files / CID OS.
 *   Controls the complete startup sequence from boot screen to desktop.
 *
 * Boot Sequence:
 *   1. Apply theme (CSS variables before any UI renders)
 *   2. Run boot screen
 *   3. Build desktop DOM (DesktopManager)
 *   4. Initialize taskbar with installed app list (TaskbarManager)
 *   5. Render desktop icons (DesktopIconManager via DesktopManager)
 *   6. Show desktop
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
 *   EventBus           — system-wide event bus
 */

import EventBus            from './EventBus.js';
import BootScreen          from './BootScreen.js';
import ThemeManager        from '../managers/ThemeManager.js';
import DesktopManager      from '../managers/DesktopManager.js';
import TaskbarManager      from '../managers/TaskbarManager.js';
import ApplicationManager  from '../managers/ApplicationManager.js';

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
        // CSS variables must exist before boot screen renders.
        await ThemeManager.initialize();

        // ── 2. Boot Screen ────────────────────────────────────────
        this._injectStylesheet( './css/boot/boot.css' );
        const bootScreen = new BootScreen();
        await bootScreen.run( this._root );

        // ── 3. Desktop DOM ────────────────────────────────────────
        DesktopManager.initialize( this._root );

        // ── 4. Application Registry ───────────────────────────────
        // Must load before taskbar and icons so both get the full app list.
        await ApplicationManager.initialize();
        const installedApps = ApplicationManager.getInstalledApps();

        // ── 5. Taskbar ────────────────────────────────────────────
        TaskbarManager.initialize( DesktopManager.getTaskbar(), installedApps );

        // ── 6. Desktop Icons ──────────────────────────────────────
        DesktopManager.renderIcons( installedApps );

        // ── 7. Show Desktop ───────────────────────────────────────
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
