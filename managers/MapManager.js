/**
 * MapManager
 *
 * Purpose:
 *   Loads investigation map data per case from /data/cases/{caseId}/map/,
 *   merges persisted player state (notes, zoom, center, selection) from
 *   StorageManager, and provides a query/action API for City Map.
 *
 * Responsibilities:
 *   - Fetch locations.json via the case map directory
 *   - Cache loaded map data per case
 *   - Persist player notes, last zoom, center position, and selected marker
 *   - Emit EventBus events on load and state changes
 *
 * Storage key: 'map-state'
 * Format: {
 *   [caseId]: {
 *     zoom:     number,
 *     center:   { x: number, y: number },
 *     selected: string|null,
 *     notes:    { [locationId]: string }
 *   }
 * }
 *
 * Events emitted:
 *   map:loaded        — data loaded for a case   { caseId, count }
 *   map:note-updated  — note saved               { caseId, locationId, notes }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Map JSON files are read-only; mutable state lives in StorageManager.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY = 'map-state';
const CASE_BASE   = './data/cases/';

class MapManagerClass {

    constructor() {

        /**
         * Map data for the active case.
         * @type {{ locations: Object[], mapWidth: number, mapHeight: number }|null}
         */
        this._mapData = null;

        /**
         * Locations keyed by id for fast lookup.
         * @type {Map<string, Object>}
         */
        this._locations = new Map();

        /**
         * Per-case data cache.
         * @type {Map<string, Object>}
         */
        this._cache = new Map();

        /**
         * Persisted player state across all cases.
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

        console.info( 'MapManager: Persisted state loaded.' );

    }

    /**
     * Load map data for a case.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        if ( !caseId ) {
            this._mapData   = null;
            this._locations.clear();
            this._activeCaseId = null;
            EventBus.emit( 'map:loaded', { caseId: null, count: 0 } );
            return;
        }

        this._activeCaseId = caseId;

        if ( this._cache.has( caseId ) ) {
            const cached = this._cache.get( caseId );
            this._mapData   = cached;
            this._locations = new Map( cached.locations.map( l => [ l.id, l ] ) );
            EventBus.emit( 'map:loaded', { caseId, count: this._locations.size } );
            return;
        }

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/map/locations.json` );

            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );

            const data = await res.json();
            this._mapData   = data;
            this._locations = new Map( ( data.locations ?? [] ).map( l => [ l.id, l ] ) );

            this._cache.set( caseId, data );

            EventBus.emit( 'map:loaded', { caseId, count: this._locations.size } );
            console.info( `MapManager: Loaded ${ this._locations.size } location(s) for "${ caseId }".` );
        }
        catch ( error ) {
            console.error( `MapManager: Failed to load map data for "${ caseId }".`, error );
            this._mapData   = { locations: [], mapWidth: 1200, mapHeight: 800 };
            this._locations = new Map();
            EventBus.emit( 'map:loaded', { caseId, count: 0 } );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    getMapDimensions() {
        return {
            width:  this._mapData?.mapWidth  ?? 1200,
            height: this._mapData?.mapHeight ?? 800,
        };
    }

    getAllLocations() {
        return Array.from( this._locations.values() );
    }

    getById( locationId ) {
        return this._locations.get( locationId );
    }

    /**
     * Search locations by name, address, type, or description.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    search( query ) {

        if ( !query.trim() ) return this.getAllLocations();

        const q = query.toLowerCase();

        return Array.from( this._locations.values() ).filter( l =>
            l.name.toLowerCase().includes( q ) ||
            ( l.address ?? '' ).toLowerCase().includes( q ) ||
            l.type.toLowerCase().includes( q ) ||
            ( l.description ?? '' ).toLowerCase().includes( q )
        );

    }

    /**
     * Find the location that contains a given evidence id.
     *
     * @param {string} evidenceId
     * @returns {Object|null}
     */
    getLocationByEvidence( evidenceId ) {

        for ( const loc of this._locations.values() ) {
            if ( ( loc.relatedEvidence ?? [] ).includes( evidenceId ) ) return loc;
        }

        return null;

    }

    /**
     * Find the location that contains a given camera id.
     *
     * @param {string} cameraId
     * @returns {Object|null}
     */
    getLocationByCamera( cameraId ) {

        for ( const loc of this._locations.values() ) {
            if ( ( loc.relatedCameras ?? [] ).includes( cameraId ) ) return loc;
        }

        return null;

    }

    // ─────────────────────────────────────────────────────────────
    // Notes
    // ─────────────────────────────────────────────────────────────

    getNotes( locationId ) {
        return this._state[ this._activeCaseId ]?.notes?.[ locationId ] ?? '';
    }

    saveNotes( locationId, text ) {

        const caseId = this._activeCaseId;
        if ( !caseId ) return;

        this._ensureCaseState( caseId );
        this._state[ caseId ].notes[ locationId ] = text;
        this._persist();

        EventBus.emit( 'map:note-updated', { caseId, locationId, notes: text } );

    }

    // ─────────────────────────────────────────────────────────────
    // View State
    // ─────────────────────────────────────────────────────────────

    getViewState() {

        const caseId = this._activeCaseId;
        if ( !caseId ) return { zoom: 1, center: { x: 600, y: 400 }, selected: null };

        return {
            zoom:     this._state[ caseId ]?.zoom     ?? 1,
            center:   this._state[ caseId ]?.center   ?? { x: 600, y: 400 },
            selected: this._state[ caseId ]?.selected ?? null,
        };

    }

    saveViewState( zoom, center, selectedId ) {

        const caseId = this._activeCaseId;
        if ( !caseId ) return;

        this._ensureCaseState( caseId );
        this._state[ caseId ].zoom     = zoom;
        this._state[ caseId ].center   = center;
        this._state[ caseId ].selected = selectedId;
        this._persist();

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    _ensureCaseState( caseId ) {

        if ( !this._state[ caseId ] ) {
            this._state[ caseId ] = { zoom: 1, center: { x: 600, y: 400 }, selected: null, notes: {} };
        }

        if ( !this._state[ caseId ].notes ) {
            this._state[ caseId ].notes = {};
        }

    }

    _persist() {
        StorageManager.save( STORAGE_KEY, this._state );
    }

}

const MapManager = new MapManagerClass();

export default MapManager;
