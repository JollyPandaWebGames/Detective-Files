/**
 * UnlockManager
 *
 * Purpose:
 *   Mission 19 — Dynamic Content Unlock Engine. The single authority for
 *   "is this piece of content visible yet." Turns a case's unlocks.json
 *   into live per-entity gating, driven entirely by real EventBus events
 *   — no application decides visibility itself; every application asks
 *   ApplicationContext, which asks this manager. See docs/ARCHITECTURE_2.md
 *   §15 for full design notes.
 *
 * Default-open model:
 *   An entity with no rule targeting it is visible — this engine gates
 *   only what a case's unlocks.json actually declares. This keeps a case
 *   with no unlock rules at all behaving exactly as every case did
 *   before this mission, and lets a case gate only the entities whose
 *   progressive reveal actually matters to its story.
 *
 * Storage key: 'unlocks:{caseId}'
 *
 * Events emitted:
 *   content:unlocked / content:hidden / content:revealed
 *   notification:generated
 *   unlock:enable / unlock:disable / unlock:highlight / unlock:pin / unlock:queue / unlock:generate
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Contains no investigation-specific logic.
 *   Applications never import this manager directly — see
 *   ApplicationContext.isUnlocked() / getVisibleIds().
 */

import StorageManager                          from './StorageManager.js';
import EventBus                                 from '../core/EventBus.js';
import SessionManager                           from './SessionManager.js';
import MailManager                              from './MailManager.js';
import ObjectiveManager                         from './ObjectiveManager.js';
import { conditionMatchesEvent,
         getBuiltInConditionEvents }            from '../core/unlock/UnlockConditionMatcher.js';
import { normalizeConditions,
         evaluateConditionTree }                from '../core/unlock/UnlockConditionGroup.js';
import { executeUnlockActions }                 from '../core/unlock/UnlockActions.js';
import StateTimerScheduler                       from '../core/state-machine/StateTimerScheduler.js';

const CASE_BASE = './data/cases/';
const OBJECTIVE_POLL_EVENTS = [ 'objective:completed', 'objective:progress', 'objective:unlocked', 'objective:revealed' ];

class UnlockManagerClass {

    constructor() {

        /** @type {string|null} */
        this._caseId = null;

        /** ruleId -> { def, tree, leaves, satisfied:Set<number>, resolved:boolean }. @type {Map<string,Object>} */
        this._rules = new Map();

        /** type -> Set<id>. @type {Map<string,Set<string>>} */
        this._unlocked = new Map();

        /** type -> Set<id>. @type {Map<string,Set<string>>} */
        this._hidden = new Map();

        /** @type {Object[]} */
        this._history = [];

        /** @type {Object[]} */
        this._notifications = [];

        /** @type {Object|null} */
        this._lastTrigger = null;

        this._scheduler = new StateTimerScheduler();
        this._subscribedEvents = new Set();
        this._handlers = new Map();

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

        const res = await fetch( `${ CASE_BASE }${ caseId }/unlocks.json` );
        if ( !res.ok ) {
            console.warn( `UnlockManager: no unlocks.json for "${ caseId }" — everything defaults open.` );
            return;
        }
        const data = await res.json();

        const saved = StorageManager.load( this._storageKey(), null );

        ( data.rules ?? [] ).forEach( def => this._registerRule( def, saved?.rules?.[ def.id ] ) );

        this._unlocked      = _restoreTypeMap( saved?.unlocked );
        this._hidden          = _restoreTypeMap( saved?.hidden );
        this._history          = saved?.history ?? [];
        this._notifications   = saved?.notifications ?? [];

        this._subscribeToEvents();
        this._armTimeElapsedRules( saved?.rules );

    }

    /** @returns {void} */
    unloadCase() {

        for ( const eventName of this._subscribedEvents ) EventBus.off( eventName, this._handlers.get( eventName ) );
        this._subscribedEvents.clear();
        this._handlers.clear();
        this._scheduler.cancelAll();

        this._caseId          = null;
        this._rules             = new Map();
        this._unlocked          = new Map();
        this._hidden             = new Map();
        this._history            = [];
        this._notifications     = [];
        this._lastTrigger       = null;

    }

