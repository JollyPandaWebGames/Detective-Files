/**
 * StateMachineManager
 *
 * Purpose:
 *   Mission 18 — Investigation State Machine. Turns a case's states.json
 *   into a live, single-active-state FSM: transitions fire from real
 *   EventBus events, elapsed timers, or manual triggers; entering a
 *   state runs its actions and rolls its random events from a persisted
 *   seed. No investigation-specific logic — every case supplies its own
 *   states.json. See docs/ARCHITECTURE_2.md §14 for full design notes.
 *
 * Storage key: 'state-machine:{caseId}'
 *
 * Events emitted:
 *   state:entered / state:exited / state:transition
 *   state:timer-started / state:timer-finished
 *   content:unlocked   — see StateActions for why this doesn't yet gate
 *                        anything (Mission 19's job)
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Applications never import this manager directly — they react via
 *   ApplicationContext's 'context:changed', same as Mission 16/17.
 */

import StorageManager                          from './StorageManager.js';
import EventBus                                 from '../core/EventBus.js';
import SessionManager                           from './SessionManager.js';
import MailManager                              from './MailManager.js';
import { triggerMatchesEvent }                  from '../core/state-machine/StateTransitionMatcher.js';
import { executeStateActions }                  from '../core/state-machine/StateActions.js';
import { rollRandomEvents }                     from '../core/state-machine/RandomEventEngine.js';
import StateTimerScheduler                       from '../core/state-machine/StateTimerScheduler.js';
import { buildHqMail }                            from '../core/state-machine/HqMailBuilder.js';

const CASE_BASE = './data/cases/';

class StateMachineManagerClass {

    constructor() {

        /** @type {string|null} */
        this._caseId = null;

        /** id -> state definition. @type {Map<string,Object>} */
        this._states = new Map();

        /** @type {string|null} */
        this._currentStateId = null;

        /** @type {Object[]} */
        this._history = [];

        /** @type {number} */
        this._randomSeed = 1;

        /** Live timer bookkeeping for the current state. */
        this._scheduler = new StateTimerScheduler();

        /** Persisted timer records (survive refresh). @type {Object[]} */
        this._pendingTimers = [];

        /** Event handlers wired for the current state's transitions only. @type {Map<string,Function>} */
        this._activeHandlers = new Map();

    }

    // ─────────────────────────────────────────────────────────────
    // Loading
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        this.unloadCase();
        this._caseId = caseId;

        const res = await fetch( `${ CASE_BASE }${ caseId }/states.json` );
        if ( !res.ok ) {
            console.warn( `StateMachineManager: no states.json for "${ caseId }" — skipping.` );
            return;
        }
        const data = await res.json();
        ( data.states ?? [] ).forEach( s => this._states.set( s.id, s ) );

        const saved = StorageManager.load( this._storageKey(), null );

