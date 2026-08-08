# Tutorial Design Document — Operation Zero
## Detective Files — Mission 20

Version: 1.0
Case ID: `case-000`

This document is the design-side counterpart to
`tutorial-guide.md` (player-facing) and `story.md` (narrative source of
truth). It describes how Operation Zero is built, not how it reads.

---

## Design Goals

- Teach every core CID OS application through play, not exposition.
- Keep the mystery itself trivially solvable — the *investigation tools*
  are the thing being tested, not the player's deductive skill.
- Never block the player behind a modal tutorial window; all guidance is
  delivered through normal game systems (mail, objectives, notifications,
  tooltips).
- Stay entirely data-driven. No tutorial-specific logic exists in any
  application or engine — everything in this document is expressed as
  case JSON consumed by generic, reusable systems (the same
  Objective/Resolution/State-Machine/Unlock/Tooltip engines every future
  case uses).

## Learning Goals

By completion, the player should be able to operate every CID OS
application without further instruction. See "What the Player Should
Learn From This Mission" in `tutorial-guide.md` for the player-facing
version of this list.

## Gameplay Loop

Operation Zero is a single linear loop with two optional side branches:

```
Read Mail → Review Evidence → Talk to Witness → Visit Scene →
Watch Footage → Inspect Evidence → Request Analysis → Wait/Collect →
Look Up Suspect → Build Board → Form Theory → Submit Resolution
```

The two optional objectives (`obj-review-all-evidence`,
`obj-tag-key-evidence`) can be completed at any point after their
evidence exists and never block the main line.

## Player Onboarding

No tutorial screens, no forced pop-ups. Onboarding is delivered through:

1. **Objectives** — one clear next step at a time, shown in the Active
   Investigation widget.
2. **Priority-based highlighting** — objectives marked `"priority":
   "critical"` are visually emphasized by the apps that already
   read `ApplicationContext.getAvailableObjectiveDetails()`.
3. **Tooltips** — one-time, dismissible contextual hints anchored to the
   relevant desktop icon or taskbar button (`TooltipManager`, see
   `tooltips.json`), shown the first time a new application becomes
   relevant.
4. **HQ mail** — Captain Morgan's briefing and later automated nudges
   explain, in-fiction, what to do next.
5. **Error tolerance** — if the player stalls, the state machine
   generates an HQ reminder email (see `states.json` timers).

## Required Applications

Police Mail, Evidence Database, Messenger, City Map, CCTV Viewer,
Forensics Lab, Criminal Database, Investigation Board. (Case Management
is the entry point but has no dedicated objective — starting the case
from there is a precondition, not a taught mechanic in itself.)

## Required Objectives

| ID | Title | Category | Priority | Hidden | Optional |
|---|---|---|---|---|---|
| `obj-read-assignment` | Read your assignment | Main | critical | no | no |
| `obj-open-evidence` | Review the evidence | Evidence | normal | no | no |
| `obj-inspect-stool` | Inspect the overturned stool | Evidence | normal | no | no |
| `obj-interview-witness` | Interview the witness | Interview | normal | no | no |
| `obj-visit-scene` | Visit the crime scene | Investigation | normal | no | no |
| `obj-review-camera` | Check the camera footage | Investigation | normal | no | no |
| `obj-inspect-ticket` | Inspect the torn pawn ticket | Evidence | normal | no | no |
| `obj-request-analysis` | Request a forensic analysis | Laboratory | normal | no | no |
| `obj-collect-analysis` | Collect the forensic report | Laboratory | critical | no | no |
| `obj-check-suspect` | Look up the suspect | Investigation | normal | **yes** | no |
| `obj-build-board` | Build your case on the board | Theory | normal | no | no |
| `obj-form-theory` | Write up your theory | Theory | critical | no | no |
| `obj-review-all-evidence` | Review every piece of evidence | Optional | low | no | **yes** |
| `obj-tag-key-evidence` | Pin your key evidence | Optional | low | no | **yes** |

`obj-check-suspect` is hidden until the forensic report is collected —
the player has no reason to know Marcus Reed's name before that point.

## Objective Dependencies

```
obj-read-assignment
    └─▶ obj-open-evidence
            └─▶ obj-inspect-stool
                    └─▶ obj-interview-witness
                            └─▶ obj-visit-scene
                                    └─▶ obj-review-camera
                                            └─▶ obj-inspect-ticket
                                                    └─▶ obj-request-analysis
                                                            └─▶ obj-collect-analysis
                                                                    └─▶ [reveals] obj-check-suspect
                                                                            └─▶ obj-build-board
                                                                                    └─▶ obj-form-theory

obj-review-all-evidence   (no dependencies — available from the start, optional)
obj-tag-key-evidence      (no dependencies — available from the start, optional)
```

Every non-terminal objective's `actions` array explicitly
`unlockObjective`s (or, for the hidden one, `revealHiddenObjective`s) its
successor, in addition to the successor declaring the same relationship
via `dependencies`. This redundancy is intentional — it matches the
existing house style (see Case 001) and guarantees the `objective:
unlocked` / `objective:revealed` events fire reliably for anything that
needs to react to them, such as tooltips.

## Evidence Flow

