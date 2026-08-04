/**
 * SessionManager
 *
 * Purpose:
 *   Owns the current detective workspace — the "session" — as described
 *   in ARCHITECTURE_2.md (Epic 01 — CID OS Architecture 2.0).
 *
 *   A session is the runtime shape of everything that makes up "what the
 *   detective is currently doing": which investigation is active, which
 *   applications are open, the notification queue, and save metadata.
 *
 *   Only one session exists locally. There is no multi-session or
 *   multi-user support — that is explicitly out of scope for this epic.
 *
 * Responsibilities:
 *   - Track the active investigation id (delegated authority lives in
 *     ActiveInvestigationManager — SessionManager only stores the pointer)
 *   - Track which application windows are currently open, so the
 *     workspace can be restored after a page refresh
 *   - Maintain a lightweight notification queue
 *   - Track running timers registered by other managers (e.g. Forensics)
 *     so a future "resume" flow can reconcile in-flight waits
 *   - Persist and restore all of the above via StorageManager
 *
 * Rules:
 *   SessionManager never accesses localStorage directly — StorageManager
 *   is still the sole gateway to persistence.
 *   SessionManager never reaches into application internals — it only
 *   stores ids and primitive state, and applications restore themselves
 *   from that state via ApplicationManager.
 *
 * Storage key: 'session'
 *
 * Events emitted:
 *   session:restored   — after a persisted session has been reloaded { session }
 *   session:saved       — after every persist                        { session }
 */

import StorageManager from './StorageManager.js';
import EventBus        from '../core/EventBus.js';

const STORAGE_KEY = 'session';

const EMPTY_SESSION = () => ( {
    activeSessionPointer:  null,   // { caseId, startedAt } | null
    openApps:               [],   // [{ appId, minimized }]
    notifications:          [],
    runningTimers:          [],   // [{ id, ownerId, label, endsAt }]
    widget:                 { collapsed: false },
    meta: {
        version:  1,
        lastSaved: null,
    },
} );

class SessionManagerClass {

    constructor() {

        /** @type {Object} */
        this._session = EMPTY_SESSION();

        /** @type {boolean} */
        this._loaded = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Load any persisted session from storage. Safe to call once at boot.
     * Does not restore application windows — that is orchestrated by
     * Workstation after every manager and ApplicationManager are ready.
     *
     * @returns {void}
     */
    initialize() {

        if ( this._loaded ) return;

        const saved = StorageManager.load( STORAGE_KEY, null );

        this._session = saved ? this._migrate( saved ) : EMPTY_SESSION();
        this._loaded  = true;

        EventBus.emit( 'session:restored', { session: this.getSession() } );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return a shallow copy of the full session object.
     * @returns {Object}
     */
    getSession() {
        return { ...this._session };
    }

    /** @returns {{caseId:string, startedAt:number}|null} */
    getActiveSessionPointer() {
        return this._session.activeSessionPointer;
    }

    /** @returns {Array<{appId:string, minimized:boolean}>} */
    getOpenApps() {
        return [ ...this._session.openApps ];
    }

    /** @returns {boolean} */
    isWidgetCollapsed() {
        return this._session.widget.collapsed;
    }

    // ─────────────────────────────────────────────────────────────
    // Mutations
    // ─────────────────────────────────────────────────────────────

    /**
     * Set (or clear) the active session pointer.
     * ActiveInvestigationManager is the only caller.
     *
     * @param {{caseId:string, startedAt:number}|null} pointer
     * @returns {void}
     */
    setActiveSessionPointer( pointer ) {
        this._session.activeSessionPointer = pointer;
        this._persist();
    }

    /**
     * Record that an application window is now open.
     * @param {string} appId
     * @returns {void}
     */
    trackAppOpened( appId ) {

        if ( this._session.openApps.some( a => a.appId === appId ) ) return;

        this._session.openApps.push( { appId, minimized: false } );
        this._persist();

    }

    /**
     * Record that an application window has closed.
     * @param {string} appId
     * @returns {void}
     */
    trackAppClosed( appId ) {

        this._session.openApps = this._session.openApps.filter( a => a.appId !== appId );
        this._persist();

    }

    /**
     * Update the minimized flag for a tracked open app.
     * @param {string}  appId
     * @param {boolean} minimized
     * @returns {void}
     */
    trackAppMinimized( appId, minimized ) {

        const entry = this._session.openApps.find( a => a.appId === appId );
        if ( !entry ) return;

        entry.minimized = minimized;
        this._persist();

    }

    /**
     * Push a notification onto the queue.
     * @param {Object} notification - { id, title, body, timestamp, read }
     * @returns {void}
     */
    pushNotification( notification ) {

        this._session.notifications.unshift( notification );
        this._session.notifications = this._session.notifications.slice( 0, 50 );
        this._persist();
        EventBus.emit( 'notification:added', { notification } );

    }

    /**
     * Register a running timer so it can be reconciled after a refresh.
     * @param {{id:string, ownerId:string, label:string, endsAt:number}} timer
     * @returns {void}
     */
    registerTimer( timer ) {

        this._session.runningTimers = this._session.runningTimers.filter( t => t.id !== timer.id );
        this._session.runningTimers.push( timer );
        this._persist();

    }

    /**
     * Remove a previously registered timer (completed or cancelled).
     * @param {string} timerId
     * @returns {void}
     */
    clearTimer( timerId ) {

        this._session.runningTimers = this._session.runningTimers.filter( t => t.id !== timerId );
        this._persist();

    }

    /**
     * Persist the widget's collapsed/expanded state.
     * @param {boolean} collapsed
     * @returns {void}
     */
    setWidgetCollapsed( collapsed ) {
        this._session.widget.collapsed = collapsed;
        this._persist();
    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * Migrate an older persisted session shape forward. Because this is
     * the first versioned session format, migration is currently a
     * defensive merge over EMPTY_SESSION() rather than a real transform —
     * future format changes should branch on `saved.meta.version` here.
     *
     * @param {Object} saved
     * @returns {Object}
     */
    _migrate( saved ) {
        return { ...EMPTY_SESSION(), ...saved, meta: { ...EMPTY_SESSION().meta, ...( saved.meta ?? {} ) } };
    }

    /**
     * Persist the current session and stamp the save time.
     * @returns {void}
     */
    _persist() {

        this._session.meta.lastSaved = Date.now();
        StorageManager.save( STORAGE_KEY, this._session );
        EventBus.emit( 'session:saved', { session: this.getSession() } );

    }

}

// Singleton.
const SessionManager = new SessionManagerClass();

export default SessionManager;
