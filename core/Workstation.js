/**
 * Workstation
 *
 * Purpose:
 *   The root orchestrator of Detective Files.
 *   Responsible for booting the workstation environment in the correct order.
 *
 * Responsibilities:
 *   - Mount the workstation into the DOM
 *   - Initialize all managers in dependency order
 *   - Coordinate the startup sequence
 *   - Expose no gameplay logic whatsoever
 *
 * Rules:
 *   The workstation never knows what applications do.
 *   The workstation never contains case or gameplay logic.
 *   All UI and behavior is delegated to managers and applications.
 *
 * Dependencies:
 *   EventBus            — must boot first
 *   StorageManager      — must boot before other managers
 *   ThemeManager        — applies visual configuration early
 *   ApplicationManager  — discovers and loads applications
 *   DesktopManager      — renders the desktop environment
 *   WindowManager       — manages all application windows
 */

import EventBus            from './EventBus.js';
import StorageManager      from '../managers/StorageManager.js';
import ThemeManager        from '../managers/ThemeManager.js';
import ApplicationManager  from '../managers/ApplicationManager.js';
import DesktopManager      from '../managers/DesktopManager.js';
import WindowManager       from '../managers/WindowManager.js';

class Workstation {

    constructor() {

        /**
         * The root DOM element the workstation mounts into.
         * @type {HTMLElement|null}
         */
        this._root = null;

    }

    /**
     * Boot the workstation.
     * Initializes all subsystems in the correct dependency order.
     *
     * @returns {Promise<void>}
     */
    async boot() {

        console.info( 'Workstation: Booting Detective Files...' );

        this._root = document.getElementById( 'workstation-root' );

        if ( !this._root ) {
            console.error( 'Workstation: Root element #workstation-root not found. Aborting boot.' );
            return;
        }

        // ── Boot Sequence ────────────────────────────────────────
        // Order matters. Do not reorder without understanding dependencies.

        // 1. Apply theme CSS variables before any UI renders.
        await ThemeManager.initialize();

        // 2. Discover and load all application plugins.
        await ApplicationManager.initialize();

        // 3. Initialize the desktop environment.
        //    (Desktop UI implementation added in Mission 01-02.)
        DesktopManager.initialize( this._root );

        // 4. Populate desktop icons from installed applications.
        const installedApps = ApplicationManager.getInstalledApps();
        DesktopManager.renderIcons( installedApps );

        // ── Boot Complete ────────────────────────────────────────
        console.info( 'Workstation: Boot complete.' );
        EventBus.emit( 'workstation:ready' );

    }

}

// ── Entry Point ──────────────────────────────────────────────────
// Instantiate and boot the workstation when the module loads.

const workstation = new Workstation();
workstation.boot();
