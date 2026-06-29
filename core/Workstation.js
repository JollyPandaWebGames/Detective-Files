/**
 * Workstation
 *
 * Purpose:
 *   Root orchestrator of CID OS.
 *   Controls the startup sequence and wires the global event bridge.
 *
 * Boot Sequence:
 *   1.  Theme          — CSS variables before any rendering
 *   1b. Settings       — load persisted settings, apply UI scale + animations
 *   2.  Boot screen    — visual startup animation
 *   3.  Desktop DOM    — DesktopManager builds all layers
 *   4.  App registry   — ApplicationManager discovers all apps
 *   5.  Taskbar        — TaskbarManager renders start menu + clock
 *   6.  Desktop icons  — DesktopIconManager renders icon grid
 *   7.  Window system  — WindowManager initializes
 *   8.  Event bridge   — application:requested → ApplicationManager.launch()
 *   9.  Show desktop   — fade-in
 *   10. Wallpaper      — apply persisted wallpaper after desktop is visible
 *
 * Rules:
 *   Workstation never contains gameplay or application logic.
 *   All behavior is delegated to managers and subsystems.
 */

import EventBus           from './EventBus.js';
import BootScreen         from './BootScreen.js';
import ThemeManager       from '../managers/ThemeManager.js';
import DesktopManager     from '../managers/DesktopManager.js';
import TaskbarManager     from '../managers/TaskbarManager.js';
import ApplicationManager from '../managers/ApplicationManager.js';
import WindowManager      from '../managers/WindowManager.js';
import SettingsManager    from '../managers/SettingsManager.js';

class Workstation {

    constructor() {
        /** @type {HTMLElement|null} */
        this._root = null;
    }

    /**
     * Begin the full CID OS startup sequence.
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
        await ThemeManager.initialize();

        // ── 1b. Settings ──────────────────────────────────────────
        // Must run before desktop renders so UI scale / animations
        // are applied before any layout is painted.
        SettingsManager.initialize();

        // ── 2. Boot Screen ────────────────────────────────────────
        this._injectStylesheet( './css/boot/boot.css' );
        this._injectStylesheet( './css/windows/baseapp.css' );
        const bootScreen = new BootScreen();
        await bootScreen.run( this._root );

        // ── 3. Desktop DOM ────────────────────────────────────────
        DesktopManager.initialize( this._root );

        // ── 4. Application Registry ───────────────────────────────
        await ApplicationManager.initialize();
        const installedApps = ApplicationManager.getInstalledApps();

        // ── 5. Taskbar ────────────────────────────────────────────
        TaskbarManager.initialize( DesktopManager.getTaskbar(), installedApps );

        // ── 6. Desktop Icons ──────────────────────────────────────
        DesktopManager.renderIcons( installedApps );

        // ── 7. Window System ──────────────────────────────────────
        WindowManager.initialize();

        // ── 8. Event Bridge ───────────────────────────────────────
        // Desktop icons, Start Menu items, and taskbar buttons all emit
        // 'application:requested'. This bridge routes them to ApplicationManager.
        EventBus.on( 'application:requested', ( { appId } ) => {
            ApplicationManager.launch( appId );
        } );

        // ── 9. Show Desktop ───────────────────────────────────────
        DesktopManager.show();

        // ── 10. Apply persisted wallpaper ─────────────────────────
        // Desktop must be visible before wallpaper is applied.
        SettingsManager.applyWallpaper();

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

const workstation = new Workstation();
workstation.boot();
