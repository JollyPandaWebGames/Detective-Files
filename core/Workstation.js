/**
 * Workstation
 *
 * Purpose:
 *   Root orchestrator of CID OS.
 *   Controls the startup sequence and wires the global event bridge.
 *
 * Boot Sequence:
 *   0a. Splash screen    — studio/game branding, shown immediately (v1.1.0)
 *   0b. Orientation guard — landscape enforcement begins as soon as root exists
 *   1.  Theme            — CSS variables before any rendering
 *   1b. Settings         — load persisted settings, apply UI scale + animations
 *   1c. Session          — load persisted session (Architecture 2.0)
 *   2.  Boot screen      — visual startup animation
 *   3.  Desktop DOM      — DesktopManager builds all layers
 *   4.  App registry     — ApplicationManager discovers all apps
 *   5.  Taskbar          — TaskbarManager renders start menu + clock
 *   6.  Desktop icons    — DesktopIconManager renders icon grid
 *   7.  Window system    — WindowManager initializes
 *   7b. Mail data        — MailManager loads mail JSON + persisted state
 *   7c. Case data        — CaseManager loads case JSON + persisted progress
 *   7d. Active Investigation — resumes last session's active investigation
 *   7e–7k. Gameplay managers — Evidence/CCTV/Map/Messenger/People/Forensics/Board/RecycleBin
 *   7l. ApplicationContext   — wires the unified context:changed broadcast
 *   7m. Tooltip guidance     — Mission 20 subtle contextual hints
 *   8.  Event bridge     — application:requested → ApplicationManager.launch()
 *   8b. Session restore  — reopen applications left open in the last session
 *   9.  Show desktop     — fade-in
 *   9b. Investigation widget — mount the permanent Active Investigation widget
 *   10. Wallpaper        — apply persisted wallpaper after desktop is visible
 *
 * Architecture 2.0 / 1.1 (see ARCHITECTURE_2.md):
 *   ApplicationContext, SessionManager, and ActiveInvestigationManager are
 *   the foundational layer every application now depends on exclusively.
 *   As of Epic 01.1, every application (Case Management, Police Mail,
 *   Messenger, Evidence, CCTV, City Map, Criminal Database, Forensics,
 *   Investigation Board) obtains investigation data through
 *   ApplicationContext.getActiveInvestigation() and the
 *   'investigationChanged' event only — none of them depend on Case
 *   Management, and the original 'case:selected' compatibility event
 *   has been retired.
 *
 * Rules:
 *   Workstation never contains gameplay or application logic.
 *   All behavior is delegated to managers and subsystems.
 */

