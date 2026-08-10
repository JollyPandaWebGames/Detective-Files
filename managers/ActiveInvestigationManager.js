/**
 * ActiveInvestigationManager
 *
 * Purpose:
 *   The single authority for "which investigation is currently active."
 *   Implements Epic 01.1 — Active Investigation Architecture Refactor.
 *
 *   CaseManager remains the source of truth for case *definition* data
 *   (loading case JSON, persisting per-case progress). This manager owns
 *   the player's live *session* on top of it — see core/InvestigationSession.js
 *   for why the two are kept distinct.
 *
 * State machine:
 *   Locked  ──▶  Available  ──▶  Active  ──▶  Completed
 *                                   │
 *                                   ▼
 *                               Archived
 *
 * Responsibilities:
 *   - Own the single InvestigationSession (or null)
 *   - Enforce that only one investigation may be active — starting a
 *     second one while another is Active is BLOCKED outright (not a
 *     confirm-and-override dialog — see Epic 01.1 §8)
 *   - Delegate all case *data* operations to CaseManager
 *   - Emit investigationStarted / investigationChanged / investigationStopped
 *
 * Events emitted:
 *   investigationStarted   { investigation }
 *   investigationChanged   { investigation }   — fired after every transition,
 *                                                 including null on stop
 *   investigationStopped   { investigationId }
 *
 * Rules:
 *   Applications never call CaseManager.startCase() directly — they call
 *   ApplicationContext.startInvestigation(caseId).
 *   This manager never accesses localStorage — it delegates persistence
 *   of the *pointer* to SessionManager and persistence of case *data* to
 *   CaseManager.
 */

import CaseManager                    from './CaseManager.js';
import SessionManager                 from './SessionManager.js';
import ObjectiveManager               from './ObjectiveManager.js';
import ResolutionManager              from './ResolutionManager.js';
import StateMachineManager            from './StateMachineManager.js';
import UnlockManager                   from './UnlockManager.js';
import TooltipManager                  from './TooltipManager.js';
import BoardManager                    from './BoardManager.js';
import EvidenceManager                 from './EvidenceManager.js';
import CctvManager                     from './CctvManager.js';
import ForensicsManager                from './ForensicsManager.js';
import PeopleManager                   from './PeopleManager.js';
import MessengerManager                from './MessengerManager.js';
import MailManager                     from './MailManager.js';
import EventBus                        from '../core/EventBus.js';
import { createInvestigationSession }  from '../core/InvestigationSession.js';

class ActiveInvestigationManagerClass {

