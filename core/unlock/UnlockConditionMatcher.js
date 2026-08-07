/**
 * UnlockConditionMatcher
 *
 * Purpose:
 *   Mission 19 — Dynamic Content Unlock Engine. Maps the unlock
 *   condition vocabulary onto real EventBus events, the same pattern
 *   ConditionMatcher (Mission 16) and StateTransitionMatcher (Mission
 *   18) already established. Kept as its own table rather than reused
 *   from either — this engine's condition list is the union of both
 *   plus a few new ones (`objectiveAvailable`, `stateExited`,
 *   `timestampBookmarked`, `evidenceCollected`, `randomEvent`), and
 *   duplicating a shared table across three engines would couple them
 *   to each other's future changes for no benefit.
 *
 * Supported event-driven condition types (spec's "Supported Conditions"):
 *   objectiveCompleted, stateEntered, stateExited, evidenceViewed,
 *   evidenceCollected, emailRead, conversationOpened, locationVisited,
 *   cameraWatched, timestampBookmarked, theoryCreated,
 *   boardConnectionCreated, forensicRequested, forensicCompleted,
 *   randomEvent, customEvent
 *
 * Handled elsewhere (not event-driven):
 *   objectiveAvailable — polled against ObjectiveManager on any
 *                        objective-related event, not a single event itself
 *   timeElapsed         — scheduled by UnlockManager's own timer system
 *
 * Rules:
 *   Contains no investigation-specific logic — generic to CID OS.
 */

const CONDITION_EVENT_MAP = {

    objectiveCompleted:     { event: 'objective:completed',           extractTarget: p => p.objective?.id },
    stateEntered:            { event: 'state:entered',                  extractTarget: p => p.stateId },
    stateExited:              { event: 'state:exited',                   extractTarget: p => p.stateId },

    // "Collected" has no separate mechanic from "viewed" yet — same
    // pragmatic equivalence Mission 16 used for evidenceTagged/pinned.
    evidenceViewed:           { event: 'evidence:selected',              extractTarget: p => p.evidence?.id },
    evidenceCollected:        { event: 'evidence:selected',              extractTarget: p => p.evidence?.id },

    emailRead:                { event: 'mail:read',                      extractTarget: p => p.mailId },
    conversationOpened:      { event: 'messenger:conversation-opened',  extractTarget: p => p.convId },
    locationVisited:          { event: 'map:location-selected',          extractTarget: p => p.location?.id },
    cameraWatched:            { event: 'cctv:camera-viewed',             extractTarget: p => p.cameraId },
    timestampBookmarked:     { event: 'cctv:bookmark-added',            extractTarget: p => p.cameraId },
    theoryCreated:            { event: 'board:theory-created',           extractTarget: () => null },
    boardConnectionCreated:  { event: 'board:connection-created',       extractTarget: () => null },
    forensicRequested:        { event: 'forensics:requested',            extractTarget: p => p.analysisId },
    forensicCompleted:        { event: 'forensics:collected',            extractTarget: p => p.analysisId },
    randomEvent:              { event: 'state:random-event',             extractTarget: p => p.eventId },

};

/** @returns {string[]} */
export function getBuiltInConditionEvents() {
    return Object.values( CONDITION_EVENT_MAP ).map( entry => entry.event );
}

/**
 * @param {Object} condition  - { event: type, value: target } per spec's
 *   own JSON shape, e.g. { "event": "objectiveCompleted", "value": "obj-open-evidence" }.
 * @param {string} eventName  - The EventBus event that just fired.
 * @param {Object} payload
 * @returns {boolean}
 */
export function conditionMatchesEvent( condition, eventName, payload ) {

    if ( condition.event === 'customEvent' ) {
        if ( condition.customEvent !== eventName ) return false;
        if ( condition.value == null ) return true;
        return payload?.target === condition.value || payload?.id === condition.value;
    }

    const entry = CONDITION_EVENT_MAP[ condition.event ];
    if ( !entry || entry.event !== eventName ) return false;

    if ( condition.value == null ) return true;
    return entry.extractTarget( payload ?? {} ) === condition.value;

}

/** @param {string} type @returns {string|null} */
export function getEventForConditionType( type ) {
    return CONDITION_EVENT_MAP[ type ]?.event ?? null;
}

export default { getBuiltInConditionEvents, conditionMatchesEvent, getEventForConditionType };