```
ev-000-1  Case Brief          — from mail, background context
ev-000-2  Overturned Stool    — first physical evidence, teaches inspection
ev-000-3  Cut Zip Tie         — submitted for forensic analysis
ev-000-4  Torn Pawn Ticket    — names the suspect's motive
ev-000-5  Danny's Phone       — corroborates the timeline
```

`ev-000-3`, `ev-000-4`, and `ev-000-5` are `requiredEvidence` in
`solution.json` — satisfying the spec's "at least three evidence cards"
guidance for the Investigation Board. `ev-000-1` and `ev-000-2` are
`optionalEvidence`.

## Unlock Flow

One `unlocks.json` rule, kept deliberately singular so the mechanic reads
clearly rather than being buried among several:

| Target | Type | Condition | Effect |
|---|---|---|---|
| `person-000-2` (Marcus Reed) | person | `forensicCompleted: analysis-000-1` | Unlocked in Criminal Database; HQ notifies the player |

## Investigation State Transitions

`states.json` defines eight states, mirroring the eight phases in
`phases.json` one-to-one:

```
assignment → crime-scene → witnesses → field-work →
laboratory → lab-results → theory-building → resolution-ready
```

Two states carry a standalone nudge timer (`crime-scene`, `field-work`,
150s each) that fires an HQ reminder email if the player hasn't advanced
— this is the concrete implementation of the spec's "Error Tolerance"
requirement. `lab-results` and `resolution-ready` generate HQ mail on
entry ("Forensics Report Ready", "Ready to Close?").

## Expected Player Actions

| Objective | Player Action | Application | Unlock | Next Objective |
|---|---|---|---|---|
| `obj-read-assignment` | Open and read `mail-008` | Police Mail | `obj-open-evidence`, phase → evidence-review | `obj-open-evidence` |
| `obj-open-evidence` | Open the Evidence app | Evidence Database | `obj-inspect-stool` | `obj-inspect-stool` |
| `obj-inspect-stool` | Select `ev-000-2` | Evidence Database | `obj-interview-witness`, phase → witnesses | `obj-interview-witness` |
| `obj-interview-witness` | Read `conv-000-1` | Messenger | `obj-visit-scene` | `obj-visit-scene` |
| `obj-visit-scene` | Select `loc-000-1` | City Map | `obj-review-camera`, phase → field-work | `obj-review-camera` |
| `obj-review-camera` | Watch `camera-000-1` | CCTV Viewer | `obj-inspect-ticket` | `obj-inspect-ticket` |
| `obj-inspect-ticket` | Select `ev-000-4` | Evidence Database | `obj-request-analysis`, phase → laboratory | `obj-request-analysis` |
| `obj-request-analysis` | Submit `analysis-000-1` | Forensics Lab | `obj-collect-analysis` | `obj-collect-analysis` |
| `obj-collect-analysis` | Collect the finished report | Forensics Lab | `obj-check-suspect` (revealed), phase → background-check | `obj-check-suspect` |
| `obj-check-suspect` | Select `person-000-2` | Criminal Database | `obj-build-board`, phase → theory | `obj-build-board` |
| `obj-build-board` | Create a board connection | Investigation Board | `obj-form-theory` | `obj-form-theory` |
| `obj-form-theory` | Create a theory card | Investigation Board | phase → resolution | — (submit resolution) |

## Expected Application State

At any point, the applications relevant to the *current* objective should
be the ones already unlocked per `phases.json`; earlier applications
remain accessible (nothing is ever re-locked). The Active Investigation
widget's "current phase" always matches the most recent `changePhase`
action fired.

## Failure Prevention

- No objective can be permanently missed — dependencies only gate
  *availability*, never remove access once granted.
- The Resolution Engine (Mission 17) allows resubmission on an incorrect
  resolution rather than ending the case.
- The state-machine nudge timers exist specifically so a player who
  wanders away from the intended flow still gets pointed back toward it.
- Hidden objective `obj-check-suspect` cannot be attempted before its
  prerequisite (the forensic report) exists, because `person-000-2` is
  gated in Criminal Database by `unlocks.json` until that point — the
  player physically cannot get ahead of the story.

## Completion Conditions

The case is complete when the player submits a resolution via the
Investigation Board's Resolution Wizard and the Resolution Engine
validates it against `solution.json`. See `story.md` → Truth /
Resolution for the exact expected values.

## Replay Behavior

Operation Zero should be restartable at any time per the spec's
Accessibility requirement. **This is not yet implemented** — no case in
the current codebase (Case 001 included) has a "reset progress" action,
and building one correctly requires touching per-case storage-reset logic
across most gameplay managers (several of which store state in a single
global map rather than a case-scoped one). This is called out explicitly
as an open item rather than left undocumented; see the Mission 20
implementation notes for detail on why it was deferred.

## UX Considerations

- Tutorial tone throughout is encouraging, not instructional — Captain
  Morgan's copy reads like a real assignment, not a manual.
- Nothing in Operation Zero should require the player to already
  understand game jargon (objective IDs, phase names, etc. are internal
  and never shown to the player as-is — only their `title`/`description`
  text is).
- The optional objectives exist so a player who wants to explore isn't
  penalized for skipping them, and a player who rushes the main line
  isn't penalized either.
