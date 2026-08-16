# Tutorial System

**Status:** v2.0.0
**Related files:**
`managers/TutorialManager.js` · `ui/TutorialDialog.js` · `ui/TutorialHighlight.js` ·
`css/tutorial/tutorial.css` · `data/tutorial/case-00-dialogue.json` ·
`docs/missions/case-00/character-presentation-prompts.md`

---

## 1. Overview

The tutorial system is a reusable, **data-driven** engine that walks a new
player through CID OS as a conversation between two detectives — **Det.
Marcus Reyes** and **Det. Elena Cho** — before and during Case 00. It is not
hardcoded to Case 00 — every dialogue line, required action, and highlight
target lives in a JSON file, so future cases or feature introductions can
define their own tutorial without touching `TutorialManager.js`.

v2.0 replaced the original single-mentor design (a single unillustrated
"Senior Detective") with this two-detective conversation. See
`docs/missions/case-00/character-presentation-prompts.md` for why — no
existing male+female character pair or artwork existed in the project to
reuse, so Reyes and Cho are newly established here, not a redesign of
something pre-existing.

```
Reyes            explains a concept
      ↓
Cho               gives the concrete instruction / demonstrates
      ↓
Player            performs the real action
      ↓
Reyes or Cho      reacts to what the player did
      ↓
Next lesson
```

Both detectives are shown at all times during dialogue (Reyes left, Cho
right); whichever one is currently speaking is emphasized, the other is
dimmed. See §4 and §10.

## 2. Architecture

