/**
 * ObjectiveManager
 *
 * Purpose:
 *   Mission 16 — Objective Engine. Turns a case's objective graph (pure
 *   JSON) into live, event-driven investigation progression: branching
 *   objectives, dependencies, optional/hidden tasks, conditions, and
 *   actions. Contains no investigation-specific logic — every case
 *   supplies its own graph under data/cases/{caseId}/objectives/.
 *
 * Responsibilities:
 *   - Load a case's objective definitions + phases from JSON
 *   - Track runtime state per objective (locked/available/hidden/
 *     completed/skipped) and recompute it as dependencies resolve
 *   - Subscribe to the EventBus events objectives care about and
 *     evaluate conditions against them (delegated to ConditionMatcher)
 *   - Execute an objective's actions on completion (delegated to
 *     ObjectiveActions)
 *   - Track investigation phase, progress, and a full unlock/complete
 *     history
 *   - Persist and restore all of the above per case
 *
 * Storage key: 'objectives-state:{caseId}'
 *
 * Events emitted:
 *   objective:loaded          { caseId, count }
 *   objective:completed       { objective }
 *   objective:unlocked        { objectiveId }
 *   objective:revealed        { objectiveId }
 *   objective:progress        { progress, requiredComplete }
 *   objective:phase-changed   { phaseId }
 *   content:unlocked          { contentType, target, objectiveId } — see
 *                              ObjectiveActions for why this doesn't yet
 *                              gate anything in the applications
 *
 * Events consumed:
 *   Every event named in ConditionMatcher's built-in table, plus every
 *   'customEvent' event name declared by the loaded case's own
 *   objectives — collected at load time so the engine never has to
 *   guess what a case might reference.
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Never contain investigation-specific logic — see ARCHITECTURE_2.md §12.
 *   Applications never import this manager directly — see
 *   ARCHITECTURE_2.md — only ActiveInvestigationManager and the
 *   Investigation Widget read from it, via ApplicationContext.
 */

import StorageManager                                    from './StorageManager.js';
import EventBus                                            from '../core/EventBus.js';
import { getBuiltInConditionEvents, conditionMatchesEvent } from '../core/objectives/ConditionMatcher.js';
import { recomputeAvailability, computeProgress,
         getVisibleObjectives, getAvailableObjectives }    from '../core/objectives/ObjectiveGraph.js';
import { executeActions }                                   from '../core/objectives/ObjectiveActions.js';

const CASE_BASE = './data/cases/';

class ObjectiveManagerClass {

    constructor() {

        /** @type {string|null} */
        this._caseId = null;

        /** id -> objective definition (static, from JSON). @type {Map<string,Object>} */
        this._definitions = new Map();

        /** id -> runtime state. @type {Map<string,Object>} */
        this._states = new Map();

        /** @type {Object[]} phases, in order */
        this._phases = [];

        /** @type {string|null} */
        this._currentPhaseId = null;

        /** @type {Object[]} */
        this._history = [];

        /** Event names this manager is currently subscribed to for the
         *  loaded case (built-ins + that case's customEvent names), so
         *  they can be cleanly unsubscribed on unloadCase().
         *  @type {Set<string>} */
        this._subscribedEvents = new Set();

        /** Bound dispatcher, one per subscribed event name. @type {Map<string,Function>} */
        this._handlers = new Map();

    }

    // ─────────────────────────────────────────────────────────────
    // Loading
    // ─────────────────────────────────────────────────────────────

    /**
     * Load a case's objective graph, restore any persisted progress, and
     * start listening for the events it needs. Safe to call again for a
     * different case — the previous case's subscriptions are torn down
     * first.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        this.unloadCase();
        this._caseId = caseId;

        const indexRes = await fetch( `${ CASE_BASE }${ caseId }/objectives/index.json` );
        if ( !indexRes.ok ) {
            console.warn( `ObjectiveManager: no objective graph for "${ caseId }" — skipping.` );
            return;
        }
        const index = await indexRes.json();

        await this._loadDefinitions( caseId, index.objectives ?? [] );
        this._phases = await this._loadPhases( caseId, index.phasesFile );

        this._restoreOrInitState();
        recomputeAvailability( this._definitions, this._states );
        this._subscribeToEvents();

        EventBus.emit( 'objective:loaded', { caseId, count: this._definitions.size } );
        this._emitProgress();

    }

    /**
     * Tear down the currently loaded case's subscriptions and state.
     * @returns {void}
     */
    unloadCase() {

        for ( const eventName of this._subscribedEvents ) {
            EventBus.off( eventName, this._handlers.get( eventName ) );
        }
        this._subscribedEvents.clear();
        this._handlers.clear();

        this._caseId          = null;
        this._definitions      = new Map();
        this._states           = new Map();
        this._phases           = [];
        this._currentPhaseId   = null;
        this._history          = [];

    }

