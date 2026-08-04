/**
 * ApplicationContext
 *
 * Purpose:
 *   The single source of truth for the entire operating system, as
 *   specified in Epic 01 (Architecture 2.0) and refined by Epic 01.1
 *   (Active Investigation Architecture Refactor).
 *
 *   ApplicationContext is a read-oriented facade. It does not own data
 *   itself — every field it exposes is backed by an existing manager
 *   (SessionManager, ActiveInvestigationManager, SettingsManager,
 *   ThemeManager, DesktopManager, WindowManager). Its job is to give
 *   applications ONE place to read the current state of the workstation,
 *   instead of importing and coupling to many individual managers.
 *
 *   Mutating investigation state goes through this facade's own flat
 *   API (Epic 01.1 §2):
 *
 *       context.getActiveInvestigation()   // read
 *       context.hasActiveInvestigation()   // read
 *       context.startInvestigation(id)     // write
 *       context.stopInvestigation()        // write
 *
 * Responsibilities:
 *   - Aggregate read access to: currentSession, currentInvestigation,
 *     currentUser, settings, theme, language, notifications, desktop,
 *     windowState
 *   - Re-broadcast a single unified 'context:changed' event whenever any
 *     underlying piece changes, so applications can subscribe once
 *   - Provide the investigation.start/stop/complete write API
 *
 * Rules:
 *   ApplicationContext never talks to localStorage directly.
 *   ApplicationContext never contains gameplay logic — it delegates.
 *   This module is a singleton, imported by BaseApp and handed to every
 *   application instance as `this.context`.
 *
 * Migration status (Epic 01.1 — complete):
 *   Every application (Case Management, Police Mail, Messenger, Evidence,
 *   CCTV, City Map, Criminal Database, Forensics, Investigation Board)
 *   now obtains investigation data exclusively through
 *   ApplicationContext.getActiveInvestigation() and the
 *   'investigationChanged' event. None of them depend on Case Management
 *   or listen for the retired 'case:selected' event anymore — see
 *   ARCHITECTURE_2.md §7 for the full history.
 *
 * Events emitted:
 *   context:changed   { context }   — fired after any tracked change
 */

import EventBus                    from './EventBus.js';
import SessionManager              from '../managers/SessionManager.js';
import ActiveInvestigationManager  from '../managers/ActiveInvestigationManager.js';
import ObjectiveManager            from '../managers/ObjectiveManager.js';
import SettingsManager             from '../managers/SettingsManager.js';

/**
 * Minimal stand-in for a future user/profile system. No accounts,
 * authentication, or persistence beyond the rank string CaseManager
 * already tracks informally — this exists purely so `currentUser` has a
 * stable, non-null shape for applications to read today.
 */
const CURRENT_USER = {
    id:    'detective-local',
    name:  'Detective',
    rank:  'Rookie',
};

class ApplicationContextClass {

    constructor() {
        /** @type {boolean} */
        this._initialized = false;
    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Wire up the aggregated 'context:changed' broadcast. Must run after
     * SessionManager, ActiveInvestigationManager, SettingsManager, and
     * ThemeManager have all initialized.
     *
     * @returns {void}
     */
    initialize() {

        if ( this._initialized ) return;
        this._initialized = true;

        const rebroadcast = () => EventBus.emit( 'context:changed', { context: this.snapshot() } );

        EventBus.on( 'investigationStarted',    rebroadcast );
        EventBus.on( 'investigationChanged',    rebroadcast );
        EventBus.on( 'investigationStopped',    rebroadcast );
        EventBus.on( 'objective:completed',     rebroadcast );
        EventBus.on( 'objective:progress',      rebroadcast );
        EventBus.on( 'objective:phase-changed', rebroadcast );
        EventBus.on( 'settings:changed',        rebroadcast );
        EventBus.on( 'theme:changed',           rebroadcast );
        EventBus.on( 'wallpaper:changed',       rebroadcast );
        EventBus.on( 'notification:added',      rebroadcast );

    }

    // ─────────────────────────────────────────────────────────────
    // Read surface
    // ─────────────────────────────────────────────────────────────

    /** @returns {Object} The current session (see SessionManager). */
    get currentSession() {
        return SessionManager.getSession();
    }

    /** @returns {Object|null} The active InvestigationSession, or null. */
    get currentInvestigation() {
        return ActiveInvestigationManager.getActive();
    }

    /** @returns {Object} The current (local, single) user profile. */
    get currentUser() {
        return { ...CURRENT_USER };
    }

    /** @returns {Object} All current settings (SettingsManager.getAll()). */
    get settings() {
        return SettingsManager.getAll();
    }

    /** @returns {string} The active theme id. */
    get theme() {
        return SettingsManager.get( 'theme' );
    }

    /** @returns {string} The active language code. */
    get language() {
        return SettingsManager.get( 'language' );
    }

    /** @returns {Array} The current notification queue. */
    get notifications() {
        return SessionManager.getSession().notifications;
    }

    /** @returns {{wallpaper:string}} Minimal desktop state surface. */
    get desktop() {
        return { wallpaper: SettingsManager.get( 'wallpaper' ) };
    }

    /** @returns {Array<{appId:string, minimized:boolean}>} Currently open apps. */
    get windowState() {
        return SessionManager.getOpenApps();
    }

    // ─────────────────────────────────────────────────────────────
    // Investigation API (Epic 01.1)
    // ─────────────────────────────────────────────────────────────

    /**
     * Start (or resume) an investigation. Blocked outright — not a
     * confirm-and-override — if a *different* investigation is already
     * Active; see Epic 01.1 §8.
     *
     * @param {string} caseId
     * @returns {{ok:boolean, reason?:string, current?:Object}}
     */
    startInvestigation( caseId ) {
        return ActiveInvestigationManager.start( caseId );
    }

    /**
     * Stop the active investigation. Every application still holding a
     * reference to it must react to the resulting 'investigationChanged'
     * event and fall back to its empty state.
     *
     * @returns {void}
     */
    stopInvestigation() {
        ActiveInvestigationManager.stop();
    }

    /**
     * @returns {Object|null} The active InvestigationSession, or null.
     */
    getActiveInvestigation() {
        return ActiveInvestigationManager.getActive();
    }

    /** @returns {boolean} */
    hasActiveInvestigation() {
        return ActiveInvestigationManager.hasActive();
    }

    /**
     * Mission 16 — full available-objective detail (including priority),
     * for consumers that need more than InvestigationSession's flattened
     * title list — currently just the Active Investigation widget, so it
     * can highlight Critical objectives per the spec.
     *
     * @returns {Object[]}
     */
    getAvailableObjectiveDetails() {
        return ObjectiveManager.getAvailableObjectives();
    }

    /**
     * Mark the active investigation as completed.
     * @returns {void}
     */
    completeInvestigation() {
        ActiveInvestigationManager.complete();
    }

    /**
     * A single plain-object snapshot of every read field above — handy
     * for logging, the 'context:changed' payload, and save-state debugging.
     * @returns {Object}
     */
    snapshot() {
        return {
            currentSession:       this.currentSession,
            currentInvestigation: this.currentInvestigation,
            currentUser:          this.currentUser,
            settings:             this.settings,
            theme:                this.theme,
            language:             this.language,
            notifications:        this.notifications,
            desktop:              this.desktop,
            windowState:          this.windowState,
        };
    }

}

// Singleton.
const ApplicationContext = new ApplicationContextClass();

export default ApplicationContext;
