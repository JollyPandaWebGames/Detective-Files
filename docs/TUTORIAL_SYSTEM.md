# Tutorial System

**Status:** v1.1.0
**Related files:**
`managers/TutorialManager.js` · `ui/TutorialDialog.js` · `ui/TutorialHighlight.js` ·
`css/tutorial/tutorial.css` · `data/tutorial/case-00-dialogue.json`

---

## 1. Overview

The tutorial system is a reusable, **data-driven** engine that walks a new
player through CID OS via a mentor character (the Senior Detective) before
and during Case 00. It is not hardcoded to Case 00 — every dialogue line,
required action, and highlight target lives in a JSON file, so future cases
or feature introductions can define their own tutorial without touching
`TutorialManager.js`.

```
Senior Detective
      ↓
Explains CID OS / desktop / applications
      ↓
Player confirms understanding (Continue)
      ↓
Case 00 begins (a real player action, not a cutscene)
      ↓
Senior Detective continues guiding through every application
      ↓
Player solves Case 00
```

## 2. Architecture

| Piece                     | Responsibility |
|----------------------------|----------------|
| `TutorialManager`          | Owns tutorial state, sequencing, locking, and required-action detection. The only piece that knows *when* to show what. |
| `TutorialDialog`           | Pure view — renders the dialogue box or the instruction banner. Holds no state. |
| `TutorialHighlight`        | Pure view — draws and tracks the pulsing highlight box around a target element. Holds no state. |
| `data/tutorial/*.json`     | Content. Speaker, text, sequencing, required action, highlight target — see §4. |

`TutorialManager` never reaches into an application's internals. It only
listens for the same `EventBus` events those applications already emit
(`app:opened`, `mail:read`, `evidence:opened`, `investigationStarted`, etc.).
This means adding a new tutorial step for an app that doesn't exist yet only
requires that app to emit *something* on `EventBus` — no special tutorial
hook is required in application code.

## 3. Node Types

Each dialogue node has a `type`:

- **`dialogue`** — a mentor line with a **Continue** button (and, on select
  nodes, a **Skip Tutorial** button). Advancing requires an explicit click —
  the player is never auto-advanced.
- **`instruction`** — the dialogue box closes, a short instruction banner
  appears, and the relevant UI element is highlighted. There is **no**
  Continue button on an instruction node — the player must perform the real
  action. `TutorialManager` detects this by listening for the exact
  `EventBus` event named in `requiredAction.event` (and, if present,
  matching `requiredAction.match` against the event payload).

This satisfies the "no wall of text, no skipping gameplay" requirement:
dialogue explains *what/why*, instructions require the player to actually
*do* it.

## 4. JSON Structure

```json
{
    "id": "t00-011",
    "phase": "desktop",
    "speaker": "senior-detective",
    "type": "instruction",
    "text": "Open Case Management.",
    "requiredAction": { "event": "app:opened", "match": { "appId": "case-management" } },
    "highlightTarget": "[data-app-id=\"case-management\"]",
    "highlightScope": "desktop",
    "next": "t00-012"
}
```

| Field              | Meaning |
|---------------------|---------|
| `id`                | Unique node id. |
| `phase`             | Which tutorial phase this belongs to (see §5) — informational, used for analytics/debugging. |
| `speaker`           | Key into the file's `speakers` map (name + portrait emoji). |
| `type`              | `"dialogue"` or `"instruction"`. |
| `text`              | The line shown to the player. |
| `requiredAction`    | *(instruction only)* `{ event, match? }` — the EventBus event (and optional payload fields) that completes this step. |
| `highlightTarget`   | *(instruction only)* CSS selector for the element to highlight. |
| `highlightScope`    | *(optional)* `"desktop"`, `"window:<appId>"`, or omitted to search the whole document — narrows an ambiguous selector. |
| `next`              | The next node's `id`, or `null` to end the tutorial. |

No tutorial text is hardcoded in JavaScript — see `data/tutorial/case-00-dialogue.json`.

### Avoiding soft-locks on already-true conditions (v1.1.1, v1.1.4)

Some gameplay actions are idempotent/guarded — a singleton app only emits
`app:opened` on its first open (reopening just focuses it), `MailManager`
only emits `mail:read` the first time a given mail is read, and
`ForensicsManager` only emits `forensics:requested` the first time a given
analysis is submitted. If the player reached an instruction step for one of
these *after* the condition was already true — e.g. they opened Police Mail
before the tutorial told them to, or they're resuming Case 00 after already
reading that mail — the live event would never fire again, and the tutorial
would wait forever.

