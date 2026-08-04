/**
 * ObjectiveActions
 *
 * Purpose:
 *   Executes the `actions` array of an objective once its conditions are
 *   satisfied. Contains no investigation-specific logic — every action
 *   type is generic to CID OS.
 *
 * Supported action types (Mission 16 spec):
 *   unlockObjective, unlockEvidence, unlockConversation, unlockPerson,
 *   unlockEmail, unlockCCTV, unlockLocation, unlockForensics,
 *   revealHiddenObjective, changePhase, emitEvent
 *
 * On the unlockX content actions:
 *   There is no content-gating engine yet (Mission 19 — Dynamic Content
 *   Unlock Engine — is still Planned). Every application already shows
 *   all of an active case's content, so these actions cannot "reveal"
 *   anything a player couldn't already see. What they DO right now:
 *   record the unlock in objective history (so a future Case Editor and
 *   Mission 19 can see exactly when content became canonically
 *   "unlocked") and emit a generic `content:unlocked` event so any
 *   future gating logic — or a UI toast — has something to listen for.
 *   This is forward-compatible plumbing, not a fabricated feature.
 *
 * Rules:
 *   Never mutate objective state directly — return instructions and let
 *   ObjectiveManager (the only place with state-mutation authority)
 *   apply them. Keeps this module pure and easy to test.
 */

import EventBus from '../EventBus.js';

/**
 * Execute one objective's actions.
 *
 * @param {Object[]} actions            - The objective's `actions` array.
 * @param {Object}   ctx
 * @param {string}   ctx.objectiveId     - The objective that just completed.
 * @param {Function} ctx.revealObjective - (objectiveId) => void
 * @param {Function} ctx.unlockObjective - (objectiveId) => void — forces an
 *                                          objective available even if its
 *                                          own dependencies aren't complete
 *                                          (explicit designer override).
 * @param {Function} ctx.setPhase        - (phaseId) => void
 * @param {Function} ctx.pushHistory     - (entry) => void
 * @returns {void}
 */
export function executeActions( actions, ctx ) {

    for ( const action of actions ?? [] ) {
        executeAction( action, ctx );
    }

}

/**
 * @param {Object} action
 * @param {Object} ctx
 * @returns {void}
 */
function executeAction( action, ctx ) {

    switch ( action.type ) {

        case 'unlockObjective':
            ctx.unlockObjective( action.target );
            break;

        case 'revealHiddenObjective':
            ctx.revealObjective( action.target );
            break;

        case 'changePhase':
            ctx.setPhase( action.target );
            break;

        case 'emitEvent':
            EventBus.emit( action.event, action.payload ?? {} );
            break;

        case 'unlockEvidence':
        case 'unlockConversation':
        case 'unlockPerson':
        case 'unlockEmail':
        case 'unlockCCTV':
        case 'unlockLocation':
        case 'unlockForensics':
            _unlockContent( action, ctx );
            break;

        default:
            console.warn( `ObjectiveActions: unknown action type "${ action.type }"` );

    }

}

/**
 * Handle every `unlockX` content action uniformly — see the class doc
 * for why this doesn't (yet) hide/reveal anything in the applications
 * themselves.
 *
 * @param {Object} action
 * @param {Object} ctx
 * @returns {void}
 */
function _unlockContent( action, ctx ) {

    const contentType = action.type.replace( 'unlock', '' ).toLowerCase();

    ctx.pushHistory( {
        type:        'content-unlocked',
        objectiveId: ctx.objectiveId,
        contentType,
        target:      action.target,
        timestamp:   Date.now(),
    } );

    EventBus.emit( 'content:unlocked', { contentType, target: action.target, objectiveId: ctx.objectiveId } );

}

export default { executeActions };
