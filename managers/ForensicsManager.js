/**
 * ForensicsManager
 *
 * Purpose:
 *   Manages the laboratory analysis queue for the current case.
 *   Analyses are submitted by the player, run on a real-time timer
 *   driven by Unix timestamps (so progress survives app close/reopen),
 *   and complete automatically once their duration has elapsed.
 *
 * Responsibilities:
 *   - Load available analysis definitions from /data/cases/{caseId}/forensics/
 *   - Track submitted / in-progress / completed analyses via StorageManager
 *   - Use requestedAt + duration timestamps for timer resolution
 *     (no active intervals — completion is checked on every read)
 *   - Load result JSON files when an analysis completes
 *   - Inject new evidence into EvidenceManager when a result is collected
 *   - Inject HQ mail into MailManager when an analysis completes
 *   - Persist all mutable state immediately
 *
 * Storage key: 'forensics-state'
 * Format: {
 *   [analysisId]: {
 *     requestedAt: number  (Unix ms timestamp),
 *     completed:   boolean,
 *     collected:   boolean,
 *     notes:       string
 *   }
 * }
 *
 * Timer architecture:
 *   Completion is timestamp-driven, not interval-driven.
 *   isComplete(id) = (Date.now() >= requestedAt + duration * 1000)
 *   The app polls _checkCompletions() on open() and on a 5-second
 *   interval while the Forensics Lab window is open.
 *
 * Events emitted:
 *   forensics:requested    — analysis submitted  { analysisId, type }
 *   forensics:completed    — timer elapsed       { analysisId, type }
 *   forensics:collected    — report collected    { analysisId, result }
 *   forensics:note-updated — note saved          { analysisId, notes }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   JSON files are read-only; mutable state lives in StorageManager only.
 */

import StorageManager  from './StorageManager.js';
import EventBus        from '../core/EventBus.js';
import EvidenceManager from './EvidenceManager.js';

const STORAGE_KEY = 'forensics-state';
const CASE_BASE   = './data/cases/';

class ForensicsManagerClass {

