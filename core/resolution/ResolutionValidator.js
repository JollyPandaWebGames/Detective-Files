/**
 * ResolutionValidator
 *
 * Purpose:
 *   Mission 17 — Case Resolution Engine. Validates a submitted
 *   investigation report against a case's solution.json. Pure function
 *   over plain data — no EventBus, no persistence, no manager imports —
 *   so it's trivially unit-testable and reusable by a future Case Editor
 *   "test my solution" preview.
 *
 * Rules:
 *   Contains no investigation-specific logic — every case supplies its
 *   own solution.json; this module only knows how to compare a report
 *   against one.
 */

/**
 * @param {Object} report   - Player's submitted report.
 * @param {string} report.suspect
 * @param {string} report.weapon
 * @param {string} report.location
 * @param {string} report.motive
 * @param {string} report.timeline
 * @param {string[]} report.evidence  - Selected supporting evidence ids.
 *
 * @param {Object} solution - The case's solution.json.
 *
 * @param {Object} context
 * @param {string[]} context.completedObjectiveIds
 * @param {string[]} context.collectedForensicsIds
 * @param {string|null} context.currentPhaseId
 * @param {Object[]} context.phases - [{id, order}], for "phase reached" comparison.
 *
 * @returns {Object} validation result — see fields below.
 */
export function validateReport( report, solution, context ) {

    const checks = {
        suspect:  report.suspect  === solution.suspect,
        weapon:   report.weapon   === solution.weapon,
        location: report.location === solution.location,
        motive:   report.motive   === solution.motive,
        timeline: report.timeline === solution.timeline,
    };

    const coreCorrectCount = [ checks.suspect, checks.weapon, checks.location, checks.motive ]
        .filter( Boolean ).length;

    const requiredEvidence   = solution.requiredEvidence ?? [];
    const submittedEvidence  = report.evidence ?? [];
    const missingEvidence    = requiredEvidence.filter( id => !submittedEvidence.includes( id ) );

    const requiredObjectives = solution.requiredObjectives ?? [];
    const missingObjectives  = requiredObjectives.filter( id => !context.completedObjectiveIds.includes( id ) );

    const requiredForensics  = solution.requiredForensics ?? [];
    const missingForensics   = requiredForensics.filter( id => !context.collectedForensicsIds.includes( id ) );

    const phaseOk = _isPhaseReached( solution.requiredPhase, context.currentPhaseId, context.phases );

    const requirementsMet =
        missingEvidence.length    === 0 &&
        missingObjectives.length  === 0 &&
        missingForensics.length   === 0 &&
        phaseOk;

    return {
        checks,
        coreCorrectCount,
        missingEvidence,
        missingObjectives,
        missingForensics,
        phaseOk,
        requirementsMet,
    };

}

/**
 * "Required phase reached" means the current phase's order is at or past
 * the required phase's order — a player who has moved on to a later
 * phase has, by definition, already passed through an earlier one.
 *
 * @param {string|undefined} requiredPhaseId
 * @param {string|null} currentPhaseId
 * @param {Object[]} phases - [{id, order}]
 * @returns {boolean}
 */
function _isPhaseReached( requiredPhaseId, currentPhaseId, phases ) {

    if ( !requiredPhaseId ) return true;
    if ( !currentPhaseId )  return false;

    const required = phases.find( p => p.id === requiredPhaseId );
    const current   = phases.find( p => p.id === currentPhaseId );

    if ( !required || !current ) return currentPhaseId === requiredPhaseId;

    return current.order >= required.order;

}

export default { validateReport };
