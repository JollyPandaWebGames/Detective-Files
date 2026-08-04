/**
 * ObjectiveGraph
 *
 * Purpose:
 *   Pure graph logic for the Objective Engine (Mission 16). Given a set
 *   of objective definitions and their runtime state, decides what's
 *   locked, available, hidden, or completed, and computes progress.
 *
 *   Contains no EventBus subscriptions, no persistence, and no
 *   investigation-specific logic — ObjectiveManager owns all of that.
 *   This module is pure functions over plain data so it's easy to unit
 *   test and easy for a future Case Editor to reuse directly.
 *
 * Runtime status values (per objective):
 *   'hidden'     — hidden:true and not yet revealed
 *   'locked'     — dependencies not yet all completed
 *   'available'  — dependencies met, conditions not yet satisfied
 *   'completed'  — all conditions satisfied, actions have run
 *   'skipped'    — optional objective explicitly skipped (never required)
 */

/**
 * Recompute every objective's status from its dependencies and the
 * current completed/revealed sets. Does not touch 'completed' or
 * 'skipped' objectives — those are terminal until the case resets.
 *
 * @param {Map<string,Object>} definitions - id -> objective definition
 * @param {Map<string,Object>} states      - id -> { status, ... }
 * @returns {void} Mutates `states` in place.
 */
export function recomputeAvailability( definitions, states ) {

    for ( const [ id, def ] of definitions ) {

        const state = states.get( id );
        if ( !state || state.status === 'completed' || state.status === 'skipped' ) continue;

        if ( def.hidden && !state.revealed ) {
            state.status = 'hidden';
            continue;
        }

        const depsMet = ( def.dependencies ?? [] ).every(
            depId => states.get( depId )?.status === 'completed'
        );

        state.status = depsMet ? 'available' : 'locked';

    }

}

/**
 * @param {Map<string,Object>} definitions
 * @param {Map<string,Object>} states
 * @returns {{progress:number, requiredComplete:boolean, completedCount:number, totalCount:number}}
 */
export function computeProgress( definitions, states ) {

    let totalCount        = 0;
    let completedCount    = 0;
    let requiredTotal      = 0;
    let requiredCompleted  = 0;

    for ( const [ id, def ] of definitions ) {

        const state = states.get( id );

        // Hidden objectives never revealed don't count toward the total —
        // the player was never shown them, so they can't contribute to
        // (or be blamed for) an incomplete percentage.
        if ( state.status === 'hidden' ) continue;

        totalCount++;
        if ( state.status === 'completed' ) completedCount++;

        if ( !def.optional ) {
            requiredTotal++;
            if ( state.status === 'completed' ) requiredCompleted++;
        }

    }

    const progress = totalCount === 0 ? 0 : Math.round( ( completedCount / totalCount ) * 100 );

    return {
        progress,
        requiredComplete: requiredTotal > 0 && requiredCompleted === requiredTotal,
        completedCount,
        totalCount,
    };

}

/**
 * Objectives currently visible to the player — everything except
 * 'hidden'. Locked ones are still visible (greyed out) so the player
 * can see what's coming; only truly hidden ones are invisible per spec.
 *
 * @param {Map<string,Object>} definitions
 * @param {Map<string,Object>} states
 * @returns {Object[]} Definitions merged with their current status.
 */
export function getVisibleObjectives( definitions, states ) {

    const result = [];

    for ( const [ id, def ] of definitions ) {
        const state = states.get( id );
        if ( state.status === 'hidden' ) continue;
        result.push( { ...def, status: state.status, unlockedAt: state.unlockedAt, completedAt: state.completedAt } );
    }

    return result;

}

/**
 * @param {Map<string,Object>} definitions
 * @param {Map<string,Object>} states
 * @returns {Object[]} Visible + status==='available', sorted by priority.
 */
export function getAvailableObjectives( definitions, states ) {

    const priorityOrder = { critical: 0, normal: 1, optional: 2, hidden: 3 };

    return getVisibleObjectives( definitions, states )
        .filter( o => o.status === 'available' )
        .sort( ( a, b ) => ( priorityOrder[ a.priority ] ?? 1 ) - ( priorityOrder[ b.priority ] ?? 1 ) );

}

export default {
    recomputeAvailability,
    computeProgress,
    getVisibleObjectives,
    getAvailableObjectives,
};
