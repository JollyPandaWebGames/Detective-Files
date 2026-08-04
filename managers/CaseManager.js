/**
 * CaseManager
 *
 * Purpose:
 *   Loads case data from /data/cases/, merges persisted progress
 *   (status, progress%) from StorageManager, and provides a clean
 *   query/action API for the Case Management application.
 *
 * Responsibilities:
 *   - Discover and fetch all case JSON files via data/cases/index.json
 *   - Merge saved status/progress over loaded data
 *   - Provide filtered views: by folder, by difficulty, by search
 *   - Persist progress changes immediately via StorageManager
 *   - Emit EventBus events on load and on case start
 *
 * Storage key: 'case-progress'
 * Format: { [caseId]: { status, progress } }
 *
 * Folder semantics (derived, not stored):
 *   active   — status is 'Unlocked' or 'In Progress'
 *   solved   — status is 'Solved'
 *   archived — status is 'Archived'
 *
 * Events emitted:
 *   case:loaded     — initial load complete    { count }
 *   case:started     — investigation started    { caseId }
 *   case:progress   — progress value changed   { caseId, progress }
 *
 * Note (Epic 01.1): CaseManager is the case *data* authority only. Which
 * investigation is active lives in ActiveInvestigationManager, exposed
 * to applications via ApplicationContext.getActiveInvestigation() /
 * the 'investigationChanged' event — not through this manager.
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Case JSON files are read-only; mutable state lives in StorageManager.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY  = 'case-progress';
const CASE_INDEX   = './data/cases/index.json';
const CASE_BASE    = './data/cases/';

class CaseManagerClass {

    constructor() {

        /**
         * All loaded case objects (data + merged progress state).
         * @type {Map<string, Object>}
         */
        this._cases = new Map();

        /**
         * Persisted per-case progress, keyed by case id.
         * @type {Object}
         */
        this._progress = {};

        /**
         * Whether cases have been loaded.
         * @type {boolean}
         */
        this._loaded = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Discover and load all cases from data/cases/index.json.
     * Merges persisted progress over loaded data.
     * Safe to call multiple times — returns immediately if already loaded.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        if ( this._loaded ) return;

        this._progress = StorageManager.load( STORAGE_KEY, {} );

        try {
            const indexRes = await fetch( CASE_INDEX );
            if ( !indexRes.ok ) throw new Error( `HTTP ${ indexRes.status }` );
            const index = await indexRes.json();

            const loads = ( index.files ?? [] ).map( file => this._loadFile( file ) );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.error( 'CaseManager: Failed to load case index.', error );
        }

        this._loaded = true;
        EventBus.emit( 'case:loaded', { count: this._cases.size } );
        console.info( `CaseManager: Loaded ${ this._cases.size } case(s).` );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all cases in a given folder, sorted by id.
     *
     * @param {string} folder - 'active' | 'solved' | 'archived'
     * @returns {Object[]}
     */
    getFolder( folder ) {

        const all = Array.from( this._cases.values() );

        let filtered;

        if ( folder === 'solved' ) {
            filtered = all.filter( c => c.status === 'Solved' );
        }
        else if ( folder === 'archived' ) {
            filtered = all.filter( c => c.status === 'Archived' );
        }
        else {
            // active — unlocked, in progress, or locked (still "active" content)
            filtered = all.filter( c =>
                c.status === 'Unlocked' ||
                c.status === 'In Progress' ||
                c.status === 'Locked'
            );
        }

        return filtered.sort( ( a, b ) => a.id.localeCompare( b.id ) );

    }

    /**
     * Return a single case by id.
     *
     * @param {string} caseId
     * @returns {Object|undefined}
     */
    getById( caseId ) {
        return this._cases.get( caseId );
    }

    /**
     * Search cases by title.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    search( query ) {

        if ( !query.trim() ) return this.getFolder( 'active' );

        const q = query.toLowerCase();

        return Array.from( this._cases.values() )
            .filter( c => c.title.toLowerCase().includes( q ) )
            .sort( ( a, b ) => a.id.localeCompare( b.id ) );

    }

    /**
     * Filter a list of cases by difficulty.
     * Pass 'all' or omit to skip filtering.
     *
     * @param {Object[]} cases
     * @param {string}   [difficulty]
     * @returns {Object[]}
     */
    filterByDifficulty( cases, difficulty ) {

        if ( !difficulty || difficulty === 'all' ) return cases;
        return cases.filter( c => c.difficulty === difficulty );

    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Start an investigation: mark the case as "In Progress",
     * persist it, and emit case:started so other systems
     * (e.g. Police Mail) can react.
     *
     * No-op if the case is locked or already in progress/solved.
     *
     * @param {string} caseId
     * @returns {void}
     */
    startCase( caseId ) {

        const c = this._cases.get( caseId );
        if ( !c ) return;

        if ( c.status === 'Locked' ) {
            console.warn( `CaseManager: Cannot start locked case "${ caseId }".` );
            return;
        }

        if ( c.status === 'In Progress' || c.status === 'Solved' ) {
            // Already started — just re-emit so dependent systems can re-sync.
            EventBus.emit( 'case:started', { caseId } );
            return;
        }

        c.status   = 'In Progress';
        c.progress = c.progress ?? 0;

        this._saveProgress( caseId );

        EventBus.emit( 'case:started', { caseId } );
        console.info( `CaseManager: Case "${ caseId }" started.` );

    }

    /**
     * Update the progress percentage for a case.
     *
     * @param {string} caseId
     * @param {number} progress - 0–100
     * @returns {void}
     */
    setProgress( caseId, progress ) {

        const c = this._cases.get( caseId );
        if ( !c ) return;

        c.progress = Math.max( 0, Math.min( 100, progress ) );
        this._saveProgress( caseId );

        EventBus.emit( 'case:progress', { caseId, progress: c.progress } );

    }

    /**
     * Mark a case as Solved. Called by ActiveInvestigationManager when
     * an investigation is completed — CaseManager remains the single
     * source of truth for case data, ActiveInvestigationManager owns the
     * "only one active investigation" rule on top of it.
     *
     * @param {string} caseId
     * @returns {void}
     */
    completeCase( caseId ) {

        const c = this._cases.get( caseId );
        if ( !c ) return;

        c.status   = 'Solved';
        c.progress = 100;

        this._saveProgress( caseId );

    }

    /**
     * Move a case to the Archived folder.
     *
     * @param {string} caseId
     * @returns {void}
     */
    archiveCase( caseId ) {

        const c = this._cases.get( caseId );
        if ( !c ) return;

        c.status = 'Archived';
        this._saveProgress( caseId );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — loading
    // ─────────────────────────────────────────────────────────────

    /**
     * Fetch and register a single case file.
     *
     * @param {string} filename
     * @returns {Promise<void>}
     */
    async _loadFile( filename ) {

        try {
            const res = await fetch( `${ CASE_BASE }${ filename }` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();
            this._mergeCase( data );
        }
        catch ( error ) {
            console.error( `CaseManager: Failed to load "${ filename }".`, error );
        }

    }

    /**
     * Merge a loaded case object with persisted progress and store it.
     *
     * @param {Object} data - Raw case JSON.
     * @returns {void}
     */
    _mergeCase( data ) {

        const saved = this._progress[ data.id ] ?? {};

        const c = {
            ...data,
            status:   saved.status   ?? data.status   ?? 'Locked',
            progress: saved.progress ?? 0,
        };

        this._cases.set( c.id, c );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — persistence
    // ─────────────────────────────────────────────────────────────

    /**
     * Persist the progress state of a single case to StorageManager.
     *
     * @param {string} caseId
     * @returns {void}
     */
    _saveProgress( caseId ) {

        const c = this._cases.get( caseId );
        if ( !c ) return;

        this._progress[ caseId ] = {
            status:   c.status,
            progress: c.progress,
        };

        StorageManager.save( STORAGE_KEY, this._progress );

    }

}

// Singleton.
const CaseManager = new CaseManagerClass();

export default CaseManager;