    constructor() {
        /** @type {boolean} */
        this._loaded = false;

        /**
         * The live session for the active investigation, or null.
         * Rebuilt from CaseManager + SessionManager on every transition
         * rather than cached indefinitely, so `progress` etc. stay fresh.
         * @type {Object|null}
         */
        this._session = null;
    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Re-affirm whatever investigation was active in the last session
     * (if any). Must run after both CaseManager and SessionManager have
     * finished loading their own data.
     *
     * @returns {void}
     */
    initialize() {

        if ( this._loaded ) return;
        this._loaded = true;

        const saved = SessionManager.getActiveSessionPointer();
        if ( !saved ) return;

        const c = CaseManager.getById( saved.caseId );

        // Defensive: the saved id may point at a case that no longer
        // exists, or one that somehow ended up Locked since — don't
        // resume into an invalid state.
        if ( !c || c.status === 'Locked' ) {
            SessionManager.setActiveSessionPointer( null );
            return;
        }

        this._session = createInvestigationSession( c, this._statusFor( c ), saved.startedAt );

        // Mission 16 — resume the objective graph along with the session.
        ObjectiveManager.loadForCase( saved.caseId );

        // Mission 17 — resume the case's solution + resolution attempts.
        ResolutionManager.loadForCase( saved.caseId );

        // Mission 18 — resume the investigation state machine.
        StateMachineManager.loadForCase( saved.caseId );

        // Mission 19 — resume this case's unlock rules.
        UnlockManager.loadForCase( saved.caseId );

        EventBus.emit( 'investigationChanged', { investigation: this.getActive() } );

    }

    /**
     * Re-emit the current investigation without changing any state.
     * Used by Workstation right after ApplicationManager.restoreSession()
     * re-opens applications — those apps only subscribe to
     * 'investigationChanged' inside their own open(), which runs *after*
     * initialize()'s original broadcast, so they'd otherwise miss it on
     * a page refresh. Also relied on by applications' own synchronous
     * getActiveInvestigation() check on open(), so this is a safety net
     * rather than the primary path.
     *
     * @returns {void}
     */
    rebroadcast() {
        if ( !this._session ) return;
        EventBus.emit( 'investigationChanged', { investigation: this.getActive() } );
    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return the active InvestigationSession, freshly synced with
     * CaseManager's current progress/status, or null if none is active.
     *
     * @returns {Object|null}
     */
    getActive() {

        if ( !this._session ) return null;

        const c = CaseManager.getById( this._session.caseId );
        if ( !c ) return null;

        // Keep progress/status/solved live without discarding session
        // identity (investigationId, startedAt, objective tracking).
        this._session.status   = this._statusFor( c );
        this._session.progress = c.progress ?? 0;
        this._session.solved   = c.status === 'Solved';
        this._session.currentObjectives = c.objectives ?? [];

        // Mission 16 — Objective Engine. When this case has a live
        // objective graph loaded, it supersedes the static placeholder
        // fields InvestigationSession otherwise falls back to.
        if ( ObjectiveManager.hasGraph() ) {
            const objProgress = ObjectiveManager.getProgress();
            this._session.progress             = objProgress.progress;
            this._session.solved               = objProgress.requiredComplete;
            this._session.currentObjectives    = ObjectiveManager.getAvailableObjectives().map( o => o.title );
            this._session.completedObjectives  = ObjectiveManager.getCompletedObjectives().map( o => o.title );
        }

        return { ...this._session };

    }

    /** @returns {boolean} */
    hasActive() {
        return this._session !== null;
    }

    // ─────────────────────────────────────────────────────────────
    // Mutations
    // ─────────────────────────────────────────────────────────────

    /**
     * Start (or resume) an investigation.
     *
     * If a *different* investigation is already Active, this is BLOCKED
     * outright — per Epic 01.1 §8, there is no confirm-and-switch
     * override anymore. The caller must stop the current investigation
     * first.
     *
     * @param {string} caseId
     * @returns {{ok:boolean, reason?:string, current?:Object}}
     */
    start( caseId ) {

        const c = CaseManager.getById( caseId );
        if ( !c ) return { ok: false, reason: 'not-found' };
        if ( c.status === 'Locked' ) return { ok: false, reason: 'locked' };

        if ( this._session && this._session.caseId !== caseId && this._session.status === 'Active' ) {
            return { ok: false, reason: 'blocked', current: this.getActive() };
        }

        CaseManager.startCase( caseId );

        const startedAt = Date.now();
        this._session = createInvestigationSession( CaseManager.getById( caseId ), 'Active', startedAt );

        SessionManager.setActiveSessionPointer( { caseId, startedAt } );

        if ( c.replayable ) {
            // Case 00 replay support — every application (Evidence,
            // CCTV, Forensics, Messenger, Criminal Database, Board) and
            // TooltipManager lazily call their own manager's
            // loadForCase() when they observe investigationChanged, so
            // that event must NOT fire until every manager's
            // resetForCase() has actually finished — otherwise an app
            // could reload stale cached data a moment before the reset
            // clears it. See _resetThenStart() below.
            this._resetThenStart( caseId );
            return { ok: true };
        }

        // Mission 16 — fire-and-forget, consistent with every other
        // per-case manager's loadForCase() pattern; 'objective:loaded'
        // and 'objective:progress' fire once the fetch resolves.
        ObjectiveManager.loadForCase( caseId );

        // Mission 17 — load this case's solution.json, if it has one.
        ResolutionManager.loadForCase( caseId );

        // Mission 18 — load this case's investigation state machine.
        StateMachineManager.loadForCase( caseId );

        // Mission 19 — load this case's unlock rules.
        UnlockManager.loadForCase( caseId );

        const investigation = this.getActive();

        EventBus.emit( 'investigationStarted', { investigation } );
        EventBus.emit( 'investigationChanged', { investigation } );

        return { ok: true };

    }

    /**
     * Case 00 replay support. Wipes every manager's persisted state for
     * `caseId`, then loads it fresh and only THEN emits
     * investigationStarted/investigationChanged — so every listener
     * (apps' own loadForCase() calls, TooltipManager) sees clean state
     * the first time it reacts, never a stale cache.
     *
     * Not awaited by start() — start() already returns synchronously
     * before any per-case data is loaded even in the non-replayable
     * path (loadForCase() calls there are fire-and-forget too), so
     * callers already have to treat "started" and "data loaded" as
     * separate moments; this just makes that gap slightly longer for
     * replayable cases specifically.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async _resetThenStart( caseId ) {

        await Promise.all( [
            ObjectiveManager.resetForCase( caseId ),
            ResolutionManager.resetForCase( caseId ),
            StateMachineManager.resetForCase( caseId ),
            UnlockManager.resetForCase( caseId ),
            TooltipManager.resetForCase( caseId ),
            BoardManager.resetForCase( caseId ),
            EvidenceManager.resetForCase( caseId ),
            CctvManager.resetForCase( caseId ),
            ForensicsManager.resetForCase( caseId ),
            PeopleManager.resetForCase( caseId ),
            MessengerManager.resetForCase( caseId ),
            MailManager.resetForCase( caseId ),
        ] );

        ObjectiveManager.loadForCase( caseId );
        ResolutionManager.loadForCase( caseId );
        StateMachineManager.loadForCase( caseId );
        UnlockManager.loadForCase( caseId );

        const investigation = this.getActive();

        EventBus.emit( 'investigationStarted', { investigation } );
        EventBus.emit( 'investigationChanged', { investigation } );

    }

    /**
     * Destroy the active InvestigationSession and clear all global state.
     * The underlying case's own status/progress in CaseManager is left
     * untouched — stopping is about the session, not the case data.
     *
     * @returns {void}
     */
    stop() {

        if ( !this._session ) return;

        const investigationId = this._session.investigationId;

        this._session = null;
        SessionManager.setActiveSessionPointer( null );
        ObjectiveManager.unloadCase();
        ResolutionManager.unloadCase();
        StateMachineManager.unloadCase();
        UnlockManager.unloadCase();

        EventBus.emit( 'investigationStopped', { investigationId } );
        EventBus.emit( 'investigationChanged', { investigation: null } );

    }

    /**
     * Mark the active investigation as completed. Per design, the
     * completed investigation remains the active session (still shown
     * in the widget/apps) until it is explicitly stopped or a new one
     * is started.
     *
     * @returns {void}
     */
    complete() {

        if ( !this._session ) return;

        CaseManager.completeCase( this._session.caseId );
        this._session.status = 'Completed';
        this._session.solved = true;

        const investigation = this.getActive();

        EventBus.emit( 'investigationChanged', { investigation } );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * Map a CaseManager status onto the session's simpler status set.
     * @param {Object} c
     * @returns {string}
     */
    _statusFor( c ) {
        if ( c.status === 'Solved' )   return 'Completed';
        if ( c.status === 'Archived' ) return 'Archived';
        return 'Active';
    }

}

// Singleton.
const ActiveInvestigationManager = new ActiveInvestigationManagerClass();

export default ActiveInvestigationManager;
