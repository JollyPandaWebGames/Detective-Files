/**
 * StorageManager
 *
 * Purpose:
 *   The only module in the workstation permitted to access LocalStorage.
 *   All persistence operations must be routed through this manager.
 *
 * Responsibilities:
 *   - Save and load serialized state
 *   - Namespace all keys to prevent collisions
 *   - Abstract the storage backend so it can be replaced later
 *
 * Future:
 *   When the backend is introduced, only this file needs modification.
 *   No other module should require changes for the storage migration.
 *
 * Rules:
 *   No other module may call localStorage directly.
 *   All data must be JSON-serializable.
 */

const STORAGE_NAMESPACE = 'detective-files';

class StorageManagerClass {

    /**
     * Build a namespaced storage key to prevent collisions.
     *
     * @param {string} key - The logical key name.
     * @returns {string}   - The namespaced key.
     */
    _buildKey( key ) {
        return `${ STORAGE_NAMESPACE }:${ key }`;
    }

    /**
     * Persist a value to storage.
     *
     * @param {string} key   - The logical key name.
     * @param {*}      value - Any JSON-serializable value.
     * @returns {boolean}    - True on success, false on failure.
     */
    save( key, value ) {

        try {
            const serialized = JSON.stringify( value );
            localStorage.setItem( this._buildKey( key ), serialized );
            return true;
        }
        catch ( error ) {
            console.error( `StorageManager: Failed to save "${ key }".`, error );
            return false;
        }

    }

    /**
     * Load a value from storage.
     *
     * @param {string} key            - The logical key name.
     * @param {*}      [defaultValue] - Returned when the key does not exist.
     * @returns {*}                   - The stored value, or defaultValue.
     */
    load( key, defaultValue = null ) {

        try {
            const raw = localStorage.getItem( this._buildKey( key ) );

            if ( raw === null ) {
                return defaultValue;
            }

            return JSON.parse( raw );
        }
        catch ( error ) {
            console.error( `StorageManager: Failed to load "${ key }".`, error );
            return defaultValue;
        }

    }

    /**
     * Remove a single value from storage.
     *
     * @param {string} key - The logical key name.
     * @returns {boolean}  - True on success.
     */
    remove( key ) {

        try {
            localStorage.removeItem( this._buildKey( key ) );
            return true;
        }
        catch ( error ) {
            console.error( `StorageManager: Failed to remove "${ key }".`, error );
            return false;
        }

    }

    /**
     * Check whether a key exists in storage.
     *
     * @param {string} key - The logical key name.
     * @returns {boolean}
     */
    has( key ) {
        return localStorage.getItem( this._buildKey( key ) ) !== null;
    }

    /**
     * Remove all Detective Files data from storage.
     * Does not affect keys belonging to other applications.
     *
     * @returns {void}
     */
    clearAll() {

        const prefix = `${ STORAGE_NAMESPACE }:`;

        Object.keys( localStorage )
            .filter( key => key.startsWith( prefix ) )
            .forEach( key => localStorage.removeItem( key ) );

    }

}

// Singleton — one shared storage manager for the entire workstation.
const StorageManager = new StorageManagerClass();

export default StorageManager;
