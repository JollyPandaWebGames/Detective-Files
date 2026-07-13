/**
 * PeopleManager
 *
 * Purpose:
 *   Loads person profiles per case from /data/cases/{caseId}/people/,
 *   merges persisted player state (pinned, notes, lastViewed) from
 *   StorageManager, and provides query and action APIs for the
 *   Criminal Database application.
 *
 * Responsibilities:
 *   - Discover and fetch person JSON via the people/index.json manifest
 *   - Cache loaded people per case (load once per session)
 *   - Merge saved state over loaded data
 *   - Provide filtered/searched views
 *   - Resolve cross-references (by conversation id, evidence id, location id)
 *   - Persist all mutable state immediately via StorageManager
 *   - Emit EventBus events on load and state changes
 *
 * Storage key: 'people-state'
 * Format: {
 *   [personId]: {
 *     pinned:     boolean,
 *     notes:      string,
 *     lastViewed: boolean
 *   }
 * }
 *
 * Events emitted:
 *   person:loaded       — people loaded for a case  { caseId, count }
 *   person:pinned       — pin state toggled          { personId, pinned }
 *   person:note-updated — note saved                  { personId, notes }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Person JSON files are read-only; mutable state lives in StorageManager.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY = 'people-state';
const CASE_BASE   = './data/cases/';

class PeopleManagerClass {

    constructor() {

        /**
         * People for the currently loaded case, keyed by person id.
         * @type {Map<string, Object>}
         */
        this._people = new Map();

        /**
         * Per-case cache to avoid re-fetching.
         * @type {Map<string, Map<string, Object>>}
         */
        this._cache = new Map();

        /**
         * Persisted player state.
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

    initialize() {

        if ( this._stateLoaded ) return;

        this._state = StorageManager.load( STORAGE_KEY, {} );
        this._stateLoaded = true;

        console.info( 'PeopleManager: Persisted state loaded.' );

    }

    /**
     * Load all people belonging to a case.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        if ( !caseId ) {
            this._people.clear();
            this._activeCaseId = null;
            EventBus.emit( 'person:loaded', { caseId: null, count: 0 } );
            return;
        }

        this._activeCaseId = caseId;

        if ( this._cache.has( caseId ) ) {
            this._people = this._cache.get( caseId );
            EventBus.emit( 'person:loaded', { caseId, count: this._people.size } );
            return;
        }

        const people = new Map();

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/people/index.json` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            const loads = ( index.files ?? [] ).map( f => this._loadFile( caseId, f, people ) );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.error( `PeopleManager: Failed to load people for "${ caseId }".`, error );
        }

        this._cache.set( caseId, people );
        this._people = people;

        EventBus.emit( 'person:loaded', { caseId, count: people.size } );
        console.info( `PeopleManager: Loaded ${ people.size } person(s) for "${ caseId }".` );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all people, pinned first, then alphabetically.
     *
     * @returns {Object[]}
     */
    getAll() {

        return Array.from( this._people.values() )
            .sort( ( a, b ) => {
                if ( a.pinned !== b.pinned ) return a.pinned ? -1 : 1;
                return a.name.localeCompare( b.name );
            } );

    }

    /**
     * Return people filtered by role.
     *
     * @param {string} role - 'All' or a specific role string.
     * @returns {Object[]}
     */
    getByRole( role ) {

        if ( !role || role === 'All' ) return this.getAll();
        return this.getAll().filter( p => p.role === role );

    }

    /**
     * Return a single person by id.
     *
     * @param {string} personId
     * @returns {Object|undefined}
     */
    getById( personId ) {
        return this._people.get( personId );
    }

    /**
     * Search people by name, alias, occupation, role, or description.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    search( query ) {

        if ( !query.trim() ) return this.getAll();

        const q = query.toLowerCase();

        return this.getAll().filter( p =>
            p.name.toLowerCase().includes( q ) ||
            ( p.occupation ?? '' ).toLowerCase().includes( q ) ||
            ( p.role ?? '' ).toLowerCase().includes( q ) ||
            ( p.description ?? '' ).toLowerCase().includes( q ) ||
            ( p.knownAliases ?? [] ).some( a => a.toLowerCase().includes( q ) )
        );

    }

    /**
     * Find the person linked to a given conversation id.
     *
     * @param {string} convId
     * @returns {Object|null}
     */
    getByConversation( convId ) {

        for ( const p of this._people.values() ) {
            if ( ( p.relatedConversations ?? [] ).includes( convId ) ) return p;
        }

        return null;

    }

    /**
     * Find all people linked to a given evidence id.
     *
     * @param {string} evidenceId
     * @returns {Object[]}
     */
    getByEvidence( evidenceId ) {

        return Array.from( this._people.values() )
            .filter( p => ( p.relatedEvidence ?? [] ).includes( evidenceId ) );

    }

    /**
     * Return all distinct roles present in the active case.
     *
     * @returns {string[]}
     */
    getRoles() {

        const set = new Set( Array.from( this._people.values() ).map( p => p.role ) );
        return Array.from( set ).sort();

    }

    /**
     * Return the id of the last viewed person, if any.
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
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Toggle the pinned state of a person.
     *
     * @param {string} personId
     * @returns {void}
     */
    togglePin( personId ) {

        const person = this._people.get( personId );
        if ( !person ) return;

        person.pinned = !person.pinned;
        this._saveState( personId );

        EventBus.emit( 'person:pinned', { personId, pinned: person.pinned } );

    }

    /**
     * Save detective notes for a person.
     *
     * @param {string} personId
     * @param {string} notes
     * @returns {void}
     */
    saveNotes( personId, notes ) {

        const person = this._people.get( personId );
        if ( !person ) return;

        person.notes = notes;
        this._saveState( personId );

        EventBus.emit( 'person:note-updated', { personId, notes } );

    }

    /**
     * Return saved notes for a person.
     *
     * @param {string} personId
     * @returns {string}
     */
    getNotes( personId ) {
        return this._people.get( personId )?.notes ?? '';
    }

    /**
     * Mark a person as the last viewed (one entry at a time).
     *
     * @param {string} personId
     * @returns {void}
     */
    markLastViewed( personId ) {

        for ( const [ id, saved ] of Object.entries( this._state ) ) {
            if ( saved.lastViewed ) {
                this._state[ id ] = { ...saved, lastViewed: false };
            }
        }

        const person = this._people.get( personId );
        if ( person ) {
            this._state[ personId ] = {
                ...( this._state[ personId ] ?? {} ),
                pinned:     person.pinned ?? false,
                notes:      person.notes  ?? '',
                lastViewed: true,
            };
        }

        StorageManager.save( STORAGE_KEY, this._state );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    async _loadFile( caseId, filename, targetMap ) {

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/people/${ filename }` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();

            const saved = this._state[ data.id ] ?? {};
            const person = {
                ...data,
                pinned: saved.pinned ?? false,
                notes:  saved.notes  ?? data.notes ?? '',
            };

            targetMap.set( person.id, person );
        }
        catch ( error ) {
            console.error( `PeopleManager: Failed to load "${ filename }".`, error );
        }

    }

    _saveState( personId ) {

        const person = this._people.get( personId );
        if ( !person ) return;

        this._state[ personId ] = {
            ...( this._state[ personId ] ?? {} ),
            pinned:     person.pinned,
            notes:      person.notes,
        };

        StorageManager.save( STORAGE_KEY, this._state );

    }

}

// Singleton.
const PeopleManager = new PeopleManagerClass();

export default PeopleManager;
