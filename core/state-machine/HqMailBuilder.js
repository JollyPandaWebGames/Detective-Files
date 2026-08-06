/**
 * HqMailBuilder
 *
 * Purpose:
 *   Mission 18 — Investigation State Machine. Assembles the mail object
 *   shape MailManager.injectMail() expects from a state action's partial
 *   { subject, body, from? }. Extracted from StateMachineManager as a
 *   pure function — no reason mail-shape assembly needs access to any
 *   manager state — which also keeps that class under CODING_STYLE.md's
 *   500-line limit.
 *
 * Rules:
 *   Pure — no EventBus, no manager imports, no side effects.
 */

/**
 * @param {string} caseId
 * @param {{subject:string, body:string, from?:string}} partial
 * @returns {Object} A full mail object, ready for MailManager.injectMail().
 */
export function buildHqMail( caseId, partial ) {
    return {
        id:          `mail-state-${ caseId }-${ Date.now() }`,
        caseId,
        from:        partial.from ?? 'Captain Morgan',
        fromTitle:   'Precinct Captain',
        subject:     partial.subject,
        date:        new Date().toISOString().slice( 0, 16 ).replace( 'T', ' ' ),
        priority:    'Medium',
        read:         false,
        starred:      false,
        folder:       'inbox',
        attachments: [],
        body:         partial.body,
    };
}

export default { buildHqMail };
