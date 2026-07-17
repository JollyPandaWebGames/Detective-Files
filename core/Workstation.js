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
 *   7b. Mail data      — MailManager loads mail JSON + persisted state
 *   7c. Case data      — CaseManager loads case JSON + persisted progress
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
import MailManager        from '../managers/MailManager.js';
import CaseManager        from '../managers/CaseManager.js';
import EvidenceManager    from '../managers/EvidenceManager.js';
import CctvManager        from '../managers/CctvManager.js';
import MapManager         from '../managers/MapManager.js';
import MessengerManager   from '../managers/MessengerManager.js';
import PeopleManager      from '../managers/PeopleManager.js';
import ForensicsManager   from '../managers/ForensicsManager.js';
import BoardManager       from '../managers/BoardManager.js';

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

        // ── 7b. Mail Data ──────────────────────────────────────────
        // Load mail JSON + persisted read/starred/archived state.
        // Runs in the background — does not block desktop visibility.
        MailManager.initialize();

        // ── 7c. Case Data ─────────────────────────────────────────
        // Load case JSON + persisted progress state.
        CaseManager.initialize();

        // ── 7d. Evidence Data ──────────────────────────────────────
        // Load persisted evidence state (pinned/notes/lastViewed).
        // Per-case evidence is loaded lazily when a case is selected.
        EvidenceManager.initialize();

        // ── 7e. CCTV Data ──────────────────────────────────────────
        // Load persisted CCTV state (bookmarks/notes/positions).
        // Per-case camera data is loaded lazily on case selection.
        CctvManager.initialize();

        // ── 7f. Map Data ───────────────────────────────────────────
        // Load persisted map state (notes, zoom, center).
        // Per-case location data is loaded lazily on case selection.
        MapManager.initialize();

        // ── 7g. Messenger Data ─────────────────────────────────────
        // Load global conversations + persisted state.
        // Case conversations are loaded lazily on case selection.
        await MessengerManager.initialize();

        // ── 7h. People Data ────────────────────────────────────────
        // Load persisted people state (pinned, notes, lastViewed).
        // Per-case data is loaded lazily on case selection.
        PeopleManager.initialize();

        // ── 7i. Forensics Data ─────────────────────────────────────
        // Load persisted queue state (submitted analyses, timestamps).
        // Per-case analysis definitions are loaded lazily on case selection.
        ForensicsManager.initialize();
        BoardManager.initialize();

        // ── 8. Event Bridge ───────────────────────────────────────
        // Desktop icons, Start Menu items, and taskbar buttons all emit
        // 'application:requested'. This bridge routes them to ApplicationManager.
        EventBus.on( 'application:requested', ( { appId } ) => {
            ApplicationManager.launch( appId );
        } );

        // Messenger conversation opened → highlight contact's profile in Criminal Database.
        EventBus.on( 'messenger:conversation-opened', ( { convId } ) => {
            const person = PeopleManager.getByConversation( convId );
            if ( person ) EventBus.emit( 'person:focus-request', { personId: person.id } );
        } );

        // Evidence selected → show related people in Criminal Database.
        EventBus.on( 'evidence:selected', ( { evidence } ) => {
            const loc = MapManager.getLocationByEvidence( evidence.id );
            if ( loc ) EventBus.emit( 'map:focus-request', { locationId: loc.id } );
            // People bridge — fired separately so Criminal Database can react.
            const people = PeopleManager.getByEvidence( evidence.id );
            if ( people.length > 0 ) {
                EventBus.emit( 'person:focus-request', { personId: people[ 0 ].id } );
            }
        } );

        // CCTV camera selected → highlight its map marker.
        EventBus.on( 'cctv:opened', ( { cameraId } ) => {
            if ( !cameraId ) return;
            const loc = MapManager.getLocationByCamera( cameraId );
            if ( loc ) EventBus.emit( 'map:focus-request', { locationId: loc.id } );
        } );
        EventBus.on( 'mail:case-mail-available', ( { firstMailId } ) => {
            ApplicationManager.launch( 'police-mail' );
            EventBus.emit( 'mail:focus-request', { mailId: firstMailId } );
        } );

        // Police Mail CCTV attachment → open CCTV Viewer at specific camera/timestamp.
        EventBus.on( 'mail:cctv-opened', ( { cameraId, timestamp } ) => {
            ApplicationManager.launch( 'cctv' );
            EventBus.emit( 'cctv:focus-request', { cameraId, timestamp } );
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
