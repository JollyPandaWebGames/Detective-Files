# Implementation — Tutorial Investigation
## Detective Files — Case 00

Version: 1.0

This document explains exactly how Case 00 connects to the existing CID
OS systems. No fake functionality was created to make the tutorial
*appear* complete — every step below interacts with the real engines.

---

## Integration Chain

```
Case Management
    │  player clicks "Start Investigation" on the Case 00 card
    ▼
ApplicationContext.startInvestigation('case-00')
    │  thin pass-through to the session layer
    ▼
ActiveInvestigationManager.start('case-00')
    │  CaseManager.startCase('case-00')   — case-00.json has "replayable":
    │    true, so this ALWAYS resets status/progress to fresh, even if
    │    the case was previously 'Solved'
    │  c.replayable === true → _resetThenStart('case-00') instead of the
    │    normal fire-and-forget load path
    ▼
_resetThenStart('case-00')
    │  await Promise.all([ ...every manager's resetForCase('case-00') ])
    │  THEN: ObjectiveManager / ResolutionManager / StateMachineManager /
    │    UnlockManager .loadForCase('case-00')
    │  THEN: emit investigationStarted + investigationChanged
    ▼
Every application + TooltipManager
    │  each already listens for 'investigationChanged' and calls its own
    │  manager's loadForCase('case-00') in response — this is existing,
    │  unmodified behavior; Case 00 doesn't change how apps discover
    │  that a new investigation started, only what state they find when
    │  they do (guaranteed clean, because resetForCase() already ran)
    ▼
Objective Engine (ObjectiveManager)
    │  case-00's objectives/index.json + phases.json define T00-01
    │  through T00-13, exactly like any other case's objective graph
    ▼
CID OS Applications
    │  Police Mail, Evidence Database, City Map, Messenger, CCTV Viewer,
    │  Forensics Lab, Criminal Database, Investigation Board — each
    │  fires the same EventBus events (evidence:selected, mail:read,
    │  etc.) it already fires for every other case; ConditionMatcher
    │  and ObjectiveActions (Mission 16) are what turn those events into
    │  objective progress and tutorial-message triggers, unmodified
```

## Why This Required New Engine Code (and why that's not "hardcoding
## tutorial logic into applications")

Before Case 00, no case in the codebase could be replayed — starting an
already-solved case just re-emitted `case:started` without resetting
anything (`CaseManager.startCase()`, prior behavior). Case 00's replay
requirement is a genuine gap the brief correctly identified, not
something the existing engines could already do.

The fix is a **generic, reusable capability**, not tutorial-specific
logic:

- `replayable: true` is a plain field on a case's summary JSON. Any
  future case can opt into "always start fresh" by setting it — nothing
  about the mechanism checks for `case-00` specifically.
- `resetForCase(caseId)` was added to all 12 stateful managers
  (`ObjectiveManager`, `ResolutionManager`, `StateMachineManager`,
  `UnlockManager`, `TooltipManager`, `BoardManager`, `EvidenceManager`,
  `CctvManager`, `ForensicsManager`, `PeopleManager`,
  `MessengerManager`, `MailManager`) as a first-class method alongside
  their existing `loadForCase(caseId)` — not a Case-00-only code path.
- `ActiveInvestigationManager._resetThenStart()` is the only new
  orchestration logic, and it's driven entirely by the `replayable` data
  flag, not a case ID check.

No application (`apps/*`) needed any code changes at all — they already
react to `investigationChanged` generically.

## Storage Reset Details

See `design.md` → Replay System for the full per-manager table. Two
non-obvious cases worth calling out explicitly:

- **MailManager** doesn't load per-case — it loads every mail item once,
  globally, at boot. `resetForCase()` therefore can't just clear a
  storage key; it walks the in-memory mail map and, for entries
  belonging to `case-00`, either resets `read`/`starred`/`archived` to
  defaults (static file-backed mail — it can never be re-fetched, so it
  must not be deleted) or removes the entry entirely (runtime-generated
  HQ mail from `HqMailBuilder`, identifiable by its `mail-state-`
  id prefix — these must regenerate fresh from the state machine and
  resolution engine on replay, not carry over stale copies).
- **EvidenceManager / CctvManager / ForensicsManager / PeopleManager /
  MessengerManager** store persisted per-item state (viewed/pinned/notes/
  bookmarks) in a flat map keyed by item id, not case id. `resetForCase()`
  determines which ids belong to the case either from the in-memory
  per-case cache (fast path, same session) or by fetching the case's
  own `index.json` manifest and deriving ids from filenames (fallback
  path, e.g. after a browser reload) — one lightweight fetch, not one
  fetch per item.

## Tutorial Message Delivery

Case 00's step-by-step `tutorialMessage` copy (see `objectives.md`) is
delivered through three existing, unmodified mechanisms — no new UI
component was built for this:

1. **Objective `title`/`description`** — the primary carrier. The Active
   Investigation widget already renders the current objective's title
   and description (Mission 16, unmodified). Each of T00-01 through
   T00-13's `description` fields in the case data *is* its
   tutorialMessage text, so "wait for the player to act, then show the
   next message" falls directly out of the existing objective-completion
   flow: the widget can only be showing the next message once the
   previous objective is actually complete.
2. **Case description** — T00-01's "Welcome, Detective..." message
   appears before any investigation is active, so it can't come from an
   objective or a tooltip (`TooltipManager` only loads a case's content
   once that case is the active investigation — it has no mechanism to
   show a tip for a case that hasn't started yet). It's carried instead
   by `case-00.json`'s own `description` field, which Case Management
   already displays for every case.
3. **`TooltipManager`** (built for `case-000`/Mission 20, retained as
   generic infrastructure) — supplementary app-highlight nudges only,
   keyed to `objectiveUnlocked` events, pointing at the desktop/taskbar
   icon of whichever application the next step needs. These are the
   same kind of short "open X" nudge case-000 used, not the primary
   teaching text.

T00-13 ("Investigation Complete... you can replay") is a real gated
objective, not an exception — its condition is `applicationOpened`
targeting `case-management`, satisfied when the player naturally returns
there after solving. Its `description` field carries the completion
message via the same primary mechanism as every other step.

See `data/cases/case-00/tooltips.json` for the supplementary nudges.

## Forensics Timing

Per the brief's explicit instruction not to require a long real-time
wait, Case 00's one forensic analysis (`analysis-00-1`) uses a short
fixed `duration` (see `data/cases/case-00/forensics/analysis-00-1.json`)
rather than a multi-minute wait — this is a data value, not new code;
`ForensicsManager`'s existing polling/completion logic already supports
any duration.

## What Was Not Built

- No new application code. Every CID OS app already supports everything
  Case 00's objectives ask of it.
- No fake "auto-advance" logic. Every objective's completion condition
  is a real EventBus event fired by real player action — see
  `objectives.md` for the exact trigger per step.
