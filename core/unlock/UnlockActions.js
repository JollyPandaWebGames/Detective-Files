/**
 * UnlockActions
 *
 * Purpose:
 *   Mission 19 — Dynamic Content Unlock Engine. Executes a rule's
 *   actions once its condition tree resolves true. Contains no
 *   investigation-specific logic — every case supplies its own
 *   unlocks.json.
 *
 * Supported action types (spec's "Unlock Actions" list):
 *   unlock, hide, reveal, enable, disable, notify, highlight, pin,
 *   generate, queue
 *
 * What's real vs. forward-compatible plumbing:
 *   `unlock`, `hide`, and `reveal` are fully real for the content types
 *   applications actually filter through UnlockManager (see
 *   ARCHITECTURE_2.md §15.6) — Evidence, Email, Conversation, Person,
 *   Location, CCTV, Forensics. `notify` is real (SessionManager).
 *   `generate` is real for target type 'email' (reuses MailManager.
 *   injectMail, the same mechanism Missions 17/18 use). `enable`/
 *   `disable` (Application/Desktop Shortcut) and `highlight`/`pin`/
 *   `queue` are recorded in history and emitted on EventBus, same as
 *   every other engine's forward-compatible actions this project has
 *   been honest about — there's no application-locking or board
 *   highlight/pin UI to actually drive yet.
 *
 * Rules:
 *   Never mutate UnlockManager state directly — return instructions via
 *   ctx callbacks, mirroring ObjectiveActions/StateActions.
 */

import EventBus from '../EventBus.js';

const CONTENT_ACTION_TYPES = new Set( [ 'unlock', 'hide', 'reveal' ] );

/**
 * @param {Object[]} actions
 * @param {Object}   ctx
 * @param {string}   ctx.ruleId
 * @param {string}   ctx.targetType
 * @param {string}   ctx.targetId
 * @param {Function} ctx.setUnlocked    - (unlocked:boolean) => void
 * @param {Function} ctx.setHidden       - (hidden:boolean) => void
 * @param {Function} ctx.notify           - (notification) => void
 * @param {Function} ctx.generateEmail    - (mailPartial) => void
 * @param {Function} ctx.pushHistory      - (entry) => void
 * @returns {void}
 */
export function executeUnlockActions( actions, ctx ) {

    // Spec's own example rule has no `actions` field at all — the
    // implicit default is simply "unlock the target."
    const list = ( actions && actions.length ) ? actions : [ { type: 'unlock' } ];

    for ( const action of list ) executeUnlockAction( action, ctx );

}

/**
 * @param {Object} action
 * @param {Object} ctx
 * @returns {void}
 */
function executeUnlockAction( action, ctx ) {

    if ( CONTENT_ACTION_TYPES.has( action.type ) ) {
        _applyContentAction( action.type, ctx );
        return;
    }

    switch ( action.type ) {

        case 'notify':
            ctx.notify( { id: `unlock-${ ctx.ruleId }-${ Date.now() }`, title: action.title ?? 'New Content Available', body: action.body ?? `${ ctx.targetType }: ${ ctx.targetId }`, timestamp: Date.now(), read: false } );
            break;

        case 'generate':
            if ( ctx.targetType === 'email' ) ctx.generateEmail( { subject: action.subject ?? 'New Message', body: action.body ?? '' } );
            _recordAndEmit( 'generate', ctx );
            break;

        case 'enable':
        case 'disable':
        case 'highlight':
        case 'pin':
        case 'queue':
            _recordAndEmit( action.type, ctx );
            break;

        default:
            console.warn( `UnlockActions: unknown action type "${ action.type }"` );

    }

}

/**
 * @param {string} type - 'unlock' | 'hide' | 'reveal'
 * @param {Object} ctx
 * @returns {void}
 */
function _applyContentAction( type, ctx ) {

    if ( type === 'hide' ) {
        ctx.setHidden( true );
        ctx.pushHistory( { type: 'hidden', ruleId: ctx.ruleId, targetType: ctx.targetType, targetId: ctx.targetId, timestamp: Date.now() } );
        EventBus.emit( 'content:hidden', { contentType: ctx.targetType, target: ctx.targetId } );
        return;
    }

    // 'unlock' and 'reveal' are the same mechanic at this layer — see
    // class doc. Both clear any hidden flag and mark unlocked.
    ctx.setHidden( false );
    ctx.setUnlocked( true );
    ctx.pushHistory( { type: type === 'reveal' ? 'revealed' : 'unlocked', ruleId: ctx.ruleId, targetType: ctx.targetType, targetId: ctx.targetId, timestamp: Date.now() } );
    EventBus.emit( type === 'reveal' ? 'content:revealed' : 'content:unlocked', { contentType: ctx.targetType, target: ctx.targetId } );

}

/**
 * @param {string} type
 * @param {Object} ctx
 * @returns {void}
 */
function _recordAndEmit( type, ctx ) {
    ctx.pushHistory( { type, ruleId: ctx.ruleId, targetType: ctx.targetType, targetId: ctx.targetId, timestamp: Date.now() } );
    EventBus.emit( `unlock:${ type }`, { contentType: ctx.targetType, target: ctx.targetId, ruleId: ctx.ruleId } );
}

export default { executeUnlockActions };
