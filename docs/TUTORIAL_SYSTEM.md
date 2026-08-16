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

### Avoiding soft-locks on already-true conditions (v1.1.1)

Some gameplay actions are idempotent/guarded — a singleton app only emits
`app:opened` on its first open (reopening just focuses it), `MailManager`
only emits `mail:read` the first time a given mail is read, and
`ForensicsManager` only emits `forensics:requested` the first time a given
analysis is submitted. If the player reached an instruction step for one of
these *after* the condition was already true — e.g. they opened Police Mail
before the tutorial told them to, or they're replaying Case 00 after already
reading that mail in a prior playthrough — the live event would never fire
again, and the tutorial would wait forever.

`TutorialManager._isAlreadySatisfied(node)` checks a small set of known
event types against real manager state (`ApplicationManager.isRunning`,
`ActiveInvestigationManager.getActive`, `MailManager.getById`,
`ForensicsManager.getById`) right when an instruction node is entered, and
auto-advances immediately if the condition already holds. Event types
outside that set (evidence, CCTV, messenger, criminal database, board,
map) fire unconditionally on every user interaction in the existing
codebase, so they don't need this check — the live listener alone is safe
for those.

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
