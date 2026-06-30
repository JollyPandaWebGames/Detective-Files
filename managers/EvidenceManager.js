/**
 * EvidenceManager
 *
 * Purpose:
 *   Loads evidence data per case from /data/cases/{caseId}/evidence/,
 *   merges persisted player state (pinned/notes/lastViewed) from
 *   StorageManager, and provides a clean query/action API for the
 *   Evidence Database application.
 *
 * Responsibilities:
 *   - Discover and fetch evidence JSON for a given case via its
 *     evidence/index.json manifest
 *   - Cache loaded evidence per case (load once, reuse on case switch)
 *   - Merge saved pinned/notes state over loaded data
 *   - Provide filtered views: by category, by status, by tag, by search
 *   - Resolve evidence linked to a mail attachment id
 *   - Persist state changes immediately via StorageManager
 *   - Emit EventBus events on load, selection, pin, and note changes
 *
 * Storage key: 'evidence-state'
 * Format: { [evidenceId]: { favorite, notes, lastViewed } }
 *
 * Events emitted:
 *   evidence:loaded        — case evidence load complete  { caseId, count }
 *   evidence:selected      — user selected an item        { evidence }
 *   evidence:opened        — item opened (focus/jump-to)  { evidenceId }
 *   evidence:pinned        — pin state toggled            { evidenceId, pinned }
 *   evidence:note-updated  — player note saved             { evidenceId, notes }
 *
 * Events consumed:
 *   None directly — the application layer listens for case:selected
 *   and calls loadForCase() itself, keeping this manager UI-agnostic.
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Evidence JSON files are read-only; mutable state lives in StorageManager.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY = 'evidence-state';
const CASE_BASE   = './data/cases/';

class EvidenceManagerClass {

    constructor() {

        /**
         * Evidence for the currently loaded case, keyed by evidence id.
         * @type {Map<string, Object>}
         */
        this._items = new Map();

        /**
         * Cache of evidence already loaded per case, so switching back
         * to a previously viewed case doesn't re-fetch from disk.
         * @type {Map<string, Map<string, Object>>}
         */
        this._cache = new Map();

        /**
         * Persisted per-evidence player state.
         * @type {Object}
         */
        this._state = {};

        /**
         * The case id currently loaded into _items.
         * @type {string|null}
         */
        this._activeCaseId = null;

        /**
         * Whether persisted state has been loaded from StorageManager.
         * @type {boolean}
         */
        this._stateLoaded = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Load persisted player state (pinned/notes/lastViewed).
     * Safe to call multiple times — only loads once.
     * Does not load any case's evidence — call loadForCase() for that.
     *
     * @returns {void}
     */
    initialize() {

        if ( this._stateLoaded ) return;

        this._state = StorageManager.load( STORAGE_KEY, {} );
        this._stateLoaded = true;

        console.info( 'EvidenceManager: Persisted state loaded.' );

    }

    /**
     * Load all evidence belonging to a case.
     * Uses the cache if this case was already loaded once this session.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        if ( !caseId ) {
            this._items.clear();
            this._activeCaseId = null;
            EventBus.emit( 'evidence:loaded', { caseId: null, count: 0 } );
            return;
        }

        this._activeCaseId = caseId;

        // Serve from cache if already loaded this session.
        if ( this._cache.has( caseId ) ) {
            this._items = this._cache.get( caseId );
            EventBus.emit( 'evidence:loaded', { caseId, count: this._items.size } );
            return;
        }

        const items = new Map();
        const indexUrl = `${ CASE_BASE }${ caseId }/evidence/index.json`;

        try {
            const indexRes = await fetch( indexUrl );
            if ( !indexRes.ok ) throw new Error( `HTTP ${ indexRes.status }` );
            const index = await indexRes.json();

            const loads = ( index.files ?? [] ).map( file =>
                this._loadFile( caseId, file, items )
            );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.error( `EvidenceManager: Failed to load evidence index for "${ caseId }".`, error );
        }

        this._cache.set( caseId, items );
        this._items = items;

        EventBus.emit( 'evidence:loaded', { caseId, count: items.size } );
        console.info( `EvidenceManager: Loaded ${ items.size } evidence item(s) for "${ caseId }".` );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all evidence for the active case, optionally filtered
     * by category. Pinned items are sorted first.
     *
     * @param {string} [category] - 'all' or a specific category name.
     * @returns {Object[]}
     */
    getByCategory( category ) {

        const all = Array.from( this._items.values() );

        const filtered = ( !category || category === 'all' )
            ? all
            : all.filter( e => e.category === category );

        return this._sortPinnedFirst( filtered );

    }

    /**
     * Return a single evidence item by id, from the active case only.
     *
     * @param {string} evidenceId
     * @returns {Object|undefined}
     */
    getById( evidenceId ) {
        return this._items.get( evidenceId );
    }

    /**
     * Search active-case evidence by title, description, tags, or id.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    search( query ) {

        if ( !query.trim() ) return this._sortPinnedFirst( Array.from( this._items.values() ) );

        const q = query.toLowerCase();

        const matches = Array.from( this._items.values() ).filter( e =>
            e.id.toLowerCase().includes( q ) ||
            e.title.toLowerCase().includes( q ) ||
            ( e.description ?? '' ).toLowerCase().includes( q ) ||
            ( e.tags ?? [] ).some( t => t.toLowerCase().includes( q ) )
        );

        return this._sortPinnedFirst( matches );

    }

    /**
     * Filter a list of evidence by status.
     * Pass 'all' or omit to skip filtering.
     *
     * @param {Object[]} items
     * @param {string}   [status]
     * @returns {Object[]}
     */
    filterByStatus( items, status ) {

        if ( !status || status === 'all' ) return items;
        return items.filter( e => e.status === status );

    }

    /**
     * Filter a list of evidence by tag.
     * Pass 'all' or omit to skip filtering.
     *
     * @param {Object[]} items
     * @param {string}   [tag]
     * @returns {Object[]}
     */
    filterByTag( items, tag ) {

        if ( !tag || tag === 'all' ) return items;
        return items.filter( e => ( e.tags ?? [] ).includes( tag ) );

    }

    /**
     * Return all distinct categories present in the active case's evidence.
     *
     * @returns {string[]}
     */
    getCategories() {

        const set = new Set( Array.from( this._items.values() ).map( e => e.category ) );
        return Array.from( set ).sort();

    }

    /**
     * Return all distinct tags present in the active case's evidence.
     *
     * @returns {string[]}
     */
    getAllTags() {

        const set = new Set();
        this._items.forEach( e => ( e.tags ?? [] ).forEach( t => set.add( t ) ) );
        return Array.from( set ).sort();

    }

    /**
     * Resolve an evidence item linked to a given mail attachment id.
     * Searches only the currently loaded (active) case's evidence.
     * Returns null if no match exists (caller should fall back to
     * the generic attachment placeholder preview).
     *
     * @param {string} attachmentId
     * @returns {Object|null}
     */
    getByAttachmentId( attachmentId ) {

        for ( const item of this._items.values() ) {
            if ( item.sourceAttachmentId === attachmentId ) return item;
        }

        return null;

    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Toggle the pinned (Important) state of an evidence item.
     *
     * @param {string} evidenceId
     * @returns {void}
     */
    togglePin( evidenceId ) {

        const item = this._items.get( evidenceId );
        if ( !item ) return;

        item.favorite = !item.favorite;
        this._saveState( evidenceId );

        EventBus.emit( 'evidence:pinned', { evidenceId, pinned: item.favorite } );

    }

    /**
     * Save the player's personal notes for an evidence item.
     * Called on every autosave tick from the application layer.
     *
     * @param {string} evidenceId
     * @param {string} notes
     * @returns {void}
     */
    saveNotes( evidenceId, notes ) {

        const item = this._items.get( evidenceId );
        if ( !item ) return;

        item.notes = notes;
        this._saveState( evidenceId );

        EventBus.emit( 'evidence:note-updated', { evidenceId, notes } );

    }

    /**
     * Mark an evidence item as the last viewed item (for state restore).
     *
     * @param {string} evidenceId
     * @returns {void}
     */
    markLastViewed( evidenceId ) {

        // Clear the previous lastViewed flag.
        for ( const [ id, saved ] of Object.entries( this._state ) ) {
            if ( saved.lastViewed ) {
                this._state[ id ] = { ...saved, lastViewed: false };
            }
        }

        const item = this._items.get( evidenceId );
        if ( item ) {
            this._state[ evidenceId ] = {
                ...( this._state[ evidenceId ] ?? {} ),
                favorite:   item.favorite ?? false,
                notes:      item.notes ?? '',
                lastViewed: true,
            };
        }

        StorageManager.save( STORAGE_KEY, this._state );

    }

    /**
     * Return the id of the last viewed evidence item, if any.
     *
     * @returns {string|null}
     */
    getLastViewedId() {

        for ( const [ id, saved ] of Object.entries( this._state ) ) {
            if ( saved.lastViewed ) return id;
        }

        return null;

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — loading
    // ─────────────────────────────────────────────────────────────

    /**
     * Fetch and register a single evidence file into the given map.
     *
     * @param {string}              caseId
     * @param {string}              filename
     * @param {Map<string, Object>} targetMap
     * @returns {Promise<void>}
     */
    async _loadFile( caseId, filename, targetMap ) {

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/evidence/${ filename }` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();
            this._mergeItem( data, targetMap );
        }
        catch ( error ) {
            console.error( `EvidenceManager: Failed to load "${ filename }" for "${ caseId }".`, error );
        }

    }

    /**
     * Merge a loaded evidence object with persisted player state.
     *
     * @param {Object}              data
     * @param {Map<string, Object>} targetMap
     * @returns {void}
     */
    _mergeItem( data, targetMap ) {

        const saved = this._state[ data.id ] ?? {};

        const item = {
            ...data,
            favorite: saved.favorite ?? false,
            notes:    saved.notes    ?? '',
        };

        targetMap.set( item.id, item );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — persistence
    // ─────────────────────────────────────────────────────────────

    /**
     * Persist the state of a single evidence item to StorageManager.
     *
     * @param {string} evidenceId
     * @returns {void}
     */
    _saveState( evidenceId ) {

        const item = this._items.get( evidenceId );
        if ( !item ) return;

        this._state[ evidenceId ] = {
            ...( this._state[ evidenceId ] ?? {} ),
            favorite: item.favorite,
            notes:    item.notes,
        };

        StorageManager.save( STORAGE_KEY, this._state );

    }

    /**
     * Sort a list of evidence with pinned (favorite) items first,
     * preserving relative order otherwise.
     *
     * @param {Object[]} items
     * @returns {Object[]}
     */
    _sortPinnedFirst( items ) {

        return [ ...items ].sort( ( a, b ) => {
            if ( a.favorite === b.favorite ) return 0;
            return a.favorite ? -1 : 1;
        } );

    }

}

// Singleton.
const EvidenceManager = new EvidenceManagerClass();

export default EvidenceManager;