`TutorialManager._isAlreadySatisfied(node)` checks a small set of known
event types against real manager state (`ApplicationManager.isRunning`,
`ActiveInvestigationManager.getActive`, `MailManager.getById`,
`ForensicsManager.getById`) right when an instruction node is entered, and
auto-advances immediately if the condition already holds. Event types
outside that set (evidence, CCTV, messenger, criminal database, board,
map) fire unconditionally on every user interaction in the existing
codebase, so they don't need this check — the live listener alone is safe
for those.

This same idea covers a second, related case (v1.1.4): every instruction
step that logically **precedes** starting the investigation — open Case
Management, select Case 00's card, click Start Investigation — is trivially
already true the instant Case 00 **is** the active investigation, since
none of those could have happened otherwise. Without this check, a resumed
tutorial that lands on e.g. "Select Case 00" (because that's exactly where
the player abandoned it) would wait forever for a card click that will
never happen again — the player already has an active investigation and
has no reason to reselect the case. `_isAlreadySatisfied` now treats
`case:card-selected`, `investigationStarted`, and `app:opened` for
`case-management` as satisfied whenever
`ActiveInvestigationManager.getActive()?.caseId === 'case-00'` is already
true, and fast-forwards through them on resume.

## 5. Case 00 Phases

Welcome → Desktop → Case Management → Active Investigation → Police Mail →
Evidence Database → City Map → Messenger → CCTV → Forensics →
Criminal Database → Investigation Board → Solving.

Each phase (after "Welcome") maps directly onto an application the player
must actually open and use — see `data/cases/case-00/objectives/phases.json`
for the underlying gameplay phases this mirrors.

## 6. Locking the Game World

While `TutorialManager` is active, it:

1. Adds capture-phase listeners (`click`, `pointerdown`, `mousedown`,
   `keydown`, `touchstart`) on `document`.
2. On every intercepted event, allows it through only if the event target is
   inside the tutorial dialog UI (`.tutorial-dialog`) **or**, during an
   instruction step, inside the currently highlighted target element.
   Everything else is `preventDefault()` + `stopImmediatePropagation()`'d.
3. Adds a `tutorial-locked` class to `<body>` so CSS can dim the desktop,
   taskbar, and window layer for a clear visual cue (see
   `css/tutorial/tutorial.css`).

This is intentionally a capture-phase interceptor rather than a full-screen
blocking `<div>` — it lets the *real* target element (a desktop icon, a case
card, a Start Investigation button) stay genuinely clickable without any DOM
surgery, while everything else on the page is inert.

`TutorialManager.isLocked()` / `EventBus` events `tutorial:locked` /
`tutorial:unlocked` are available for any other system that needs to know.

## 7. Highlight System

`TutorialHighlight.show(selector, scope)` resolves the selector (optionally
scoped to the desktop icon layer or a specific app window via
`[data-window-id="<appId>"]`, since window ids equal app ids), then tracks
its `getBoundingClientRect()` every frame and positions a bordered,
pulsing box around it. The dim-everything-else effect comes from a single
`box-shadow: 0 0 0 9999px rgba(0,0,0,0.6)` on the highlight box itself — no
separate full-screen overlay element is needed.

`TutorialHighlight` is intentionally reusable outside the tutorial system —
it does not lock anything itself. A future contextual-hint feature could use
it for a non-blocking nudge.

### Avoiding a lock with no valid target when content loads asynchronously (v1.1.5)

Several apps load their case data asynchronously *after* their window
opens rather than before — Evidence Database calls
`EvidenceManager.loadForCase()` (an async fetch) from inside its own
mount, and CCTV, Messenger, and Criminal Database follow the same
pattern. `app:opened` fires as soon as the window exists, which can be
before that fetch resolves. If an instruction step's `highlightTarget`
selector matched content from that fetch (e.g. `.ev__list-item`),
`TutorialHighlight` used to look it up exactly once and give up silently
if it wasn't there yet — leaving the lock with no valid target at all, so
the *entire* screen appeared locked with nothing clickable, even after
the list finished loading a moment later.

`TutorialHighlight.show()` now retries the lookup every frame for up to
8 seconds instead of giving up on the first miss, and if the DOM node it
was tracking is later removed (e.g. a list re-renders with fresh nodes on
a filter change), it resumes searching rather than hiding permanently.
This is handled entirely inside `TutorialHighlight` — no per-app or
per-node changes were needed, and it protects every future highlighted
step against the same class of race, not just Evidence Database.

### Tutorial progress vs. real objective state must never disagree (v1.1.6)

