/**
 * ResolutionReport
 *
 * Purpose:
 *   Mission 17 — Case Resolution Engine. Assembles the final,
 *   human-readable Case Summary from a submitted report + validation +
 *   score + the case's own data — resolving raw ids (person-003,
 *   ev-004...) into display names so Police Mail / a summary screen
 *   never has to know how to look anything up itself.
 *
 * Rules:
 *   Pure function over data callers already fetched — this module never
 *   imports a manager. Keeps ResolutionManager the only place that talks
 *   to EventBus/StorageManager for this feature.
 */

/**
 * @param {Object} params
 * @param {Object} params.caseData          - CaseManager.getById() result.
 * @param {Object} params.report            - Player's submitted report.
 * @param {Object} params.validation         - ResolutionValidator output.
 * @param {Object} params.outcome            - String outcome tier.
 * @param {Object} params.score              - ResolutionScorer score object.
 * @param {Object} params.people             - Map/lookup: id -> person.
 * @param {Object} params.evidence           - Map/lookup: id -> evidence.
 * @param {Object} params.locations          - Map/lookup: id -> location.
 * @param {Object} params.forensicsResults   - Map/lookup: analysisId -> result summary.
 * @param {Object[]} params.theories          - Board theory nodes included in the report.
 * @param {number} params.submittedAt         - epoch ms.
 * @returns {Object} The final Case Summary.
 */
export function buildReport( params ) {

    const {
        caseData, report, validation, outcome, score,
        people, evidence, locations, forensicsResults,
        theories, submittedAt,
    } = params;

    return {
        caseId:            caseData.id,
        caseName:          caseData.title,

        victim:            _describePerson( people[ report.victim ] ),
        suspect:           _describePerson( people[ report.suspect ] ),
        weapon:            _describeEvidence( evidence[ report.weapon ] ),
        location:          locations[ report.location ]?.name ?? 'Unknown location',
        motive:            report.motive,
        timeline:          report.timeline,

        collectedEvidence: ( report.evidence ?? [] ).map( id => _describeEvidence( evidence[ id ] ) ),
        forensicResults:   ( report.forensics ?? [] ).map( id => forensicsResults[ id ] ?? id ),
        playerTheories:    theories.map( t => ( { title: t.title, content: t.content ?? '' } ) ),

        checks:            validation.checks,
        missingEvidence:   validation.missingEvidence,
        missingObjectives: validation.missingObjectives,
        missingForensics:  validation.missingForensics,

        finalVerdict:      outcome,
        score,

        submittedAt,

    };

}

/** @param {Object|undefined} person @returns {string} */
function _describePerson( person ) {
    return person ? `${ person.name } (${ person.role })` : 'Unknown';
}

/** @param {Object|undefined} item @returns {string} */
function _describeEvidence( item ) {
    return item ? item.title : 'Unknown item';
}

export default { buildReport };
