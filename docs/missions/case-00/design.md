# Design — Tutorial Investigation
## Detective Files — Case 00

Version: 1.0

---

## Design Goals

- Teach the complete CID OS investigation workflow, one system at a time.
- Never show two new mechanics at once.
- Never permanently disable the tutorial — Case 00 must fully re-teach
  itself on every replay.

## Tutorial Philosophy

Every step follows the same shape: a contextual message tells the player
what to do and why, the player performs the real action in the real
application, and only then does the next message appear. No action is
ever simulated or auto-completed on the player's behalf.

## Replay System (new for Case 00)

No case in the codebase could previously be replayed — starting a
finished case reused whatever progress state was already saved. Case 00
requires this to work correctly, so a `resetForCase(caseId)` contract is
added to every stateful manager:

| Manager | Storage shape | Reset behavior |
|---|---|---|
| `ObjectiveManager` | one key per case (`_storageKey()` includes caseId) | delete the key |
| `ResolutionManager` | one key per case | delete the key |
| `StateMachineManager` | one key per case | delete the key |
| `UnlockManager` | one key per case | delete the key |
| `BoardManager` | flat map, nested by caseId (`_all[caseId]`) | delete that entry |
| `TooltipManager` | one key per case (`tooltips-shown:{caseId}`) | delete the key |
| `EvidenceManager` | flat map keyed by evidence id | delete only this case's evidence ids |
| `CctvManager` | flat map keyed by camera id | delete only this case's camera ids |
| `MessengerManager` | flat map keyed by conversation id | delete only this case's conversation ids |
| `ForensicsManager` | flat map keyed by analysis id | delete only this case's analysis ids |
| `PeopleManager` | flat map keyed by person id | delete only this case's person ids |
| `MailManager` | flat map keyed by mail id | delete only this case's mail ids (via `caseId` field on each mail record) |

`ActiveInvestigationManager.start(caseId)` calls every manager's
`resetForCase(caseId)` before `loadForCase(caseId)` **whenever the case
being started already has saved progress** — which, for Case 00
specifically, means every single start, since the tutorial must never
skip itself. A `tutorialCompletions` counter (persisted separately, for
statistics only) is a reasonable future addition but is **not
implemented** in this pass — the replay guarantee itself doesn't depend
on counting completions, only on the `replayable` flag, so this was left
out rather than half-built. If added later, it must never be read as a
skip condition.

## Learning Goals

By the end, the player should be able to operate every CID OS
application without further instruction — see `objectives.md` for the
full step list.

## Gameplay Loop

```
Start Investigation → Read Mail → Open Attachment → Inspect Evidence →
Add Note → Visit Location → Read Messenger → Watch CCTV → Bookmark
Timestamp → Run Forensics → Search Criminal Database → Build Board →
Form Theory → Submit Resolution → Completion
```

## Player Onboarding

Delivered entirely through contextual tutorial messages tied to
objective completion (see `objectives.md`), not modal popups. Each
message names the application, the action, and what happens next.

## Required Applications

Case Management, Police Mail, Evidence Database, City Map, Messenger,
CCTV Viewer, Forensics Lab, Criminal Database, Investigation Board.

## Required Objectives

See `objectives.md` for the full T00-01 through T00-13 chain.

## Objective Dependencies

Case 00 is intentionally fully linear — every objective depends on
exactly the one before it, with no hidden or optional branches.

## Evidence Flow

```
Case Brief           → background context
Broken Display Case  → first physical evidence, teaches inspection + notes
Pawn Shop Receipt    → submitted for forensic analysis, names the suspect
```

## Unlock Flow

One rule: Callum Voss's Criminal Database profile is gated behind the
forensic analysis on the pawn receipt completing.

## Investigation State Transitions

A linear state machine, one state per major beat, matching the
objective chain. No branching states, no red-herring states.

## Expected Player Actions / Expected Application State / Failure Prevention

See `objectives.md` — each objective row documents the exact player
action, the application it happens in, what it unlocks, and the next
objective. Nothing can be permanently missed; dependencies only gate
availability, never remove access once granted.

## Completion Conditions

The player submits a resolution naming Callum Voss, the pawn receipt,
Ellery & Finch Books, and a financial motive; the Resolution Engine
validates it against `solution.json`.

## Replay Behavior

Fully supported — see Replay System above. Starting Case 00 again always
resets and re-runs the entire tutorial from `T00-01`.

## UX Considerations

- Tutorial copy is encouraging and in-fiction, never manual-like.
- The Active Investigation widget's minimize behavior is explicitly
  taught (Step 02) since it's a persistent UI element the player will
  interact with throughout every future case, not just this one.
