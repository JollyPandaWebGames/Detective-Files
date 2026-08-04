/**
 * InvestigationSession
 *
 * Purpose:
 *   The canonical shape of "the player's current investigation," as
 *   required by Epic 01.1 — Active Investigation Architecture Refactor.
 *
 *   This is deliberately NOT the raw case object CaseManager stores.
 *   The raw case is static case *definition* data (title, description,
 *   objectives list, JSON folder paths). An InvestigationSession is the
 *   player's *live progress* through that case. Applications must only
 *   ever consume an InvestigationSession — never the raw case object —
 *   so that later gameplay systems (objective completion, content
 *   unlocking, solved/failed states) have one place to slot into
 *   without every application needing to change again.
 *
 * Fields:
 *   investigationId       — unique id for this playthrough of the case
 *                             (stable for the life of the session)
 *   caseId                — the underlying case definition id
 *   title                 — case title, for display without a second lookup
 *   status                — 'Active' | 'Completed' | 'Archived'
 *   startedAt             — epoch ms when this session began
 *   currentObjectives     — objectives not yet marked complete
 *   completedObjectives   — objectives marked complete
 *   unlockedEvidence      — evidence ids unlocked so far, or null
 *   unlockedEmails        — mail ids unlocked so far, or null
 *   unlockedWitnesses     — person ids unlocked so far, or null
 *   unlockedLocations     — location ids unlocked so far, or null
 *   unlockedReports       — forensics analysis ids unlocked so far, or null
 *   progress              — 0–100
 *   solved                — boolean
 *   failed                — boolean
 *
 * On "unlocked*" fields being null:
 *   There is no content-gating engine yet (Mission 19 — Dynamic Content
 *   Unlock Engine — is still Planned per the roadmap). Every application
 *   currently shows all of a case's content once that case is active,
 *   the same as before this refactor. These fields exist now, ahead of
 *   that engine, so it has somewhere to write without another schema
 *   change and another round of application updates. `null` here means
 *   "not gated — show everything," which is honest about current
 *   behavior rather than a fabricated "everything is unlocked" list.
 *
 * On "currentObjectives" / "completedObjectives":
 *   There is no per-objective completion tracking yet (Mission 16 —
 *   Objective Engine — is still Planned). `currentObjectives` is the
 *   case's full static objective list; `completedObjectives` is always
 *   empty until that engine exists.
 */

/**
 * Build an InvestigationSession from a raw CaseManager case object.
 *
 * @param {Object} c        - Raw case object (CaseManager.getById()).
 * @param {string} status   - 'Active' | 'Completed' | 'Archived'
 * @param {number} startedAt - epoch ms.
 * @returns {Object} InvestigationSession
 */
export function createInvestigationSession( c, status, startedAt ) {
    return {
        investigationId:      `inv-${ c.id }-${ startedAt }`,
        caseId:                c.id,
        title:                 c.title,
        status,
        startedAt,
        currentObjectives:     c.objectives ?? [],
        completedObjectives:   [],
        unlockedEvidence:      null,
        unlockedEmails:        null,
        unlockedWitnesses:     null,
        unlockedLocations:     null,
        unlockedReports:       null,
        progress:              c.progress ?? 0,
        solved:                c.status === 'Solved',
        failed:                false,
    };
}

export default { createInvestigationSession };
