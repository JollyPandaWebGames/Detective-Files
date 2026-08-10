/**
 * CctvManager
 *
 * Purpose:
 *   Loads CCTV camera data per case from /data/cases/{caseId}/cctv/,
 *   merges persisted player state (bookmarks, notes, lastPosition, zoom)
 *   from StorageManager, and provides a clean API for the CCTV Viewer
 *   application.
 *
 * Responsibilities:
 *   - Discover and fetch camera JSON via the cctv/index.json manifest
 *   - Cache loaded cameras per case (load once per session)
 *   - Merge saved state over loaded data
 *   - Provide bookmark CRUD operations
 *   - Persist all mutable state changes immediately
 *   - Emit EventBus events for all state changes
 *
 * Storage key: 'cctv-state'
 * Format: {
 *   [cameraId]: {
 *     bookmarks: [{ time, title, description }],
 *     notes:     string,
 *     lastPosition: number,
 *     zoom:      number
 *   }
 * }
 *
 * Events emitted:
 *   cctv:loaded           — cameras loaded for a case  { caseId, count }
 *   cctv:bookmark-added   — bookmark created           { cameraId, bookmark }
 *   cctv:bookmark-removed — bookmark deleted           { cameraId, time }
 *   cctv:note-updated     — notes saved                { cameraId, notes }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Camera JSON files are read-only; mutable state lives in StorageManager.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY = 'cctv-state';
const CASE_BASE   = './data/cases/';

class CctvManagerClass {

    constructor() {

        /**
         * Cameras for the currently loaded case, keyed by camera id.
         * @type {Map<string, Object>}
         */
        this._cameras = new Map();

        /**
         * Per-case cache so switching back avoids re-fetching.
         * @type {Map<string, Map<string, Object>>}
         */
        this._cache = new Map();

        /**
         * Persisted per-camera player state.
         * @type {Object}
         */
        this._state = {};

        /** @type {string|null} */
        this._activeCaseId = null;

        /** @type {boolean} */
        this._stateLoaded = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Load persisted player state from StorageManager.
     * Safe to call multiple times — only executes once.
     *
     * @returns {void}
     */
    initialize() {

        if ( this._stateLoaded ) return;

        this._state = StorageManager.load( STORAGE_KEY, {} );
        this._stateLoaded = true;

        console.info( 'CctvManager: Persisted state loaded.' );

    }

    /**
     * Load all cameras belonging to a case.
     * Uses cache if already loaded this session.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        if ( !caseId ) {
            this._cameras.clear();
            this._activeCaseId = null;
            EventBus.emit( 'cctv:loaded', { caseId: null, count: 0 } );
            return;
        }

        this._activeCaseId = caseId;

        if ( this._cache.has( caseId ) ) {
            this._cameras = this._cache.get( caseId );
            EventBus.emit( 'cctv:loaded', { caseId, count: this._cameras.size } );
            return;
        }

        const cameras = new Map();
        const indexUrl = `${ CASE_BASE }${ caseId }/cctv/index.json`;

        try {
            const res = await fetch( indexUrl );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            const loads = ( index.files ?? [] ).map( f => this._loadFile( caseId, f, cameras ) );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.error( `CctvManager: Failed to load camera index for "${ caseId }".`, error );
        }

        this._cache.set( caseId, cameras );
        this._cameras = cameras;

        EventBus.emit( 'cctv:loaded', { caseId, count: cameras.size } );
        console.info( `CctvManager: Loaded ${ cameras.size } camera(s) for "${ caseId }".` );

    }

    /**
     * Case 00 replay support — wipe persisted view/bookmark state for
     * every camera belonging to this case, and drop the case from the
     * in-memory cache so the next loadForCase() re-fetches clean. Call
     * before loadForCase().
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async resetForCase( caseId ) {

        let ids;

        if ( this._cache.has( caseId ) ) {
            ids = [ ...this._cache.get( caseId ).keys() ];
        }
        else {
            ids = await this._fetchIdsForCase( caseId );
        }

        ids.forEach( id => delete this._state[ id ] );
        this._cache.delete( caseId );

        StorageManager.save( STORAGE_KEY, this._state );

    }

    /**
     * @param {string} caseId
     * @returns {Promise<string[]>}
     */
    async _fetchIdsForCase( caseId ) {

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/cctv/index.json` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            return ( index.files ?? [] ).map( f => f.replace( /\.json$/, '' ) );
        }
        catch ( error ) {
            console.warn( `CctvManager: Could not resolve ids for "${ caseId }" during reset.`, error );
            return [];
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all cameras for the active case, available ones first.
     *
     * @returns {Object[]}
     */
    getAll() {

        const all = Array.from( this._cameras.values() );
        return all.sort( ( a, b ) => {
            if ( a.available === b.available ) return 0;
            return a.available ? -1 : 1;
        } );

    }

    /**
     * Return a single camera by id.
     *
     * @param {string} cameraId
     * @returns {Object|undefined}
     */
    getById( cameraId ) {
        return this._cameras.get( cameraId );
    }

    /**
     * Return all bookmarks for a camera, sorted by time ascending.
     *
     * @param {string} cameraId
     * @returns {Object[]}
     */
    getBookmarks( cameraId ) {

        return ( this._state[ cameraId ]?.bookmarks ?? [] )
            .slice()
            .sort( ( a, b ) => a.time - b.time );

    }

    /**
     * Return saved notes for a camera.
     *
     * @param {string} cameraId
     * @returns {string}
     */
    getNotes( cameraId ) {
        return this._state[ cameraId ]?.notes ?? '';
    }

    /**
     * Return the last saved playback position for a camera.
     *
     * @param {string} cameraId
     * @returns {number}
     */
    getLastPosition( cameraId ) {
        return this._state[ cameraId ]?.lastPosition ?? 0;
    }

    /**
     * Return the last saved zoom level for a camera.
     *
     * @param {string} cameraId
     * @returns {number}
     */
    getZoom( cameraId ) {
        return this._state[ cameraId ]?.zoom ?? 100;
    }

    // ─────────────────────────────────────────────────────────────
    // Bookmark Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Add a bookmark to a camera at a given timestamp.
     *
     * @param {string} cameraId
     * @param {number} time        - Seconds from start.
     * @param {string} title
     * @param {string} [description]
     * @returns {Object} The created bookmark.
     */
    addBookmark( cameraId, time, title, description = '' ) {

        this._ensureState( cameraId );
        const bookmark = { time: Math.floor( time ), title, description };
        this._state[ cameraId ].bookmarks.push( bookmark );
        this._persist();

        EventBus.emit( 'cctv:bookmark-added', { cameraId, bookmark } );

        return bookmark;

    }

    /**
     * Remove a bookmark at a given timestamp.
     *
     * @param {string} cameraId
     * @param {number} time
     * @returns {void}
     */
    removeBookmark( cameraId, time ) {

        this._ensureState( cameraId );
        this._state[ cameraId ].bookmarks = this._state[ cameraId ].bookmarks
            .filter( b => b.time !== time );
        this._persist();

        EventBus.emit( 'cctv:bookmark-removed', { cameraId, time } );

    }

    /**
     * Update an existing bookmark's title and description.
     *
     * @param {string} cameraId
     * @param {number} time
     * @param {string} title
     * @param {string} [description]
     * @returns {void}
     */
    updateBookmark( cameraId, time, title, description = '' ) {

        this._ensureState( cameraId );
        const bookmark = this._state[ cameraId ].bookmarks.find( b => b.time === time );
        if ( !bookmark ) return;
        bookmark.title       = title;
        bookmark.description = description;
        this._persist();

    }

    // ─────────────────────────────────────────────────────────────
    // Notes / Position / Zoom
    // ─────────────────────────────────────────────────────────────

    /**
     * Save camera-level notes.
     *
     * @param {string} cameraId
     * @param {string} notes
     * @returns {void}
     */
    saveNotes( cameraId, notes ) {

        this._ensureState( cameraId );
        this._state[ cameraId ].notes = notes;
        this._persist();

        EventBus.emit( 'cctv:note-updated', { cameraId, notes } );

    }

    /**
     * Save the current playback position so the player can resume later.
     *
     * @param {string} cameraId
     * @param {number} position - Seconds from start.
     * @returns {void}
     */
    savePosition( cameraId, position ) {

        this._ensureState( cameraId );
        this._state[ cameraId ].lastPosition = Math.floor( position );
        this._persist();

    }

    /**
     * Save the current zoom level.
     *
     * @param {string} cameraId
     * @param {number} zoom - 100 | 150 | 200 | 300
     * @returns {void}
     */
    saveZoom( cameraId, zoom ) {

        this._ensureState( cameraId );
        this._state[ cameraId ].zoom = zoom;
        this._persist();

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    async _loadFile( caseId, filename, targetMap ) {

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/cctv/${ filename }` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();
            targetMap.set( data.id, data );
        }
        catch ( error ) {
            console.error( `CctvManager: Failed to load "${ filename }".`, error );
        }

    }

    _ensureState( cameraId ) {

        if ( !this._state[ cameraId ] ) {
            this._state[ cameraId ] = { bookmarks: [], notes: '', lastPosition: 0, zoom: 100 };
        }

    }

    _persist() {
        StorageManager.save( STORAGE_KEY, this._state );
    }

}

// Singleton.
const CctvManager = new CctvManagerClass();

export default CctvManager;
