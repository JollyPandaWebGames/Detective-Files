/**
 * ResolutionScorer
 *
 * Purpose:
 *   Mission 17 — Case Resolution Engine. Turns a validation result into
 *   a score and one of five outcome tiers. Pure function over plain
 *   data, same rationale as ResolutionValidator.
 *
 * Outcome tiers (spec-defined, in descending order):
 *   'Perfect Investigation'      — core accusation correct, every
 *                                   requirement met, every optional
 *                                   objective also completed, every
 *                                   required AND optional evidence used
 *   'Successful Investigation'   — core accusation correct, every
 *                                   requirement met (optional work or
 *                                   optional evidence may be incomplete)
 *   'Incomplete Investigation'   — core accusation correct, but required
 *                                   evidence/objectives/forensics/phase
 *                                   are missing — reopenable, no penalty
 *   'Incorrect Investigation'    — at least half the core accusation
 *                                   (suspect/weapon/location/motive) is
 *                                   wrong
 *   'Investigation Failed'       — the core accusation is almost
 *                                   entirely wrong
 *
 * Do NOT implement XP, rewards, achievements, or rank here — out of
 * scope for Mission 17 per spec. The score is stored for a future
 * profile system to read, not consumed by anything yet.
 */

const CORE_CHECK_COUNT = 4; // suspect, weapon, location, motive

/**
 * @param {Object} validation - Output of ResolutionValidator.validateReport().
 * @param {Object} scoringContext
 * @param {number} scoringContext.completionPercent      - From ObjectiveManager.getProgress().
 * @param {number} scoringContext.totalOptionalCount
 * @param {number} scoringContext.completedOptionalCount
 * @param {number} scoringContext.totalEvidenceCount      - All evidence that exists for the case.
 * @param {number} scoringContext.submittedEvidenceCount  - Evidence the player selected in the report.
 * @param {number} scoringContext.totalRequiredEvidenceCount - solution.requiredEvidence.length.
 * @param {number} scoringContext.startedAt                - epoch ms, investigation start.
 * @param {number} [scoringContext.now]                     - epoch ms, defaults to Date.now().
 * @returns {Object} { outcome, score }
 */
export function scoreResolution( validation, scoringContext ) {

    const outcome = _determineOutcome( validation, scoringContext );
    const score   = _computeScore( validation, scoringContext );

    return { outcome, score };

}

/**
 * @param {Object} validation
 * @param {Object} ctx
 * @returns {string}
 */
function _determineOutcome( validation, ctx ) {

    const { coreCorrectCount, requirementsMet, missingEvidence } = validation;
    const coreFullyCorrect = coreCorrectCount === CORE_CHECK_COUNT;

    if ( !coreFullyCorrect ) {
        return coreCorrectCount >= CORE_CHECK_COUNT / 2
            ? 'Incorrect Investigation'
            : 'Investigation Failed';
    }

    if ( !requirementsMet ) return 'Incomplete Investigation';

    const optionalComplete = ctx.totalOptionalCount === 0 ||
        ctx.completedOptionalCount === ctx.totalOptionalCount;

    const allEvidenceUsed = missingEvidence.length === 0 &&
        ctx.submittedEvidenceCount >= ctx.totalEvidenceCount;

    return ( optionalComplete && allEvidenceUsed )
        ? 'Perfect Investigation'
        : 'Successful Investigation';

}

/**
 * @param {Object} validation
 * @param {Object} ctx
 * @returns {Object}
 */
function _computeScore( validation, ctx ) {

    const requiredTotal   = ctx.totalRequiredEvidenceCount ?? 0;
    const requiredCorrect = requiredTotal - validation.missingEvidence.length;

    const correctEvidencePercent = requiredTotal === 0
        ? 100
        : Math.round( ( requiredCorrect / requiredTotal ) * 100 );

    const optionalObjectivesPercent = ctx.totalOptionalCount === 0
        ? 100
        : Math.round( ( ctx.completedOptionalCount / ctx.totalOptionalCount ) * 100 );

    const unusedEvidence = Math.max( 0, ctx.totalEvidenceCount - ctx.submittedEvidenceCount );

    const timeTakenMs = ( ctx.now ?? Date.now() ) - ctx.startedAt;

    return {
        completionPercent:         ctx.completionPercent,
        correctEvidencePercent,
        optionalObjectivesPercent,
        unusedEvidence,
        timeTakenMs,
    };

}

export default { scoreResolution };
