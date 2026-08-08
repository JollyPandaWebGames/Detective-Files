# Design — The Missing Scientist
## Detective Files — Case 001

> Follows `docs/missions/CASE_TEMPLATE.md`. Story content lives in
> `story.md` (this folder) and `docs/CASE001_DESIGN.md`; this file covers
> the Investigation, Resolution, and QA sections.

# Investigation

## Starting State
The player begins with the case assignment mail unread and no evidence,
people, or objectives yet revealed beyond what starts unlocked.

## Objectives
17 objectives, defined in `data/cases/case-001/objectives/`, spanning the
full loop: reading the assignment, reviewing CCTV, interviewing both
witnesses, inspecting evidence, requesting toxicology and trace analysis,
reviewing the board, and forming a theory. Includes hidden objectives
(`obj-lanyard-lead`, `obj-confirm-motive`) revealed by forensic results,
and optional objectives (`obj-review-all-cameras`,
`obj-question-all-witnesses`, `obj-tag-key-evidence`).

## Dependencies
See `data/cases/case-001/objectives/*.json` for the authoritative
dependency graph — each objective's `dependencies` array. Not reproduced
here field-for-field to avoid the same data existing in two
divergent-prone places; this template intentionally points at the JSON
as ground truth for a case this size, unlike Mission 20's design doc
which includes a full table because the tutorial's flow is itself part
of what's being documented for teaching purposes.

## Unlocks
Six rules in `data/cases/case-001/unlocks.json`, gating witness/evidence/
person reveals behind mail reads and forensic completions.

## Evidence
Six items (`ev-001`–`ev-006`) spanning documents, photographs, physical
evidence, fingerprints, and digital logs. Required: `ev-003`, `ev-004`,
`ev-006`. Optional: `ev-002`, `ev-005`.

## Locations
Five locations in `data/cases/case-001/map/locations.json`: the crime
scene, HQ, the forensics lab, the victim's residence, and the suspect's
unconfirmed address.

## Messages
Three conversations (`conv-001`–`conv-003`): Dr. Osei, Marcus Webb, and
Dr. Marsh (lab status updates).

## Emails
Seven mail items (`mail-001`–`mail-007`), delivering the assignment,
forensic summaries, an anonymous tip, and a nudge toward Marcus Webb.

## CCTV
Three cameras (`camera-01`–`camera-03`): lobby, corridor (the corrupted
feed), and a third supporting angle.

## Forensics
Four analyses: fingerprint, DNA, toxicology, and trace — see
`CASE001_DESIGN.md` §5 for the full evidence-to-result dependency map.

## Board
No hard minimum is enforced by the engine (submission is always
possible), but the intended solve path pulls in all three required
evidence items, the suspect, and a theory card before submission is
narratively justified.

# Resolution

## Required Evidence
`ev-003`, `ev-004`, `ev-006` (per `solution.json`).

## Required Deduction
Victim `person-001`, suspect `person-003`, weapon `ev-004`, location
`loc-001`, motive `theft`, timeline `2145-2215`.

## Possible Conclusions
Single correct resolution. Four false leads are designed into the case
(see `CASE001_DESIGN.md` §6) that a player can plausibly submit
incorrectly before the toxicology and trace results close them off.

## Success Conditions
A correct submission is validated by the Resolution Engine against
`solution.json` and produces HQ confirmation feedback.

## Failure Conditions
An incorrect or incomplete submission does not end the case — the
Resolution Engine allows resubmission.

# QA

- [x] Gameplay tested — full playthrough start to finish
- [x] Story tested — no contradictions between story.md and in-game text
- [x] Evidence tested — every evidence item opens, reads correctly, and
      matches its story.md description
- [x] Objective flow tested — every objective triggers, unlocks, and
      completes in the intended order, including hidden/optional ones
- [ ] Resolution tested — correct submission succeeds; at least one
      incorrect submission is attempted and handled gracefully
      *(Resolution Engine shipped after the original case content and
      design pass — recommend a dedicated resolution QA pass before
      considering this case fully closed out.)*
- [ ] Media verified — no media assets have been generated for this case
      yet; see `media-assets.md` in this folder.