    constructor() {

        /**
         * Available analysis definitions for the active case, keyed by id.
         * @type {Map<string, Object>}
         */
        this._analyses = new Map();

        /**
         * Per-case cache.
         * @type {Map<string, Map<string, Object>>}
         */
        this._cache = new Map();

        /**
         * Persisted queue state.
         * @type {Object}
         */
        this._state = {};

        /**
         * Cached result objects keyed by analysisId.
         * @type {Map<string, Object>}
         */
        this._results = new Map();

        /** @type {string|null} */
        this._activeCaseId = null;

        /** @type {boolean} */
        this._stateLoaded = false;

        /** @type {number|null} setInterval id for completion polling */
        this._pollTimer = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    initialize() {

        if ( this._stateLoaded ) return;

        this._state = StorageManager.load( STORAGE_KEY, {} );
        this._stateLoaded = true;

        console.info( 'ForensicsManager: Persisted state loaded.' );

    }

    /**
     * Load analysis definitions for a case.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        if ( !caseId ) {
            this._analyses.clear();
            this._activeCaseId = null;
            return;
        }

        this._activeCaseId = caseId;

        if ( this._cache.has( caseId ) ) {
            this._analyses = this._cache.get( caseId );
            this._checkCompletions();
            return;
        }

        const analyses = new Map();

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/forensics/index.json` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            const loads = ( index.analyses ?? [] ).map( f => this._loadFile( caseId, f, analyses ) );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.warn( `ForensicsManager: No forensics data for "${ caseId }".` );
        }

        this._cache.set( caseId, analyses );
        this._analyses = analyses;
        this._checkCompletions();

        console.info( `ForensicsManager: Loaded ${ analyses.size } analysis definition(s) for "${ caseId }".` );

    }

    /**
     * Case 00 replay support — wipe persisted request/result state for
     * every analysis belonging to this case, and drop the case from the
     * in-memory cache so the next loadForCase() re-fetches clean. Call
     * before loadForCase(). Safe with respect to the completion-polling
     * interval — it only checks state that still exists.
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
            const res = await fetch( `${ CASE_BASE }${ caseId }/forensics/index.json` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            return ( index.analyses ?? [] ).map( f => f.replace( /\.json$/, '' ) );
        }
        catch ( error ) {
            console.warn( `ForensicsManager: Could not resolve ids for "${ caseId }" during reset.`, error );
            return [];
        }

    }

    /**
     * Start polling for completions.
     * Call when the Forensics Lab window opens.
     *
     * @returns {void}
     */
    startPolling() {

        this.stopPolling();
        this._checkCompletions();
        this._pollTimer = setInterval( () => this._checkCompletions(), 5000 );

    }

    /**
     * Stop polling. Call when the Forensics Lab window closes.
     *
     * @returns {void}
     */
    stopPolling() {

        if ( this._pollTimer !== null ) {
            clearInterval( this._pollTimer );
            this._pollTimer = null;
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all analyses for the active case, enriched with queue state.
     * Each item has an additional `queueStatus` field:
     *   'Available' | 'Pending' | 'In Progress' | 'Completed' | 'Collected'
     *
     * @returns {Object[]}
     */
    getAll() {

        return Array.from( this._analyses.values() ).map( a => this._enrich( a ) );

    }

    /**
     * Return analyses filtered by queue status.
     *
     * @param {string} status — 'Available' | 'Pending' | 'In Progress' | 'Completed' | 'Collected'
     * @returns {Object[]}
     */
    getByStatus( status ) {
        return this.getAll().filter( a => a.queueStatus === status );
    }

    /**
     * Return a single enriched analysis by id.
     *
     * @param {string} analysisId
     * @returns {Object|undefined}
     */
    getById( analysisId ) {

        const a = this._analyses.get( analysisId );
        return a ? this._enrich( a ) : undefined;

    }

    /**
     * Search analyses by evidence title, type, or status.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    search( query ) {

        if ( !query.trim() ) return this.getAll();
        const q = query.toLowerCase();
        return this.getAll().filter( a =>
            a.type.toLowerCase().includes( q ) ||
            ( a.evidenceTitle ?? '' ).toLowerCase().includes( q ) ||
            a.queueStatus.toLowerCase().includes( q )
        );

    }

    /**
     * Return the cached result for a completed analysis, or null.
     *
     * @param {string} analysisId
     * @returns {Object|null}
     */
    getResult( analysisId ) {
        return this._results.get( analysisId ) ?? null;
    }

    /**
     * Return remaining seconds for a pending/in-progress analysis.
     * Returns 0 if completed or not yet submitted.
     *
     * @param {string} analysisId
     * @returns {number}
     */
    getRemainingSeconds( analysisId ) {

        const saved = this._state[ analysisId ];
        if ( !saved?.requestedAt ) return 0;

        const analysis = this._analyses.get( analysisId );
        if ( !analysis ) return 0;

        const completesAt = saved.requestedAt + analysis.duration * 1000;
        const remaining   = Math.max( 0, Math.ceil( ( completesAt - Date.now() ) / 1000 ) );
        return remaining;

    }

    /**
     * Return notes for an analysis.
     *
     * @param {string} analysisId
     * @returns {string}
     */
    getNotes( analysisId ) {
        return this._state[ analysisId ]?.notes ?? '';
    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Submit an analysis for processing.
     * Sets requestedAt to now; queueStatus becomes 'In Progress'.
     *
     * @param {string} analysisId
     * @returns {void}
     */
    requestAnalysis( analysisId ) {

        const a = this._analyses.get( analysisId );
        if ( !a ) return;

        const existing = this._state[ analysisId ];
        if ( existing?.requestedAt ) {
            console.warn( `ForensicsManager: Analysis "${ analysisId }" already submitted.` );
            return;
        }

        this._state[ analysisId ] = {
            requestedAt: Date.now(),
            completed:   false,
            collected:   false,
            notes:       this._state[ analysisId ]?.notes ?? '',
        };

        StorageManager.save( STORAGE_KEY, this._state );

        EventBus.emit( 'forensics:requested', { analysisId, type: a.type } );

        console.info( `ForensicsManager: Analysis "${ analysisId }" submitted. Duration: ${ a.duration }s.` );

    }

    /**
     * Collect a completed report.
     * Marks it collected, injects new evidence, emits events, generates HQ mail.
     *
     * @param {string} analysisId
     * @returns {Promise<void>}
     */
    async collectResult( analysisId ) {

        const a      = this._analyses.get( analysisId );
        const saved  = this._state[ analysisId ];
        const result = this._results.get( analysisId );

        if ( !a || !saved?.completed || saved?.collected || !result ) return;

        saved.collected = true;
        StorageManager.save( STORAGE_KEY, this._state );

        // Inject any new evidence items the result unlocks.
        for ( const evId of result.newEvidence ?? [] ) {
            await this._injectNewEvidence( evId, a, result );
        }

        EventBus.emit( 'forensics:collected', { analysisId, result } );

        // Generate a HQ notification mail so the detective is informed.
        this._generateCompletionMail( a, result );

        console.info( `ForensicsManager: Report collected for "${ analysisId }".` );

    }

    /**
     * Save detective notes for an analysis.
     *
     * @param {string} analysisId
     * @param {string} notes
     * @returns {void}
     */
    saveNotes( analysisId, notes ) {

        if ( !this._state[ analysisId ] ) {
            this._state[ analysisId ] = { requestedAt: null, completed: false, collected: false, notes: '' };
        }

        this._state[ analysisId ].notes = notes;
        StorageManager.save( STORAGE_KEY, this._state );

        EventBus.emit( 'forensics:note-updated', { analysisId, notes } );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — timer
    // ─────────────────────────────────────────────────────────────

    /**
     * Check all submitted analyses for completion.
     * Emits 'forensics:completed' for any that just crossed their deadline.
     *
     * @returns {void}
     */
    _checkCompletions() {

        const now = Date.now();

        for ( const [ id, saved ] of Object.entries( this._state ) ) {

            if ( !saved.requestedAt || saved.completed ) continue;

            const analysis = this._analyses.get( id );
            if ( !analysis ) continue;

            const completesAt = saved.requestedAt + analysis.duration * 1000;

            if ( now >= completesAt ) {
                saved.completed = true;
                StorageManager.save( STORAGE_KEY, this._state );

                // Load result file.
                this._loadResult( analysis ).then( () => {
                    EventBus.emit( 'forensics:completed', { analysisId: id, type: analysis.type } );
                } );
            }

        }

    }

    async _loadResult( analysis ) {

        if ( this._results.has( analysis.id ) ) return;

        if ( !analysis.resultFile ) return;

        try {
            const url = `${ CASE_BASE }${ this._activeCaseId }/forensics/${ analysis.resultFile }`;
            const res = await fetch( url );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const result = await res.json();
            this._results.set( analysis.id, result );
        }
        catch ( error ) {
            console.error( `ForensicsManager: Failed to load result for "${ analysis.id }".`, error );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — evidence injection
    // ─────────────────────────────────────────────────────────────

    async _injectNewEvidence( evId, analysis, result ) {

        // Build a minimal evidence item from the analysis context.
        const item = {
            id:          evId,
            caseId:      this._activeCaseId,
            title:       `${ analysis.type } Report — ${ analysis.evidenceTitle }`,
            category:    'Documents',
            type:        'document',
            status:      'Analyzed',
            location:    'City Forensics Laboratory',
            collectedBy: 'Forensics Lab',
            date:        new Date().toISOString().slice( 0, 10 ),
            description: result.summary,
            thumbnail:   null,
            preview:     null,
            tags:        [ 'forensics', analysis.type.toLowerCase() ],
            related:     [ analysis.evidenceId ],
            sourceAttachmentId: null,
            chainOfCustody: [
                { stage: 'Analyzed', by: 'City Forensics Laboratory', date: new Date().toISOString().slice( 0, 16 ).replace( 'T', ' ' ) },
            ],
        };

        EvidenceManager.registerItem( item );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — HQ mail generation
    // ─────────────────────────────────────────────────────────────

    _generateCompletionMail( analysis, result ) {

        // Dynamically import MailManager to avoid circular dependency at module load.
        import( './MailManager.js' ).then( ( { default: MailManager } ) => {

            const mailId = `mail-forensics-${ analysis.id }-${ Date.now() }`;

            const mail = {
                id:       mailId,
                caseId:   this._activeCaseId,
                from:     'Dr. Lena Marsh',
                fromTitle: 'City Forensics Laboratory',
                subject:  `Lab Results Ready — ${ analysis.type } Analysis`,
                date:     new Date().toISOString().slice( 0, 16 ).replace( 'T', ' ' ),
                priority: 'Medium',
                read:     false,
                starred:  false,
                folder:   'inbox',
                attachments: [],
                body: `Detective,\n\nThe ${ analysis.type } analysis on evidence "${ analysis.evidenceTitle }" has been completed.\n\nSummary: ${ result.summary }\n\nConfidence: ${ result.confidence }%\n\nPlease collect the full report from the Forensics Lab at your earliest convenience.\n\n— Dr. Lena Marsh\nCity Forensics Laboratory`,
            };

            MailManager.injectMail( mail );

        } ).catch( () => {
            // MailManager not available — silently skip.
        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — loading
    // ─────────────────────────────────────────────────────────────

    async _loadFile( caseId, filename, targetMap ) {

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/forensics/${ filename }` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();
            targetMap.set( data.id, data );
        }
        catch ( error ) {
            console.error( `ForensicsManager: Failed to load "${ filename }".`, error );
        }

    }

    /**
     * Enrich an analysis definition with its current queue state.
     *
     * @param {Object} analysis
     * @returns {Object}
     */
    _enrich( analysis ) {

        const saved = this._state[ analysis.id ];

        let queueStatus = analysis.status; // 'Available' by default from JSON.

        if ( saved?.requestedAt ) {
            if ( saved.collected ) {
                queueStatus = 'Collected';
            }
            else if ( saved.completed ) {
                queueStatus = 'Completed';
            }
            else if ( Date.now() >= saved.requestedAt + analysis.duration * 1000 ) {
                // Completed but not yet emitted — will be caught by next poll.
                queueStatus = 'Completed';
            }
            else {
                queueStatus = 'In Progress';
            }
        }

        return {
            ...analysis,
            queueStatus,
            requestedAt:  saved?.requestedAt  ?? null,
            collected:    saved?.collected    ?? false,
        };

    }

}

// Singleton.
const ForensicsManager = new ForensicsManagerClass();

export default ForensicsManager;
