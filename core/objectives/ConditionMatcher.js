/**
 * ConditionMatcher
 *
 * Purpose:
 *   Maps the editor-facing condition vocabulary (Mission 16 — Objective
 *   Engine) onto the EventBus events CID OS applications already emit,
 *   and decides whether a fired event satisfies a given condition.
 *
 *   This is the only place in the engine that knows the actual event
 *   names/payload shapes applications use. Objective JSON never
 *   references an EventBus event name directly — it references a
 *   condition `type`, which stays stable even if an application's
 *   internal event name changes later (only the table below updates).
 *
 * Supported condition types (Mission 16 spec, plus four added for
 * Case 00's tutorial — see below):
 *   applicationOpened, emailRead, messageRead, evidenceViewed,
 *   evidenceTagged, locationVisited, cameraViewed, analysisRequested,
 *   analysisCollected, personProfileOpened, boardConnectionCreated,
 *   theoryCreated, attachmentOpened, evidenceNoted, timestampBookmarked,
 *   investigationSolved, customEvent
 *
 * Rules:
 *   Contains no investigation-specific logic — every mapping here is
 *   generic to CID OS, not to any one case.
 */

/**
 * type -> { event, extractTarget(payload) }
 *
 * extractTarget returns the id a condition's `target` should be compared
 * against, or null if the event carries no comparable id (in which case
 * the condition matches on event type alone — useful for coarse
 * "any board connection created" style objectives).
 */
const CONDITION_EVENT_MAP = {

    applicationOpened: {
        event:          'app:opened',
        extractTarget:  payload => payload.appId,
    },

    emailRead: {
        event:          'mail:read',
        extractTarget:  payload => payload.mailId,
    },

    messageRead: {
        event:          'messenger:message-read',
        extractTarget:  payload => payload.convId,
    },

    evidenceViewed: {
        event:          'evidence:selected',
        extractTarget:  payload => payload.evidence?.id,
    },

    // No dedicated "tag" feature exists yet — pinning is the closest
    // existing analog for "the player flagged this evidence as
    // significant." Documented in ARCHITECTURE_2.md §12.
    evidenceTagged: {
        event:          'evidence:pinned',
        extractTarget:  payload => payload.evidenceId,
    },

    locationVisited: {
        event:          'map:location-selected',
        extractTarget:  payload => payload.location?.id,
    },

    cameraViewed: {
        event:          'cctv:camera-viewed',
        extractTarget:  payload => payload.cameraId,
    },

    analysisRequested: {
        event:          'forensics:requested',
        extractTarget:  payload => payload.analysisId,
    },

    analysisCollected: {
        event:          'forensics:collected',
        extractTarget:  payload => payload.analysisId,
    },

    personProfileOpened: {
        event:          'person:selected',
        extractTarget:  payload => payload.person?.id,
    },

    boardConnectionCreated: {
        event:          'board:connection-created',
        extractTarget:  () => null,
    },

    theoryCreated: {
        event:          'board:theory-created',
        extractTarget:  () => null,
    },

    // Added for Case 00 — generic, not tutorial-specific. Both events
    // already existed (Police Mail's attachment click, Evidence
    // Database's note autosave); this only adds the condition-type
    // mapping so objective JSON can reference them.
    attachmentOpened: {
        event:          'mail:attachment-opened',
        extractTarget:  payload => payload.attachmentId,
    },

    evidenceNoted: {
        event:          'evidence:note-updated',
        extractTarget:  payload => payload.evidenceId,
    },

    // CCTV's bookmark event carries the camera id, not a per-timestamp
    // id — a condition targeting a specific camera is matched the
    // moment any bookmark is added to it. Good enough for "the player
    // found and flagged the important moment"; a case wanting to
    // enforce which exact timestamp was bookmarked would need a finer
    // event, which doesn't exist yet.
    timestampBookmarked: {
        event:          'cctv:bookmark-added',
        extractTarget:  payload => payload.cameraId,
    },

    // ResolutionManager already only emits this on a correct submission
    // (see managers/ResolutionManager.js) — an incorrect/incomplete
    // submission never fires it, matching "resolution submitted and
    // validated correct" without needing new validation logic.
    investigationSolved: {
        event:          'investigation:completed',
        extractTarget:  () => null,
    },

};

/**
 * Every EventBus event name the Objective Engine needs to subscribe to
 * in order to evaluate at least one condition type, plus every event a
 * case's `customEvent` conditions might name. Built once from the table
 * above; `customEvent` conditions add their own event name at load time
 * (see ObjectiveManager._collectCustomEvents()).
 *
 * @returns {string[]}
 */
export function getBuiltInConditionEvents() {
    return Object.values( CONDITION_EVENT_MAP ).map( entry => entry.event );
}

/**
 * Decide whether a fired EventBus event satisfies a single condition.
 *
 * @param {Object} condition   - { type, target? }
 * @param {string} eventName   - The EventBus event that just fired.
 * @param {Object} payload     - That event's payload.
 * @returns {boolean}
 */
export function conditionMatchesEvent( condition, eventName, payload ) {

    if ( condition.type === 'customEvent' ) {
        if ( condition.event !== eventName ) return false;
        if ( condition.target == null ) return true;
        return payload?.target === condition.target || payload?.id === condition.target;
    }

    const entry = CONDITION_EVENT_MAP[ condition.type ];
    if ( !entry || entry.event !== eventName ) return false;

    const actualTarget = entry.extractTarget( payload ?? {} );

    // No target on the condition — any occurrence of this event type
    // satisfies it (e.g. "create any board connection").
    if ( condition.target == null ) return true;

    return actualTarget === condition.target;

}

/**
 * @param {string} type
 * @returns {string|null} The EventBus event name a built-in condition
 *   type listens to, or null for 'customEvent' (which carries its own).
 */
export function getEventForConditionType( type ) {
    return CONDITION_EVENT_MAP[ type ]?.event ?? null;
}

export default { getBuiltInConditionEvents, conditionMatchesEvent, getEventForConditionType };