    /**
     * @param {Object} def   - A rule from unlocks.json.
     * @param {Object} [saved] - Persisted { satisfied: number[], resolved: boolean }.
     * @returns {void}
     */
    _registerRule( def, saved ) {
        const { tree, leaves } = normalizeConditions( def.conditions );
        this._rules.set( def.id, {
            def, tree, leaves,
            satisfied: new Set( saved?.satisfied ?? [] ),
            resolved:   saved?.resolved ?? false,
        } );
    }

    // ─────────────────────────────────────────────────────────────
    // Event-driven evaluation
    // ─────────────────────────────────────────────────────────────

    /** @returns {void} */
    _subscribeToEvents() {

        const eventNames = new Set( getBuiltInConditionEvents() );
        OBJECTIVE_POLL_EVENTS.forEach( e => eventNames.add( e ) );

        for ( const rule of this._rules.values() ) {
            rule.leaves.forEach( leaf => {
                if ( leaf.event === 'customEvent' ) eventNames.add( leaf.customEvent );
            } );
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

        if ( OBJECTIVE_POLL_EVENTS.includes( eventName ) ) this._pollObjectiveAvailability();

        for ( const [ ruleId, rule ] of this._rules ) {

            if ( rule.resolved ) continue;
            let changed = false;

            rule.leaves.forEach( leaf => {
                if ( leaf.event === 'objectiveAvailable' ) return; // handled by polling
                if ( rule.satisfied.has( leaf._index ) ) return;
                if ( conditionMatchesEvent( leaf, eventName, payload ) ) {
                    rule.satisfied.add( leaf._index );
                    changed = true;
                }
            } );

            if ( changed ) {
                this._lastTrigger = { ruleId, eventName, timestamp: Date.now() };
                this._resolveIfReady( ruleId, rule );
            }

        }

    }

    /** @returns {void} */
    _pollObjectiveAvailability() {

        const availableIds = new Set( ObjectiveManager.getAvailableObjectives().map( o => o.id ) );

        for ( const [ ruleId, rule ] of this._rules ) {
            if ( rule.resolved ) continue;
            let changed = false;
            rule.leaves.forEach( leaf => {
                if ( leaf.event !== 'objectiveAvailable' || rule.satisfied.has( leaf._index ) ) return;
                if ( availableIds.has( leaf.value ) ) { rule.satisfied.add( leaf._index ); changed = true; }
            } );
            if ( changed ) this._resolveIfReady( ruleId, rule );
        }

    }

    /**
     * @param {string} ruleId
     * @param {Object} rule
     * @returns {void}
     */
    _resolveIfReady( ruleId, rule ) {

        if ( !evaluateConditionTree( rule.tree, rule.satisfied ) ) { this._persist(); return; }

        rule.resolved = true;
        this._scheduler.cancel( ruleId );

        executeUnlockActions( rule.def.actions, {
            ruleId,
            targetType:      rule.def.type,
            targetId:         rule.def.target,
            setUnlocked:      v => this._setFlag( this._unlocked, rule.def.type, rule.def.target, v ),
            setHidden:         v => this._setFlag( this._hidden, rule.def.type, rule.def.target, v ),
            notify:            n => { SessionManager.pushNotification( n ); this._notifications.push( n ); EventBus.emit( 'notification:generated', { notification: n } ); },
            generateEmail:    m => MailManager.injectMail( _buildUnlockMail( this._caseId, m ) ),
            pushHistory:       e => this._history.push( e ),
        } );

        this._persist();

    }

    // ─────────────────────────────────────────────────────────────
    // Time-elapsed rules
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {Object} [savedRules]
     * @returns {void}
     */
    _armTimeElapsedRules( savedRules ) {

        for ( const [ ruleId, rule ] of this._rules ) {

            if ( rule.resolved ) continue;

            rule.leaves.forEach( leaf => {
                if ( leaf.event !== 'timeElapsed' || rule.satisfied.has( leaf._index ) ) return;

                const savedEndsAt = savedRules?.[ ruleId ]?.timerEndsAt;
                const endsAt        = savedEndsAt ?? ( Date.now() + ( leaf.delayMs ?? 0 ) );
                const remaining      = Math.max( 0, endsAt - Date.now() );

                this._scheduler.arm( ruleId, remaining, () => {
                    rule.satisfied.add( leaf._index );
                    this._lastTrigger = { ruleId, eventName: 'timeElapsed', timestamp: Date.now() };
                    this._resolveIfReady( ruleId, rule );
                } );

                rule._timerEndsAt = endsAt;

            } );

        }

    }

    // ─────────────────────────────────────────────────────────────
    // Public queries — application integration
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string} type
     * @param {string} id
     * @returns {boolean}
     */
    isUnlocked( type, id ) {

        if ( this._hidden.get( type )?.has( id ) ) return false;
        if ( this._unlocked.get( type )?.has( id ) ) return true;

        const gated = [ ...this._rules.values() ].some( r => r.def.type === type && r.def.target === id );
        return !gated;

    }