    /**
     * @param {string}   caseId
     * @param {string[]} files - Objective JSON filenames from index.json.
     * @returns {Promise<void>}
     */
    async _loadDefinitions( caseId, files ) {

        for ( const file of files ) {
            const res = await fetch( `${ CASE_BASE }${ caseId }/objectives/${ file }` );
            if ( !res.ok ) continue;
            const def = await res.json();
            this._definitions.set( def.id, def );
        }

    }

    /**
     * @param {string} caseId
     * @param {string} [phasesFile]
     * @returns {Promise<Object[]>}
     */
    async _loadPhases( caseId, phasesFile ) {

        if ( !phasesFile ) return [];

        const res = await fetch( `${ CASE_BASE }${ caseId }/objectives/${ phasesFile }` );
        if ( !res.ok ) return [];

        const data = await res.json();
        return data.phases ?? [];

    }

    // ─────────────────────────────────────────────────────────────
    // State restore / initialization
    // ─────────────────────────────────────────────────────────────

    /** @returns {void} */
    _restoreOrInitState() {

        const saved = StorageManager.load( this._storageKey(), null );

        for ( const [ id, def ] of this._definitions ) {
            const savedState = saved?.states?.[ id ];
            this._states.set( id, savedState ?? {
                status:       def.hidden ? 'hidden' : 'locked',
                revealed:     !def.hidden,
                satisfied:    new Array( ( def.conditions ?? [] ).length ).fill( false ),
                unlockedAt:   null,
                completedAt:  null,
            } );
        }

        this._currentPhaseId = saved?.currentPhaseId ?? this._phases[ 0 ]?.id ?? null;
        this._history         = saved?.history ?? [];

    }

    // ─────────────────────────────────────────────────────────────
    // Event subscription + condition evaluation
    // ─────────────────────────────────────────────────────────────

    /** @returns {void} */
    _subscribeToEvents() {

        const eventNames = new Set( getBuiltInConditionEvents() );

        for ( const def of this._definitions.values() ) {
            for ( const condition of def.conditions ?? [] ) {
                if ( condition.type === 'customEvent' ) eventNames.add( condition.event );
            }
        }

        for ( const eventName of eventNames ) {
            const handler = payload => this._handleEvent( eventName, payload );
            EventBus.on( eventName, handler );
            this._subscribedEvents.add( eventName );
            this._handlers.set( eventName, handler );
        }

    }

    /**
     * @param {string} eventName
     * @param {Object} payload
     * @returns {void}
     */
    _handleEvent( eventName, payload ) {

        for ( const [ id, def ] of this._definitions ) {

            const state = this._states.get( id );
            if ( state.status !== 'available' ) continue;

            let changed = false;

            ( def.conditions ?? [] ).forEach( ( condition, i ) => {
                if ( state.satisfied[ i ] ) return;
                if ( conditionMatchesEvent( condition, eventName, payload ) ) {
                    state.satisfied[ i ] = true;
                    changed = true;
                }
            } );

            if ( changed && state.satisfied.every( Boolean ) ) {
                this._completeObjective( id );
            }

        }

    }