Several instruction steps map onto a real Case 00 objective (e.g. "open an
evidence item" corresponds to the objective **Inspect Evidence**, which
Case Management and the Active Investigation panel track independently).
Earlier versions matched these steps against a single raw gameplay event —
`mail:read`, `evidence:opened`, `person:selected`, etc. — chosen to
resemble the objective's condition. This went wrong two ways:

1. **The chosen event didn't always match what the real objective actually
   listens for.** `core/objectives/ConditionMatcher.js` is CID OS's
   authoritative table of which event completes which condition type, and
   several of the events the tutorial guessed at didn't match it exactly
   — e.g. the real "Inspect Evidence" objective requires the item both
   **viewed and noted** (two conditions), not just opened; "Review CCTV"
   requires the footage viewed **and a timestamp bookmarked**; "Build
   Investigation Board" requires a **connection and a theory**, not just
   any node added.
2. **Even where the event matched, checking it directly could go stale.**
   `mail:read` only fires the *first* time a mail is marked read — if that
   happened before the objective existed to listen for it (e.g. during
   free exploration before Case 00 was even started), the objective can
   never complete from that event again, but the tutorial's own proxy
   check couldn't tell the difference.

Both problems have one root cause: the tutorial was re-deriving objective
completion instead of asking the objective system directly. Every
instruction step that maps to a real objective now uses
`requiredAction: { "event": "objective:completed", "match": { "objectiveId": "T00-05" } }`
— the exact event `ObjectiveManager._completeObjective()` emits, which is
also what Case Management and the Active Investigation panel are driven
by. `_isAlreadySatisfied()` mirrors this with
`ObjectiveManager.getVisibleObjectives()`, so a resumed tutorial checks
the same source of truth. The tutorial and the real objective display can
no longer disagree, because they're now reading the same fact rather than
two independently-derived approximations of it.

This also surfaced one missing step entirely: the real objective chain
requires **opening the mail's attachment** (`T00-04`) between reading the
report and evidence becoming available — the dialogue previously jumped
straight from "read the mail" to "check the evidence," which would have
left the real Evidence objective permanently unavailable. A new
instruction node (`t00-026b`) was added for it.

`forensics:requested` is intentionally left as a raw event rather than
switched to `objective:completed`: "Complete Forensics" requires both
submission *and* waiting for the lab to finish, and the tutorial
deliberately treats "submitted" as its own beat ("analysis takes time,
check back later") rather than blocking on the wait. This is a narrative
choice, not a gap — the raw event and its single condition can never
disagree with each other the way a composite/multi-event objective could.

## 8. Replay vs. Resume Behavior

Case 00's case definition already has `"replayable": true`. On top of that,
`TutorialManager` distinguishes two situations that both look like
"Case 00 becomes active again," but call for opposite behavior:

- **Resume** — the tutorial was left mid-sequence (page reload, tab closed,
  browser crash) while Case 00 was still active. The player's actual
  investigation progress (objectives, read mail, etc.) survived that
  reload untouched — persisted the same way it always was — so the
  mentor's dialogue must not pretend none of it happened by restarting
  at "Welcome, Detective." On `workstation:ready`, if Case 00 is the
  active investigation **and** a saved tutorial run exists with
  `status: "in-progress"`, `TutorialManager` re-enters at that exact
  saved node.
- **Reset** — Case 00 is started as a genuinely fresh run: the previous
  tutorial run finished normally (`status: "completed"`) or the player
  used the Skip control (`status: "skipped"`). On the next
  `investigationStarted` for Case 00, `start()` resets to the first node,
  matching the original "Case 00 is always a tutorial" requirement — a
  deliberate replay should feel like a full replay.

Progress is persisted via `StorageManager` (never `localStorage` directly)
under the key `tutorial:case-00:progress` as `{ nodeId, status }`, written
on every node transition and on completion/skip. No flag permanently
disables the tutorial, and nothing about having seen it before blocks a
genuine replay from starting over — only an *interrupted* run resumes.

Completion/skip statistics may be read from the same persisted record or
from the `tutorial:completed` / `tutorial:skipped` events.

## 9. Adding a Future Tutorial

1. Write a new dialogue JSON file following the structure in §4.
2. Point a new `TutorialManager`-style trigger at it (or generalize
   `TutorialManager` to accept a dialogue URL + trigger condition per
   tutorial — the engine's node/lock/highlight logic already has no
   Case-00-specific assumptions baked in).
3. Reuse `TutorialDialog` and `TutorialHighlight` as-is.

No core engine change should be required to add: advanced tutorials,
feature-introduction walkthroughs, case-specific guidance, optional hints,
or accessibility tutorials — only new JSON content and a trigger.
