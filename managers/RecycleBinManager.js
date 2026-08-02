/**
 * RecycleBinManager
 *
 * Purpose:
 *   Intercepts item deletions across the workstation and stores them
 *   in a recoverable bin. Supports restore and permanent deletion.
 *
 * Storage key: 'recycle-bin'
 * Format: { items: [ { id, type, title, caseId, deletedAt, data } ] }
 *
 * Events consumed:
 *   board:node-removed   — deleted board nodes
 *
 * Events emitted:
 *   recycle-bin:item-added    { item }
 *   recycle-bin:item-restored { item }
 *   recycle-bin:item-deleted  { id }
 *   recycle-bin:cleared       {}
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY = 'recycle-bin';

class RecycleBinManagerClass {

    constructor() {
        this._items   = [];
        this._loaded  = false;
        this._counter = Date.now();
    }

    initialize() {
        if ( this._loaded ) return;
        const saved = StorageManager.load( STORAGE_KEY, { items: [] } );
        this._items = saved.items ?? [];
        this._loaded = true;

        // Listen for board node deletions.
        EventBus.on( 'board:updated', ( { type, id, nodeId } ) => {
            if ( type === 'node-removed' && nodeId ) {
                // Note: node data already gone from BoardManager at this point.
                // We capture via the recycle(item) call from the app layer instead.
            }
        } );

        console.info( `RecycleBinManager: Initialized with ${ this._items.length } item(s).` );
    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Add an item to the recycle bin.
     *
     * @param {{ type: string, title: string, caseId: string|null, data: Object }} itemData
     * @returns {Object} The stored item.
     */
    recycle( itemData ) {

        const item = {
            id:        `rb-${ ++this._counter }`,
            type:      itemData.type   ?? 'unknown',
            title:     itemData.title  ?? 'Untitled',
            caseId:    itemData.caseId ?? null,
            deletedAt: new Date().toISOString(),
            data:      itemData.data   ?? {},
        };

        this._items.unshift( item );   // newest first
        this._persist();

        EventBus.emit( 'recycle-bin:item-added', { item } );
        return item;

    }

    /**
     * Return all items, optionally filtered by type or caseId.
     *
     * @param {{ type?: string, caseId?: string }} [filter]
     * @returns {Object[]}
     */
    getAll( filter = {} ) {

        return this._items.filter( item => {
            if ( filter.type   && item.type   !== filter.type   ) return false;
            if ( filter.caseId && item.caseId !== filter.caseId ) return false;
            return true;
        } );

    }

    /**
     * Return total item count.
     * @returns {number}
     */
    getCount() { return this._items.length; }

    /**
     * Restore an item — emits event so the originating app can re-add it.
     *
     * @param {string} id
     * @returns {Object|null}
     */
    restore( id ) {

        const item = this._items.find( i => i.id === id );
        if ( !item ) return null;

        this._items = this._items.filter( i => i.id !== id );
        this._persist();

        EventBus.emit( 'recycle-bin:item-restored', { item } );
        return item;

    }

    /**
     * Permanently delete an item.
     *
     * @param {string} id
     * @returns {void}
     */
    deletePermanently( id ) {

        this._items = this._items.filter( i => i.id !== id );
        this._persist();
        EventBus.emit( 'recycle-bin:item-deleted', { id } );

    }

    /**
     * Empty the entire recycle bin.
     *
     * @returns {void}
     */
    emptyBin() {

        this._items = [];
        this._persist();
        EventBus.emit( 'recycle-bin:cleared', {} );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    _persist() {
        StorageManager.save( STORAGE_KEY, { items: this._items } );
    }

}

const RecycleBinManager = new RecycleBinManagerClass();
export default RecycleBinManager;
