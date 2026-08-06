/**
 * StateTransitionMatcher
 *
 * Purpose:
 *   Mission 18 — Investigation State Machine. Maps the transition
 *   trigger vocabulary onto the real EventBus events CID OS applications
 *   already emit, the same way core/objectives/ConditionMatcher.js does
 *   for the Objective Engine. Kept as a separate, independent table
 *   rather than reused from ConditionMatcher because the two engines'
 *   trigger vocabularies overlap but aren't identical (states listen for
 *   'objective:completed' — a Mission 16 *output* — which the Objective
 *   Engine itself has no reason to listen for).
 *
 * Supported event-driven trigger types (Mission 18 spec):
 *   objectiveCompleted, evidenceDiscovered, messageRead,
 *   forensicsCompleted, customEvent
 *
 * NOT handled here (manager-driven, not event-driven):
 *   timeElapsed   — scheduled by StateMachineManager's timer system
 *   manualTrigger — invoked directly via StateMachineManager's API
 *
 * Rules:
 *   Contains no investigation-specific logic — generic to CID OS.
 */

const TRIGGER_EVENT_MAP = {

    objectiveCompleted: {
        event:          'objective:completed',
        extractTarget:  payload => payload.objective?.id,
    },

    // Mirrors ConditionMatcher's evidenceViewed mapping — "discovered"
    // and "viewed" are the same real signal in the current UI; there is
    // no separate discovery mechanic yet.
    evidenceDiscovered: {
        event:          'evidence:selected',
        extractTarget:  payload => payload.evidence?.id,
    },

    messageRead: {
        event:          'messenger:message-read',
        extractTarget:  payload => payload.convId,
    },

    forensicsCompleted: {
        event:          'forensics:collected',
        extractTarget:  payload => payload.analysisId,
    },

};

/**
 * @returns {string[]} Every EventBus event name an event-driven trigger
 *   type needs subscribed, for StateMachineManager to build its
 *   subscription set from.
 */
export function getBuiltInTriggerEvents() {
    return Object.values( TRIGGER_EVENT_MAP ).map( entry => entry.event );
}

/**
 * @param {Object} trigger    - A transition's `trigger` descriptor,
 *   e.g. { type: 'objectiveCompleted', target: 'obj-read-assignment' }.
 * @param {string} eventName  - The EventBus event that just fired.
 * @param {Object} payload    - That event's payload.
 * @returns {boolean}
 */
export function triggerMatchesEvent( trigger, eventName, payload ) {

    if ( trigger.type === 'customEvent' ) {
        if ( trigger.event !== eventName ) return false;
        if ( trigger.target == null ) return true;
        return payload?.target === trigger.target || payload?.id === trigger.target;
    }

    const entry = TRIGGER_EVENT_MAP[ trigger.type ];
    if ( !entry || entry.event !== eventName ) return false;

    if ( trigger.target == null ) return true;
    return entry.extractTarget( payload ?? {} ) === trigger.target;

}

export default { getBuiltInTriggerEvents, triggerMatchesEvent };
