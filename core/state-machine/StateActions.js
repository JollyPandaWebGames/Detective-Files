/**
 * StateActions
 *
 * Purpose:
 *   Mission 18 — Investigation State Machine. Executes a state's entry
 *   actions. Contains no investigation-specific logic — every case
 *   supplies its own states.json.
 *
 * Supported action types (spec's "State Actions" list):
 *   unlockObjective, unlockEvidence, unlockMessage, unlockEmail,
 *   unlockPerson, unlockLocation, unlockCCTV, unlockAnalysis,
 *   notify, generateHqMail, emitEvent
 *
 * On the unlockX actions:
 *   Same honest position as Mission 16's ObjectiveActions — there is no
 *   per-entity content-gating engine yet (that's Mission 19, explicitly
 *   named as this mission's own follow-up in MISSION 18's spec). These
 *   actions emit the same `content:unlocked` event Mission 16 already
 *   established, so both engines feed one shared signal Mission 19 can
 *   build real gating on top of, rather than inventing a second one.
 *
 * Rules:
 *   Never mutate state-machine state directly — return instructions via
 *   the ctx callbacks, mirroring ObjectiveActions' design.
 */

import EventBus from '../EventBus.js';

/**
 * @param {Object[]} actions
 * @param {Object}   ctx
 * @param {string}   ctx.stateId
 * @param {Function} ctx.notify        - (notification) => void
 * @param {Function} ctx.generateHqMail - (mailPartial) => void
 * @param {Function} ctx.pushHistory    - (entry) => void
 * @returns {void}
 */
export function executeStateActions( actions, ctx ) {
    for ( const action of actions ?? [] ) executeStateAction( action, ctx );
}

/**
 * @param {Object} action
 * @param {Object} ctx
 * @returns {void}
 */
function executeStateAction( action, ctx ) {

    switch ( action.type ) {

        case 'notify':
            ctx.notify( { id: `state-${ ctx.stateId }-${ Date.now() }`, title: action.title ?? 'Update', body: action.body ?? '', timestamp: Date.now(), read: false } );
            break;

        case 'generateHqMail':
            ctx.generateHqMail( { subject: action.subject ?? 'Update', body: action.body ?? '', from: action.from ?? 'Captain Morgan' } );
            break;

        case 'emitEvent':
            EventBus.emit( action.event, action.payload ?? {} );
            break;

        case 'unlockObjective':
        case 'unlockEvidence':
        case 'unlockMessage':
        case 'unlockEmail':
        case 'unlockPerson':
        case 'unlockLocation':
        case 'unlockCCTV':
        case 'unlockAnalysis':
            _unlockContent( action, ctx );
            break;

        default:
            console.warn( `StateActions: unknown action type "${ action.type }"` );

    }

}

/**
 * @param {Object} action
 * @param {Object} ctx
 * @returns {void}
 */
function _unlockContent( action, ctx ) {

    const contentType = action.type.replace( 'unlock', '' ).toLowerCase();

    ctx.pushHistory( { type: 'content-unlocked', stateId: ctx.stateId, contentType, target: action.target, timestamp: Date.now() } );
    EventBus.emit( 'content:unlocked', { contentType, target: action.target, stateId: ctx.stateId } );

}

export default { executeStateActions };