    // ─────────────────────────────────────────────────────────────
    // Completion + actions
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string} id
     * @returns {void}
     */
    _completeObjective( id ) {

        const def   = this._definitions.get( id );
        const state = this._states.get( id );

        state.status       = 'completed';
        state.completedAt  = Date.now();

        this._pushHistory( { type: 'completed', objectiveId: id, timestamp: state.completedAt } );

        executeActions( def.actions, {
            objectiveId:     id,
            revealObjective: targetId => this._revealObjective( targetId ),
            unlockObjective: targetId => this._forceUnlock( targetId ),
            setPhase:        phaseId  => this._setPhase( phaseId ),
            pushHistory:     entry    => this._pushHistory( entry ),
        } );

        recomputeAvailability( this._definitions, this._states );
        this._persist();

        EventBus.emit( 'objective:completed', { objective: { ...def, status: 'completed' } } );
        this._emitProgress();

    }

    /**
     * @param {string} id
     * @returns {void}
     */
    _revealObjective( id ) {

        const state = this._states.get( id );
        if ( !state || state.revealed ) return;

        state.revealed   = true;
        state.unlockedAt = Date.now();

        this._pushHistory( { type: 'revealed', objectiveId: id, timestamp: state.unlockedAt } );
        recomputeAvailability( this._definitions, this._states );

        EventBus.emit( 'objective:revealed', { objectiveId: id } );

    }

    /**
     * Explicit designer override — force an objective available now,
     * bypassing its own dependency list. Used by the `unlockObjective`
     * action, distinct from revealing a hidden one (which still respects
     * dependencies).
     *
     * @param {string} id
     * @returns {void}
     */
    _forceUnlock( id ) {

        const state = this._states.get( id );
        if ( !state || state.status === 'completed' || state.status === 'skipped' ) return;

        state.revealed   = true;
        state.status     = 'available';
        state.unlockedAt = state.unlockedAt ?? Date.now();

        this._pushHistory( { type: 'unlocked', objectiveId: id, timestamp: Date.now() } );
        EventBus.emit( 'objective:unlocked', { objectiveId: id } );

    }

    /**
     * @param {string} phaseId
     * @returns {void}
     */
    _setPhase( phaseId ) {

        this._currentPhaseId = phaseId;
        this._pushHistory( { type: 'phase-changed', phaseId, timestamp: Date.now() } );
        EventBus.emit( 'objective:phase-changed', { phaseId } );

    }

    // ─────────────────────────────────────────────────────────────
    // Public queries (consumed by ActiveInvestigationManager + widget)
    // ─────────────────────────────────────────────────────────────

    /** @returns {Object[]} Visible objectives with 'available' status, priority-sorted. */
    getAvailableObjectives() {
        return getAvailableObjectives( this._definitions, this._states );
    }

    /** @returns {Object[]} All visible (non-hidden) objectives, any status. */
    getVisibleObjectives() {
        return getVisibleObjectives( this._definitions, this._states );
    }

    /** @returns {Object[]} Completed objectives. */
    getCompletedObjectives() {
        return this.getVisibleObjectives().filter( o => o.status === 'completed' );
    }

    /** @returns {{progress:number, requiredComplete:boolean}} */
    getProgress() {
        const p = computeProgress( this._definitions, this._states );
        return { progress: p.progress, requiredComplete: p.requiredComplete };
    }

    /** @returns {string|null} */
    getCurrentPhaseId() {
        return this._currentPhaseId;
    }

    /** @returns {Object[]} */
    getHistory() {
        return [ ...this._history ];
    }

    /** @returns {boolean} Whether a case with an objective graph is currently loaded. */
    hasGraph() {
        return this._definitions.size > 0;
    }

    /**
     * Full designer-facing snapshot — Mission 16 "Debug Mode".
     * Call from the browser console: ObjectiveManager.debug().
     * @returns {Object}
     */
    debug() {

        const snapshot = {
            caseId:            this._caseId,
            currentPhase:      this._currentPhaseId,
            progress:          this.getProgress(),
            completed:          [ ...this._states ].filter( ( [ , s ] ) => s.status === 'completed' ).map( ( [ id ] ) => id ),
            available:          [ ...this._states ].filter( ( [ , s ] ) => s.status === 'available' ).map( ( [ id ] ) => id ),
            locked:             [ ...this._states ].filter( ( [ , s ] ) => s.status === 'locked' ).map( ( [ id ] ) => id ),
            hidden:             [ ...this._states ].filter( ( [ , s ] ) => s.status === 'hidden' ).map( ( [ id ] ) => id ),
            subscribedEvents:  [ ...this._subscribedEvents ],
            history:            this._history,
        };

        console.table( [ snapshot.completed, snapshot.available, snapshot.locked, snapshot.hidden ]
            .map( ( ids, i ) => ( { state: [ 'completed', 'available', 'locked', 'hidden' ][ i ], objectives: ids.join( ', ' ) || '—' } ) ) );

        return snapshot;

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /** @param {Object} entry @returns {void} */
    _pushHistory( entry ) {
        this._history.push( entry );
        this._persist();
    }

    /** @returns {void} */
    _emitProgress() {
        EventBus.emit( 'objective:progress', this.getProgress() );
    }

    /** @returns {string} */
    _storageKey() {
        return `objectives-state:${ this._caseId }`;
    }

    /** @returns {void} */
    _persist() {

        if ( !this._caseId ) return;

        const states = {};
        for ( const [ id, s ] of this._states ) states[ id ] = s;

        StorageManager.save( this._storageKey(), {
            states,
            currentPhaseId: this._currentPhaseId,
            history:         this._history,
        } );

    }

}

// Singleton.
const ObjectiveManager = new ObjectiveManagerClass();

export default ObjectiveManager;