        if ( saved ) {
            this._history         = saved.history ?? [];
            this._randomSeed      = saved.randomSeed ?? 1;
            this._pendingTimers   = saved.pendingTimers ?? [];
            this._currentStateId  = saved.currentStateId ?? null;
            this._resumeState();
        }
        else {
            const initial = [ ...this._states.values() ].find( s => s.initial );
            if ( initial ) this._activateState( initial.id, { reason: 'initial', triggeredBy: null } );
        }

    }

    /** @returns {void} */
    unloadCase() {

        this._teardownCurrentState();

        this._caseId          = null;
        this._states           = new Map();
        this._currentStateId  = null;
        this._history          = [];
        this._randomSeed       = 1;
        this._pendingTimers    = [];

    }

    // ─────────────────────────────────────────────────────────────
    // Resume (page refresh survival)
    // ─────────────────────────────────────────────────────────────

    /**
     * Re-wire the current state's transition listeners and reconcile its
     * timers against wall-clock time — a timer whose end time has
     * already passed fires immediately (catch-up), one still pending
     * resumes with only its remaining duration, not the full delay.
     *
     * @returns {void}
     */
    _resumeState() {

        if ( !this._currentStateId ) return;

        const state = this._states.get( this._currentStateId );
        if ( !state ) return;

        this._wireTransitionListeners( state );

        const timers = this._pendingTimers.filter( t => t.stateId === this._currentStateId );
        this._pendingTimers = this._pendingTimers.filter( t => t.stateId !== this._currentStateId );

        for ( const timer of timers ) {
            const remaining = timer.endsAt - Date.now();
            this._armTimer( timer, Math.max( 0, remaining ) );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // State activation
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string} stateId
     * @param {{reason:string, triggeredBy:*}} meta
     * @returns {void}
     */
    _activateState( stateId, meta ) {

        const nextState = this._states.get( stateId );
        if ( !nextState ) {
            console.warn( `StateMachineManager: unknown state "${ stateId }".` );
            return;
        }

        const fromId = this._currentStateId;
        this._teardownCurrentState( meta );

        this._currentStateId = stateId;

        this._history.push( { type: 'entered', stateId, timestamp: Date.now(), reason: meta.reason, triggeredBy: meta.triggeredBy } );

        EventBus.emit( 'state:entered',     { stateId } );
        EventBus.emit( 'state:transition', { from: fromId, to: stateId, reason: meta.reason, triggeredBy: meta.triggeredBy } );

        executeStateActions( nextState.actions, this._actionCtx( stateId ) );

        this._rollRandomEvents( nextState );
        this._wireTransitionListeners( nextState );
        this._scheduleStateTimers( nextState );

        this._persist();

    }

    /**
     * Exit the current state (if any): cancel its timers, unwire its
     * transition listeners, record the exit in history.
     *
     * @param {{reason?:string, triggeredBy?:*}} [meta]
     * @returns {void}
     */
    _teardownCurrentState( meta = {} ) {

        if ( this._currentStateId ) {
            this._history.push( { type: 'exited', stateId: this._currentStateId, timestamp: Date.now(), reason: meta.reason ?? null, triggeredBy: meta.triggeredBy ?? null } );
            EventBus.emit( 'state:exited', { stateId: this._currentStateId } );
        }

        for ( const eventName of this._activeHandlers.keys() ) {
            EventBus.off( eventName, this._activeHandlers.get( eventName ) );
        }
        this._activeHandlers.clear();

        this._scheduler.cancelAll();

    }

    // ─────────────────────────────────────────────────────────────
    // Event-driven transitions
    // ─────────────────────────────────────────────────────────────

    /**
     * Subscribe only to the events this state's own transitions need.
     * @param {Object} state
     * @returns {void}
     */
    _wireTransitionListeners( state ) {

        const eventDriven = ( state.transitions ?? [] ).filter( t => t.trigger?.type && t.trigger.type !== 'timeElapsed' && t.trigger.type !== 'manualTrigger' );
        const eventNames  = new Set();

        eventDriven.forEach( t => {
            eventNames.add( t.trigger.type === 'customEvent' ? t.trigger.event : this._builtInMap()[ t.trigger.type ] );
        } );

        for ( const eventName of eventNames ) {
            if ( !eventName ) continue;
            const handler = payload => this._handleTransitionEvent( state, eventName, payload );
            EventBus.on( eventName, handler );
            this._activeHandlers.set( eventName, handler );
        }

    }

    /** @returns {Object} trigger type -> real event name. */
    _builtInMap() {
        return {
            objectiveCompleted:  'objective:completed',
            evidenceDiscovered:  'evidence:selected',
            messageRead:          'messenger:message-read',
            forensicsCompleted:  'forensics:collected',
        };
    }

    /**
     * @param {Object} state - The state active when this handler was wired.
     * @param {string} eventName
     * @param {Object} payload
     * @returns {void}
     */
    _handleTransitionEvent( state, eventName, payload ) {

        // The state may already have transitioned away since this
        // handler was wired if two events land in the same tick —
        // _teardownCurrentState() removes listeners synchronously, but
        // guard anyway for safety.
        if ( state.id !== this._currentStateId ) return;

        const match = ( state.transitions ?? [] ).find( t =>
            t.trigger?.type && t.trigger.type !== 'timeElapsed' && t.trigger.type !== 'manualTrigger' &&
            triggerMatchesEvent( t.trigger, eventName, payload )
        );

        if ( match ) this._activateState( match.to, { reason: 'trigger', triggeredBy: match.trigger.target ?? eventName } );

    }

    /**
     * Manually fire a transition — spec's 'manualTrigger' trigger type.
     * Only valid if the current state actually declares it.
     *
     * @param {string} targetStateId
     * @returns {boolean} Whether the transition was valid and applied.
     */
    triggerManualTransition( targetStateId ) {

        const state = this._states.get( this._currentStateId );
        const valid = ( state?.transitions ?? [] ).some( t => t.trigger?.type === 'manualTrigger' && t.to === targetStateId );

        if ( !valid ) return false;

        this._activateState( targetStateId, { reason: 'manual', triggeredBy: 'manualTrigger' } );
        return true;

    }

    // ─────────────────────────────────────────────────────────────
    // Timers
    // ─────────────────────────────────────────────────────────────

    /**
     * Schedule every timeElapsed transition and every standalone
     * (non-transitioning) timer this state declares.
     *
     * @param {Object} state
     * @returns {void}
     */
    _scheduleStateTimers( state ) {

        ( state.transitions ?? [] )
            .filter( t => t.trigger?.type === 'timeElapsed' )
            .forEach( ( t, i ) => this._armTimer( {
                id:            `${ state.id }-transition-${ i }`,
                stateId:        state.id,
                kind:           'transition',
                transitionTo:  t.to,
                endsAt:         Date.now() + ( t.trigger.delayMs ?? 0 ),
            }, t.trigger.delayMs ?? 0 ) );

        ( state.timers ?? [] ).forEach( timer => this._armTimer( {
            id:        timer.id,
            stateId:    state.id,
            kind:       'action',
            actions:    timer.actions,
            repeat:     timer.repeat ?? false,
            delayMs:    timer.delayMs,
            endsAt:     Date.now() + timer.delayMs,
        }, timer.delayMs ) );

    }

    /**
     * @param {Object} timerRecord
     * @param {number} delayMs - Remaining time until it should fire.
     * @returns {void}
     */
    _armTimer( timerRecord, delayMs ) {

        EventBus.emit( 'state:timer-started', { timerId: timerRecord.id, stateId: timerRecord.stateId, endsAt: timerRecord.endsAt } );

        this._scheduler.arm( timerRecord.id, delayMs, () => this._fireTimer( timerRecord ) );

        this._pendingTimers = this._pendingTimers.filter( t => t.id !== timerRecord.id );
        this._pendingTimers.push( timerRecord );
        this._persist();

    }

    /**
     * @param {Object} timerRecord
     * @returns {void}
     */
    _fireTimer( timerRecord ) {

        // Stale timer from a state we've already left (shouldn't happen —
        // _teardownCurrentState clears active timers — but the record
        // could still be in _pendingTimers if teardown raced a resume).
        if ( timerRecord.stateId !== this._currentStateId ) return;

        EventBus.emit( 'state:timer-finished', { timerId: timerRecord.id, stateId: timerRecord.stateId } );

        this._pendingTimers = this._pendingTimers.filter( t => t.id !== timerRecord.id );

        if ( timerRecord.kind === 'transition' ) {
            this._activateState( timerRecord.transitionTo, { reason: 'timer', triggeredBy: timerRecord.id } );
            return;
        }

        executeStateActions( timerRecord.actions, this._actionCtx( timerRecord.stateId ) );

        if ( timerRecord.repeat ) {
            this._armTimer( { ...timerRecord, endsAt: Date.now() + timerRecord.delayMs }, timerRecord.delayMs );
        }
        else {
            this._persist();
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Random events
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {Object} state
     * @returns {void}
     */
    _rollRandomEvents( state ) {

        const { fired, nextSeed } = rollRandomEvents( state.randomEvents, this._randomSeed );
        this._randomSeed = nextSeed;

        fired.forEach( evt => {
            this._history.push( { type: 'random-event', stateId: state.id, eventId: evt.id, timestamp: Date.now() } );
            executeStateActions( evt.actions, this._actionCtx( state.id ) );
        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Public queries — Debug Mode + ApplicationContext consumers
    // ─────────────────────────────────────────────────────────────

    /** @returns {Object|null} */
    getCurrentState() {
        return this._currentStateId ? this._states.get( this._currentStateId ) : null;
    }

    /** @returns {Object[]} */
    getAvailableTransitions() {
        return this.getCurrentState()?.transitions ?? [];
    }

    /** @returns {Object[]} */
    getHistory() {
        return [ ...this._history ];
    }

    /** @returns {Object[]} */
    getPendingTimers() {
        return [ ...this._pendingTimers ].map( t => ( { ...t, remainingMs: Math.max( 0, t.endsAt - Date.now() ) } ) );
    }

    /** @returns {Object[]} */
    getStates() {
        return [ ...this._states.values() ];
    }

    /** @returns {boolean} */
    hasGraph() {
        return this._states.size > 0;
    }

    /**
     * Designer-facing snapshot — Mission 18 "Debug Mode". Call from the
     * browser console: StateMachineManager.debug().
     * @returns {Object}
     */
    debug() {
        const enteredIds = new Set( this._history.filter( h => h.type === 'entered' ).map( h => h.stateId ) );
        const locked      = [ ...this._states.keys() ].filter( id => !enteredIds.has( id ) );
        const snapshot = {
            caseId: this._caseId, currentState: this._currentStateId,
            availableTransitions: this.getAvailableTransitions(),
            pendingTimers: this.getPendingTimers(), lockedStates: locked, history: this._history,
        };
        console.table( this.getPendingTimers().map( t => ( { id: t.id, kind: t.kind, remainingMs: t.remainingMs } ) ) );
        return snapshot;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {{subject:string, body:string, from?:string}} partial
     * @returns {void}
     */
    _generateHqMail( partial ) {
        MailManager.injectMail( buildHqMail( this._caseId, partial ) );
    }

    /** @returns {string} */
    _storageKey() {
        return `state-machine:${ this._caseId }`;
    }

    /**
     * Build the callback bundle StateActions needs, shared by every call
     * site (state entry, timer fire, random event) to avoid repeating
     * the same three-callback object three times.
     *
     * @param {string} stateId
     * @returns {Object}
     */
    _actionCtx( stateId ) {
        return {
            stateId,
            notify:          n => SessionManager.pushNotification( n ),
            generateHqMail:  m => this._generateHqMail( m ),
            pushHistory:      e => this._history.push( e ),
        };
    }

    /** @returns {void} */
    _persist() {

        if ( !this._caseId ) return;

        StorageManager.save( this._storageKey(), {
            currentStateId:  this._currentStateId,
            history:          this._history,
            randomSeed:       this._randomSeed,
            pendingTimers:    this._pendingTimers,
        } );

    }

}

// Singleton.
const StateMachineManager = new StateMachineManagerClass();

export default StateMachineManager;
