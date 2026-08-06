/**
 * RandomEventEngine
 *
 * Purpose:
 *   Mission 18 — Investigation State Machine. Rolls a state's optional
 *   random events (e.g. "Witness unavailable", "Anonymous email
 *   received") deterministically from a stored seed, so the same
 *   playthrough always produces the same random outcomes on replay —
 *   required by the spec's "Random event seed" save field and useful
 *   for debugging ("why did this event fire?" is always answerable from
 *   the seed).
 *
 *   Uses mulberry32 — a small, fast, seedable PRNG. Not cryptographic;
 *   doesn't need to be for flavor events.
 *
 * Rules:
 *   Pure functions only. Never mutates its inputs — returns the next
 *   seed alongside the result so the caller decides whether to persist it.
 */

/**
 * @param {number} seed
 * @returns {Function} A function that returns the next float in [0,1)
 *   and mutates its own closure state — call repeatedly for a sequence.
 */
function _mulberry32( seed ) {

    let state = seed >>> 0;

    return () => {
        state |= 0; state = ( state + 0x6D2B79F5 ) | 0;
        let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
        t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
    };

}

/**
 * Roll every random event defined for a state against the given seed.
 * Each event has an independent `probability` (0–1) of firing.
 *
 * @param {Object[]} randomEvents - [{ id, probability, actions }]
 * @param {number}   seed
 * @returns {{ fired: Object[], nextSeed: number }}
 */
export function rollRandomEvents( randomEvents, seed ) {

    if ( !randomEvents?.length ) return { fired: [], nextSeed: seed };

    const rng    = _mulberry32( seed );
    const fired  = randomEvents.filter( evt => rng() < ( evt.probability ?? 0 ) );

    // Advance the seed deterministically so the next roll (next state,
    // or a re-roll after reload) doesn't repeat this one's sequence.
    const nextSeed = Math.floor( rng() * 4294967296 );

    return { fired, nextSeed };

}

export default { rollRandomEvents };