    /**
     * @param {string}   type
     * @param {string[]} allIds
     * @returns {string[]}
     */
    getVisibleIds( type, allIds ) {
        return allIds.filter( id => this.isUnlocked( type, id ) );
    }

    /** @returns {boolean} */
    hasRules() {
        return this._rules.size > 0;
    }

    /** @returns {Object[]} */
    getHistory() {
        return [ ...this._history ];
    }

    /**
     * Full designer-facing snapshot — Mission 19 "Debug Mode". Call from
     * the browser console: UnlockManager.debug().
     * @returns {Object}
     */
    debug() {

        const rules = [ ...this._rules.entries() ].map( ( [ id, r ] ) => ( {
            id, target: r.def.target, type: r.def.type, resolved: r.resolved,
            satisfied: `${ r.satisfied.size }/${ r.leaves.length }`,
        } ) );

        const snapshot = {
            caseId:       this._caseId,
            rules,
            pending:      rules.filter( r => !r.resolved ),
            unlocked:      Object.fromEntries( [ ...this._unlocked ].map( ( [ t, s ] ) => [ t, [ ...s ] ] ) ),
            locked:         rules.filter( r => !r.resolved ).map( r => `${ r.type }:${ r.target }` ),
            lastTrigger:  this._lastTrigger,
        };

        console.table( rules );
        return snapshot;

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {Map<string,Set<string>>} map
     * @param {string} type @param {string} id @param {boolean} value
     * @returns {void}
     */
    _setFlag( map, type, id, value ) {
        if ( !map.has( type ) ) map.set( type, new Set() );
        if ( value ) map.get( type ).add( id ); else map.get( type ).delete( id );
    }

    /**
     * Case 00 replay support — wipe this case's persisted unlock state
     * so the next loadForCase() starts fully re-gated. Call before
     * loadForCase().
     *
     * @param {string} caseId
     * @returns {void}
     */
    resetForCase( caseId ) {
        StorageManager.remove( `unlocks:${ caseId }` );
    }

    /** @returns {string} */
    _storageKey() {
        return `unlocks:${ this._caseId }`;
    }

    /** @returns {void} */
    _persist() {

        if ( !this._caseId ) return;

        const rulesOut = {};
        for ( const [ id, r ] of this._rules ) {
            rulesOut[ id ] = { satisfied: [ ...r.satisfied ], resolved: r.resolved, timerEndsAt: r._timerEndsAt ?? null };
        }

        StorageManager.save( this._storageKey(), {
            rules:          rulesOut,
            unlocked:       _dumpTypeMap( this._unlocked ),
            hidden:          _dumpTypeMap( this._hidden ),
            history:         this._history,
            notifications:  this._notifications,
        } );

    }

}

/** @param {Object|undefined} saved @returns {Map<string,Set<string>>} */
function _restoreTypeMap( saved ) {
    const map = new Map();
    Object.entries( saved ?? {} ).forEach( ( [ type, ids ] ) => map.set( type, new Set( ids ) ) );
    return map;
}

/** @param {Map<string,Set<string>>} map @returns {Object} */
function _dumpTypeMap( map ) {
    return Object.fromEntries( [ ...map ].map( ( [ type, set ] ) => [ type, [ ...set ] ] ) );
}

/**
 * @param {string} caseId
 * @param {{subject:string, body:string}} partial
 * @returns {Object}
 */
function _buildUnlockMail( caseId, partial ) {
    return {
        id: `mail-unlock-${ caseId }-${ Date.now() }`, caseId,
        from: 'Captain Morgan', fromTitle: 'Precinct Captain',
        subject: partial.subject, body: partial.body,
        date: new Date().toISOString().slice( 0, 16 ).replace( 'T', ' ' ),
        priority: 'Medium', read: false, starred: false, folder: 'inbox', attachments: [],
    };
}

// Singleton.
const UnlockManager = new UnlockManagerClass();

export default UnlockManager;