import EventBus                    from './EventBus.js';
import BootScreen                  from './BootScreen.js';
import SplashScreen                from './SplashScreen.js';
import ApplicationContext          from './ApplicationContext.js';
import ThemeManager                from '../managers/ThemeManager.js';
import DesktopManager              from '../managers/DesktopManager.js';
import TaskbarManager              from '../managers/TaskbarManager.js';
import ApplicationManager          from '../managers/ApplicationManager.js';
import WindowManager               from '../managers/WindowManager.js';
import SettingsManager             from '../managers/SettingsManager.js';
import SessionManager              from '../managers/SessionManager.js';
import ActiveInvestigationManager  from '../managers/ActiveInvestigationManager.js';
import InvestigationWidgetManager  from '../managers/InvestigationWidgetManager.js';
import MailManager                 from '../managers/MailManager.js';
import CaseManager                 from '../managers/CaseManager.js';
import EvidenceManager             from '../managers/EvidenceManager.js';
import CctvManager                 from '../managers/CctvManager.js';
import MapManager                  from '../managers/MapManager.js';
import MessengerManager            from '../managers/MessengerManager.js';
import PeopleManager               from '../managers/PeopleManager.js';
import ForensicsManager            from '../managers/ForensicsManager.js';
import BoardManager                from '../managers/BoardManager.js';
import RecycleBinManager           from '../managers/RecycleBinManager.js';
import TooltipManager              from '../managers/TooltipManager.js';
import VersionManager              from '../managers/VersionManager.js';
import TutorialManager             from '../managers/TutorialManager.js';
import OrientationGuard            from '../utils/OrientationGuard.js';

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

        // ── 0a. Splash Screen ───────────────────────────────────────
        // Appears immediately, before anything else — studio branding
        // + version. Waits on VersionManager so the version shown is
        // always real. See docs/SPLASH_SCREEN.md.
        this._injectStylesheet( './css/boot/splash.css' );
        const splashScreen = new SplashScreen();
        await splashScreen.run( this._root, VersionManager.initialize() );

        // ── 0b. Orientation Guard ───────────────────────────────────
        // Landscape-only enforcement begins as soon as the root exists,
        // so a portrait phone/tablet is blocked before anything else
        // renders underneath it. See docs/PLATFORM_REQUIREMENTS.md.
        this._injectStylesheet( './css/orientation/orientation.css' );
        OrientationGuard.initialize( this._root );

        // ── 1. Theme ─────────────────────────────────────────────
        await ThemeManager.initialize();

        // ── 1b. Settings ──────────────────────────────────────────
        // Must run before desktop renders so UI scale / animations
        // are applied before any layout is painted.
        SettingsManager.initialize();

        // ── 1c. Session ───────────────────────────────────────────
        // Architecture 2.0 — load any persisted session pointer before
        // anything else needs to know whether an investigation was
        // previously active.
        SessionManager.initialize();

        // ── 2. Boot Screen ────────────────────────────────────────
        this._injectStylesheet( './css/boot/boot.css' );
        this._injectStylesheet( './css/windows/baseapp.css' );
        this._injectStylesheet( './css/widgets/investigation-widget.css' );
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

        // ── 7d. Active Investigation ──────────────────────────────
        // Re-affirm whatever investigation was active last session.
        // Emits 'investigationChanged' so every application below
        // reloads its data via ApplicationContext (Epic 01.1). Also
        // resumes that case's objective graph via ObjectiveManager
        // (Mission 16) — see ARCHITECTURE_2.md §12.
        ActiveInvestigationManager.initialize();

        // ── 7e. Evidence Data ──────────────────────────────────────
        // Load persisted evidence state (pinned/notes/lastViewed).
        // Per-case evidence is loaded lazily when a case is selected.
        EvidenceManager.initialize();

        // ── 7f. CCTV Data ──────────────────────────────────────────
        // Load persisted CCTV state (bookmarks/notes/positions).
        // Per-case camera data is loaded lazily on case selection.
        CctvManager.initialize();

        // ── 7g. Map Data ───────────────────────────────────────────
        // Load persisted map state (notes, zoom, center).
        // Per-case location data is loaded lazily on case selection.
        MapManager.initialize();

        // ── 7h. Messenger Data ─────────────────────────────────────
        // Load global conversations + persisted state.
        // Case conversations are loaded lazily on case selection.
        await MessengerManager.initialize();

        // ── 7i. People Data ────────────────────────────────────────
        // Load persisted people state (pinned, notes, lastViewed).
        // Per-case data is loaded lazily on case selection.
        PeopleManager.initialize();

        // ── 7j. Forensics Data ─────────────────────────────────────
        // Load persisted queue state (submitted analyses, timestamps).
        // Per-case analysis definitions are loaded lazily on case selection.
        ForensicsManager.initialize();
        BoardManager.initialize();
        RecycleBinManager.initialize();

        // ── 7l. Application Context ───────────────────────────────
        // Architecture 2.0 — wires the unified 'context:changed' broadcast.
        // Must run after every manager it aggregates has initialized.
        ApplicationContext.initialize();

        // ── 7m. Tooltips ───────────────────────────────────────────
        // Mission 20 — subtle contextual guidance. Listens for
        // 'investigationChanged' itself; no case-specific wiring needed.
        TooltipManager.initialize();

        // ── 7n. Tutorial ───────────────────────────────────────────
        // Data-driven, two-detective Case 00 tutorial (v2.0.0). Loads
        // its dialogue JSON and wires its own 'workstation:ready' /
        // 'investigationStarted' triggers — see docs/TUTORIAL_SYSTEM.md.
        await TutorialManager.initialize();

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

        // ── 8b. Session Restore ───────────────────────────────────
        // Reopen every application that was open in the last session so
        // refreshing the page restores the complete detective workspace.
        // Apps only subscribe to 'investigationChanged' inside their own
        // open(), which just ran for the first time — rebroadcast so
        // they receive the investigation that's already active rather
        // than showing an empty state.
        ApplicationManager.restoreSession();
        ActiveInvestigationManager.rebroadcast();

        // ── 9. Show Desktop ───────────────────────────────────────
        DesktopManager.show();

        // ── 9b. Investigation Widget ──────────────────────────────
        // Architecture 2.0 — permanent, non-closable desktop widget.
        InvestigationWidgetManager.initialize( DesktopManager.getDesktopElement() );

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