| Piece                     | Responsibility |
|----------------------------|----------------|
| `TutorialManager`          | Owns tutorial state, sequencing, locking, and required-action detection. The only piece that knows *when* to show what. Exposes the state machine (§10) as a thin read-only layer over the same node graph — there is no separate parallel state engine. |
| `TutorialDialog`           | Pure view — renders the two-detective dialogue box, the instruction banner, or the resume prompt (§9). Holds no state. |
| `TutorialHighlight`        | Pure view — draws and tracks the pulsing highlight box around a target element. Holds no state. |
| `data/tutorial/*.json`     | Content. Speakers, text, sequencing, required action, highlight target, lesson — see §4. |

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
    "id": "t00-013",
    "phase": "desktop",
    "lesson": 3,
    "lessonTitle": "Opening Applications",
    "speaker": "female-detective",
    "type": "instruction",
    "text": "Open Case Management.",
    "requiredAction": { "event": "app:opened", "match": { "appId": "case-management" } },
    "highlightTarget": "[data-app-id=\"case-management\"]",
    "highlightScope": "desktop",
    "next": "t00-014"
}
```

| Field              | Meaning |
|---------------------|---------|
| `id`                | Unique node id. |
| `phase`             | Which tutorial phase this belongs to (see §5) — drives `TutorialManager.getState()`, see §10. |
| `lesson`            | Lesson number 1–18 (EPIC Part 9) — drives `TutorialManager.getCurrentLessonId()` and the persisted `currentLessonId` (§8). |
| `lessonTitle`       | Human-readable lesson name, for any future progress UI. Informational only. |
| `speaker`           | Key into the file's top-level `speakers` map — `"male-detective"` (Det. Marcus Reyes) or `"female-detective"` (Det. Elena Cho). |
| `type`              | `"dialogue"` or `"instruction"`. |
| `text`              | The line shown to the player. |
| `requiredAction`    | *(instruction only)* `{ event, match? }` — the EventBus event (and optional payload fields) that completes this step. |
| `highlightTarget`   | *(instruction only)* CSS selector for the element to highlight. |
| `highlightScope`    | *(optional)* `"desktop"`, `"window:<appId>"`, or omitted to search the whole document — narrows an ambiguous selector. |
| `next`              | The next node's `id`, or `null` to end the tutorial. |

No tutorial text is hardcoded in JavaScript — see `data/tutorial/case-00-dialogue.json`.
Both speakers are declared once in the file's top-level `speakers` map
(`{ name, portrait, emoji }` each); `TutorialDialog` always renders both
portraits and highlights whichever one the current node names.

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

## 5. Case 00 Phases and Lessons

| Phase (`phase` field) | `TUTORIAL_STATES` value | Lesson(s) |
|---|---|---|
| `welcome` | `INTRODUCTION` | 1. Welcome to CID OS |
| `desktop` | `DESKTOP_TRAINING` | 2. Understanding the Desktop · 3. Opening Applications |
| `case-management` | `CASE_MANAGEMENT_TRAINING` | 4. Case Management · 5. Starting an Investigation |
| `active-investigation` | `ACTIVE_CASE_TRAINING` | 6. Understanding Active Investigation |
| `police-mail` | `MAIL_TRAINING` | 7. Police Mail |
| `evidence` | `EVIDENCE_TRAINING` | 8. Evidence Database |
| `city-map` | `MAP_TRAINING` | 9. City Map |
| `messenger` | `MESSENGER_TRAINING` | 10. Messenger |
| `cctv` | `CCTV_TRAINING` | 11. CCTV Viewer |
| `forensics` | `FORENSICS_TRAINING` | 12. Forensics Lab |
| `criminal-database` | `DATABASE_TRAINING` | 13. Criminal Database |
| `board` | `BOARD_TRAINING` | 14. Investigation Board · 15. Connecting Evidence · 16. Creating a Theory |
| `solving` | `SOLVING_TRAINING` | 17. Solving the Investigation · 18. Completing Case 00 |

Each phase (after "Welcome") maps directly onto an application the player
must actually open and use — see `data/cases/case-00/objectives/phases.json`
for the underlying gameplay phases this mirrors. Lessons 17–18 wait on the
real `T00-12` (Solve Investigation) and `T00-13` (Complete Tutorial)
objectives, the same way every earlier lesson waits on a real objective —
see §3's `objective:completed` note in §7's v1.1.6 section below.

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

### Instruction steps whose required action spans more than one DOM region (v2.0.1)

Three instruction steps ask for more than a single click on the highlighted
element:

- Evidence (`t00-033`) — open the item **and write a note**. The note
  textarea (`.ev__detail-notes`) lives in the app's detail panel, a
  sibling of the list (`.ev__list`), not a descendant of the list item.
- CCTV (`t00-045`) — select the camera **and play the footage and
  bookmark it**. Playback controls and the bookmark button live in the
  center/right panels, siblings of the camera list.
- Board (`t00-059`) — add pieces, **connect them on the canvas**, and add
  a theory card. Connecting happens via `mousedown`/`mousemove` handlers
  bound directly to `.board__canvas`, a sibling of the toolbar buttons.

Each of these previously set `highlightTarget` to only the *first* element
the player interacts with (the list item, the camera item, a toolbar
button). Since `TutorialManager._handleIntercept` only allows events whose
target is inside `.tutorial-dialog` or inside
`TutorialHighlight.getTarget()`, every click and keystroke aimed at the
second/third part of the task — the notes textarea, the playback controls,
the canvas — was silently swallowed by the capture-phase lock. The result
was a hard stop the player couldn't see the cause of: the instruction text
said to do something the lock itself was preventing.

Fixed by widening those three nodes' `highlightTarget` to the app's whole
content root (`.ev`, `.cctv`, `.board` — the class each app adds to its own
`contentEl` in `create()`), so the entire window is unlocked once the
player is inside it for that step, rather than one sub-element. The other
"open X and do one thing to it" steps (Police Mail, City Map, Messenger,
Criminal Database) don't have this problem — in each of those, the only
required action is a click on the exact element already being highlighted.

### "Continue Investigation" silently wiping real progress (v2.0.2)

Two related, pre-existing bugs (not introduced by v2.0's tutorial rewrite,
but directly undermining §8's resume promise) surfaced once a tutorial run
was genuinely interrupted:

1. **`CaseManager.startCase()` / `ActiveInvestigationManager.start()`
   treated every start of a replayable case (Case 00) as a fresh replay —
   even if its status was already `'In Progress'`.** This is exactly the
   state a case is left in when the live session pointer is lost (e.g. a
   page reload where `SessionManager`'s pointer failed to restore) while
   the case's on-disk status/progress survived. Clicking **Continue
   Investigation** in that state called the same reset path as a genuine
   replay — `ActiveInvestigationManager._resetThenStart()` — wiping
   evidence notes, CCTV bookmarks, forensics requests, board state, and
   every objective's completion, with no indication to the player that it
   had happened. Fixed: both methods now only treat `'Unlocked'` (never
   started) or `'Solved'` (finished, deliberately replayed) as a genuine
   reset. `'In Progress'` re-syncs without touching any manager's
   persisted state — matching how non-replayable cases already behaved.
   Case 00 replay (EPIC Part 18) is unaffected: solving it still flips
   status to `'Solved'`, and starting it again from there still resets.

2. **Case Management's objectives checklist and progress bar never
   consulted `ObjectiveManager` at all** — `_renderDetail()` rendered the
   case's static `objectives` string list with a hardcoded `☐` and the
   case's static (rarely-updated) `c.progress` field, regardless of what
   was actually completed. `context.getActiveInvestigation()` already
   exposes live `progress`/`completedObjectives` whenever the case is the
   active session (`ActiveInvestigationManager.getActive()` supersedes the
   static placeholders with `ObjectiveManager`'s real numbers whenever
   `ObjectiveManager.hasGraph()` — see `core/InvestigationSession.js`);
   the panel just wasn't reading it. Fixed: the checklist now checks off
   (`☑`) any objective whose title appears in
   `activeInv.completedObjectives`, and the progress bar reads
   `activeInv.progress` while this case is the active session.

Bug 1 masked bug 2 in practice — every time bug 1's silent reset fired,
the checklist correctly showed nothing checked because nothing genuinely
was, right after the reset. But bug 2 was real and independent: even
without bug 1, the checklist would never have reflected real progress.

## 8. Replay vs. Resume Behavior

Case 00's case definition already has `"replayable": true`. On top of that,
`TutorialManager` distinguishes two situations that both look like
"Case 00 becomes active again," but call for opposite behavior:

- **Resume** — the tutorial was left mid-sequence (page reload, tab closed,
  browser crash) while Case 00 was still active. The player's actual
  investigation progress (objectives, read mail, etc.) survived that
  reload untouched — persisted the same way it always was. On
  `workstation:ready`, if Case 00 is the active investigation **and** a
  saved tutorial run exists with `status: "in-progress"`,
  `TutorialManager` does **not** silently jump back in. It shows the
  resume prompt (§9) and waits for the player to choose:
  - **Continue Training** re-enters at the exact saved node.
  - **Restart Tutorial** clears the saved node and starts fresh from the
    first node, exactly like a normal replay (below).
- **Reset** — Case 00 is started as a genuinely fresh run: the previous
  tutorial run finished normally (`status: "completed"`) or the player
  used the Skip control (`status: "skipped"`). On the next
  `investigationStarted` for Case 00, `start()` resets to the first node,
  matching the original "Case 00 is always a tutorial" requirement — a
  deliberate replay should feel like a full replay.

Progress is persisted via `StorageManager` (never `localStorage` directly)
under the key `tutorial:case-00:progress` as
`{ nodeId, status, tutorialCaseId, tutorialState, currentLessonId, currentDialogueId }`,
written on every node transition and on completion/skip. `nodeId` and
`currentDialogueId` are always the same value — the field is duplicated
under both names because `nodeId` is what `_hasResumableProgress()` reads
and `currentDialogueId` is the name the spec (EPIC Part 19) asks the save
data to use. `tutorialState` is the `TUTORIAL_STATES` value (§10) and
`currentLessonId` the 1–18 lesson number (§5) at that node, so a save
inspector doesn't need to cross-reference the dialogue JSON to know roughly
where a save is. No flag permanently disables the tutorial, and nothing
about having seen it before blocks a genuine replay from starting over —
only an *interrupted* run gets asked.

Two fields the EPIC spec also lists for save data —
`activeInvestigationId` and `completedObjectives` — are deliberately **not**
duplicated in the tutorial's own save record. `InvestigationSession` and
`ObjectiveManager` already own those (see §13 of the EPIC and
`core/InvestigationSession.js`), and the tutorial only guides; storing a
second copy here would create exactly the two-source-of-truth problem
`objective:completed` matching (§7, v1.1.6) was written to eliminate.

Completion/skip statistics may be read from the same persisted record or
from the `tutorial:completed` / `tutorial:skipped` events.

## 9. Resume Prompt

`TutorialDialog.showResumePrompt({ onContinue, onRestart })` renders the
same dialogue-box chrome as a normal dialogue node, with a single generic
portrait (not yet attributed to either detective — the saved node hasn't
been re-entered yet) and two buttons: **Restart Tutorial** and **Continue
Training**. The game world is locked the same way an active dialogue node
locks it (§6), so the player can't interact with anything else while
deciding. Neither button is pre-focused into an accidental default beyond
normal keyboard focus order; both require a deliberate click.

## 10. Tutorial State Machine

`TutorialManager` exposes the states from EPIC Part 10 as
`TUTORIAL_STATES` (a frozen object of string constants) and
`TutorialManager.getState()` / `getCurrentLessonId()`. This is **not** a
second state engine running in parallel with the node graph — each node's
`phase` field maps to exactly one `TUTORIAL_STATES` value via a fixed table
in `TutorialManager.js` (`PHASE_TO_STATE`), so the state is always in sync
with whatever node is actually on screen. `PAUSED` is defined as a state
value for future use (e.g. an explicit pause control) but nothing in the
current flow transitions into it — Case 00 has no pause feature yet, only
resume-after-interruption (§8–9), which is a different thing (leaving vs.
explicitly pausing). See "Known issues" in the Case 00 implementation
report for the same caveat.

## 11. Adding a Future Tutorial

1. Write a new dialogue JSON file following the structure in §4.
2. Point a new `TutorialManager`-style trigger at it (or generalize
   `TutorialManager` to accept a dialogue URL + trigger condition per
   tutorial — the engine's node/lock/highlight logic already has no
   Case-00-specific assumptions baked in).
3. Reuse `TutorialDialog` and `TutorialHighlight` as-is.

No core engine change should be required to add: advanced tutorials,
feature-introduction walkthroughs, case-specific guidance, optional hints,
or accessibility tutorials — only new JSON content and a trigger.
