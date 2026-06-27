/**
 * Utils
 *
 * Purpose:
 *   Generic utility functions shared across the workstation.
 *   No business logic. No DOM assumptions. Pure functions only.
 *
 * Rules:
 *   Functions here must be stateless and side-effect free.
 *   If a utility belongs to a specific domain, put it there instead.
 */

/**
 * Clamp a number between a minimum and maximum value.
 *
 * @param {number} value - The input value.
 * @param {number} min   - The minimum allowed value.
 * @param {number} max   - The maximum allowed value.
 * @returns {number}
 */
export function clamp( value, min, max ) {
    return Math.min( Math.max( value, min ), max );
}

/**
 * Generate a simple unique id string.
 * Not cryptographically secure — for UI element ids only.
 *
 * @param {string} [prefix='id'] - Optional prefix.
 * @returns {string}
 */
export function uid( prefix = 'id' ) {
    return `${ prefix }-${ Date.now() }-${ Math.floor( Math.random() * 10000 ) }`;
}

/**
 * Fetch and parse a JSON file.
 * Returns null on failure rather than throwing.
 *
 * @param {string} url - Path to the JSON resource.
 * @returns {Promise<Object|null>}
 */
export async function fetchJSON( url ) {

    try {
        const response = await fetch( url );

        if ( !response.ok ) {
            throw new Error( `HTTP ${ response.status } — ${ url }` );
        }

        return await response.json();
    }
    catch ( error ) {
        console.error( `fetchJSON: Failed to load "${ url }".`, error );
        return null;
    }

}

/**
 * Debounce a function call.
 * Prevents rapid repeated invocations (e.g. resize events).
 *
 * @param {Function} fn    - The function to debounce.
 * @param {number}   delay - Milliseconds to wait after the last call.
 * @returns {Function}
 */
export function debounce( fn, delay ) {

    let timer = null;

    return ( ...args ) => {
        clearTimeout( timer );
        timer = setTimeout( () => fn( ...args ), delay );
    };

}
