# ARCHITECTURE_2.md
## CID OS Architecture 2.0 — Epic 01

Version: 2.0
Status: Foundational layer complete and wired into boot. Full per-application
migration off direct manager imports is staged — see §7.

This document describes the architecture introduced by Epic 01. It is
additive on top of `ARCHITECTURE.md` (Phase 0/1) — nothing described there
was removed, and every Phase 1 application (Mission 00–14) continues to
work unmodified.

---

## 1. Why

Before this epic, "which case is the player working on" lived nowhere in
particular. Case Management emitted `case:selected` whenever a row in its
list was clicked, and eight other applications each independently listened
for that event to decide what data to show. There was no single place to
ask "what's active right now," no persistence of the workspace across a
page refresh, and every future feature on the roadmap (Save/Resume, User
Profiles, Notifications, Multiplayer, Modding) would have needed to bolt
onto that same ad-hoc event.

Architecture 2.0 introduces one source of truth — **ApplicationContext**
— backed by two new managers, so every future feature has one foundation
to build on instead of five.

---

## 2. New Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Applications                           │
│   (Case Management, Police Mail, Evidence, CCTV, Map, …)    │
└───────────────────────────┬───────────────────────────────┘
                             │ this.context
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   ApplicationContext                        │
│  currentSession · currentInvestigation · currentUser        │
│  settings · theme · language · notifications                │
│  desktop · windowState · investigation.start/stop/complete  │
└───────┬─────────────────────┬─────────────────┬─────────────┘
        │                     │                 │
        ▼                     ▼                 ▼
┌────────────────┐  ┌───────────────────────┐  ┌───────────────┐
│ SessionManager  │  │ ActiveInvestigation   │  │ Settings /    │
│                 │  │ Manager                │  │ Theme Manager │
│ open apps       │  │ Locked/Available/      │  │ (existing)    │
│ notifications   │  │ Active/Completed/      │  └───────────────┘
│ widget state    │  │ Archived state machine │
│ running timers  │  │ wraps CaseManager      │
└────────┬────────┘  └───────────┬────────────┘
         │                       │
         ▼                       ▼
   StorageManager           CaseManager
   (existing, unchanged)    (existing — case DATA authority,
                              unchanged data shape/JSON files)
```

- **`core/ApplicationContext.js`** — a read-oriented facade. Every
  application receives it as `this.context` (wired in `BaseApp`'s
  constructor). It owns no state itself; every getter delegates to an
  existing or new manager. Mutating investigation state goes through
  `context.investigation.start(id)` / `.stop()` / `.complete()`.

- **`managers/SessionManager.js`** — owns the *session*: which apps are
  open, the notification queue, running timers, and the widget's
  collapsed/expanded flag. Persists to `StorageManager` under the
  `session` key. It does **not** own the active-investigation state
  machine — it only stores the pointer (`activeInvestigationId`) on
  behalf of ActiveInvestigationManager.

- **`managers/ActiveInvestigationManager.js`** — the single authority for
  "which investigation is active." Enforces the Locked → Available →
  Active → Completed / Archived state machine, requires confirmation
  before abandoning an in-progress investigation for a different one,
  and is the only module that calls `CaseManager.startCase()` /
  `completeCase()` / `archiveCase()`. CaseManager remains the source of
  truth for case *data* — nothing about the case JSON format or
  per-case folder structure changed (`CASE_FORMAT.md` is still accurate).

- **`managers/InvestigationWidgetManager.js`** — builds and owns the
  permanent bottom-right desktop widget (see §5).

---

## 3. Events

New events (all emitted by `ActiveInvestigationManager` unless noted):

| Event | Payload | Fired when |
|---|---|---|
| `investigation:started` | `{ investigation }` | `context.investigation.start(id)` succeeds |
| `investigation:resumed` | `{ investigation }` | Boot re-affirms the last session's active investigation |
| `investigation:completed` | `{ investigation }` | `context.investigation.complete()` |
| `investigation:stopped` | `{ investigationId }` | `context.investigation.stop()`, or a different investigation is started |
| `investigation:changed` | `{ investigation \| null }` | After every transition above — the one event to subscribe to if you just want "something changed" |
| `context:changed` | `{ context }` | Emitted by `ApplicationContext` — aggregates `investigation:*`, `settings:changed`, `theme:changed`, `wallpaper:changed`, `notification:added` into one signal |

**Legacy compatibility shim.** `ActiveInvestigationManager` also emits the
original `case:selected` event with its original `{ case }` payload shape
on every start/resume/rebroadcast. This is what lets every Phase 1
application keep working with **zero code changes** — see §7.

Existing events (`case:loaded`, `case:progress`, `case:started`, etc.)
are unchanged. `CaseManager.startCase()` still emits `case:started`
exactly as before, since `ActiveInvestigationManager.start()` calls it
internally.

---

## 4. BaseApp Lifecycle

`BaseApp` now injects `this.context = ApplicationContext` in its
constructor — every application, old or new, has it from the moment it's
instantiated (not just after `create()`).

Two lifecycle sets coexist on purpose:

| Phase 1 (unchanged) | Architecture 2.0 (additive) |
|---|---|
| `create(contentEl)` | — |
| `open()` | `onOpen()` — called right after `open()` |
| `close()` | `onClose()` — called right before `close()` |
| `minimize()` | `onSuspend()` — called right after `minimize()` |
| `restore()` | `onResume()` — called right after `restore()` |
| — | `onContextChanged(ctx)` — called on every `context:changed` |

`ApplicationManager` calls both sets. Every existing app that overrides
`open()`/`close()`/`minimize()`/`restore()` keeps working exactly as
before. New code, and apps migrated per §7, should prefer the `onX()`
hooks and read from `this.context` instead of subscribing to individual
manager events.

`ApplicationManager` also auto-subscribes every launched app to
`context:changed` and unsubscribes it on close — subclasses never need to
manage that listener themselves.

---

## 5. Active Investigation Widget

A permanent, non-closable widget fixed to the bottom-right of the
desktop, on every device size (`css/widgets/investigation-widget.css`).
Mounted once at boot by `InvestigationWidgetManager`, directly into the
desktop root element returned by `DesktopManager.getDesktopElement()`.

- **Expand / Collapse only** — no close button exists in the markup.
  Collapsed state persists via `SessionManager.setWidgetCollapsed()`.
- **Three states**, matching `ActiveInvestigationManager`'s state
  machine:
  - *No Active Investigation* — prompt + "Open Case Management" button.
  - *Active* — title, status pill, progress bar, up to 4 objectives,
    "Open Case" button.
  - *Completed* — title, ✅ status, "Start a New Investigation" button.
- Re-renders on `context:changed`, `investigation:changed`, and
  `case:progress` — it never polls.
- The "Open Case" / "Open Case Management" button emits the existing
  `application:requested` event — the widget never calls
  `ApplicationManager` directly, consistent with the rest of CID OS.

**Known simplification:** objectives are rendered as a static list from
`case.objectives` (plain strings). There is no per-objective
completed/pending state yet — that depends on Mission 16 (Objective
Engine), which is still `Planned`. The widget shows progress via the
existing `case.progress` percentage only.

---

## 6. Save / Session Restore

`SessionManager` persists under the `session` key in `StorageManager`:

- `activeInvestigationId`
- `openApps` — `[{ appId, minimized }]`
- `notifications` (capped at 50)
- `runningTimers` — registered by any manager that starts a long-running
  wait (e.g. Forensics), so a future feature can reconcile them; nothing
  currently calls `registerTimer()` yet — the API exists ahead of need
- `widget.collapsed`
- `meta.lastSaved`, `meta.version`

**Boot-time restore order** (see `Workstation.boot()`):

1. `SessionManager.initialize()` — loads the persisted session.
2. `CaseManager.initialize()` → `ActiveInvestigationManager.initialize()`
   — re-affirms the active investigation and fires the legacy
   `case:selected` bridge.
3. Every other gameplay manager initializes as before.
4. `ApplicationManager.restoreSession()` — re-launches every app that
   was open last session (and re-minimizes the ones that were
   minimized).
5. `ActiveInvestigationManager.rebroadcast()` — re-fires
   `investigation:changed` / `case:selected` **after** step 4, because
   apps only subscribe to `case:selected` inside their own `open()`,
   which just ran for the first time in step 4. Without this second
   broadcast, a restored Evidence/CCTV/Messenger/etc. window would show
   its empty state even though an investigation is active.
6. `InvestigationWidgetManager.initialize()` mounts after
   `DesktopManager.show()`.

**Known simplification — window positions are not yet restored.**
`WindowManager` has no position-persistence hooks today; `restoreSession()`
only restores *which* apps were open and whether each was minimized, not
their exact `x`/`y`/size. Adding that is a small, isolated follow-up
(persist on drag/resize end, replay in `WindowManager.create()`) and was
left out of this epic to keep the blast radius on `WindowManager`
minimal — it wasn't listed as an explicit deliverable line item beyond
"Window Positions" appearing in the Session shape, which is why the field
exists in `SessionManager`'s shape but isn't populated yet.

---

## 7. Migration Status

> **Superseded by §11.** Everything below describes the state after Epic
> 01 alone. Epic 01.1 completed the migration this section describes as
> outstanding — see §11.5 for the current, accurate per-application
> status. Left in place for the historical record of why the migration
> was staged the way it was.

The epic's architecture rule — *"Applications must never communicate
directly with individual managers"* — is the end-state target, not
something every one of the ten existing applications was rewritten to
satisfy in this pass. Rewriting all ten to drop their direct manager
imports and rebuild their data-loading around `context:changed` is a
large, mechanical, per-app change with real regression risk, and the
epic's own top priority is explicit: *"All existing functionality from
Phase 1 must continue to work after the refactor."*

What this pass actually did, honestly:

| Layer | Status |
|---|---|
| ApplicationContext / SessionManager / ActiveInvestigationManager | ✅ Built, wired into boot, fully functional |
| BaseApp Architecture 2.0 lifecycle hooks | ✅ Added, called by ApplicationManager for every app |
| `context:changed` broadcast | ✅ Wired across investigation/settings/theme/wallpaper/notifications |
| Active Investigation widget | ✅ Built, mounted, persists collapsed state |
| Save/restore of session + active investigation | ✅ Working (window positions excepted — see §6) |
| Case Management | ✅ Fully migrated — `_startCase` now calls `context.investigation.start()` with confirmation handling; no longer imports `CaseManager.startCase` directly; row-selection no longer broadcasts globally (see below) |
| Police Mail, Messenger, Evidence, CCTV, City Map, Criminal Database, Forensics, Investigation Board | ⏳ Unmigrated — still import their managers directly and still listen for `case:selected`. This works today only because `ActiveInvestigationManager` emits that exact legacy event/payload on every start/resume/rebroadcast. |

**Recommended follow-up mission:** migrate the eight unmigrated
applications one at a time — replace `EventBus.on('case:selected', …)`
with `onContextChanged(context)` reading `context.currentInvestigation`,
and replace direct manager imports (`EvidenceManager`, `CctvManager`,
etc.) with calls proxied through `ApplicationContext` once each
manager's read surface is added there. Doing this incrementally, app by
app, with the legacy shim left in place until the last one is migrated,
avoids a single big-bang rewrite.

**Behavior change worth flagging explicitly:** in Case Management,
clicking a row in the case list now *only* updates the local detail
panel preview — it no longer broadcasts `case:selected` to the rest of
the workstation. Only clicking "Start Investigation" / "Continue
Investigation" does that, via `context.investigation.start()`. This is a
deliberate reading of *"Applications always display the Active
Investigation"* — browsing the list no longer leaks into every other
app's data before the player has actually committed to that
investigation. Since only one case (`case-001`) currently exists, this
doesn't change what a player experiences end-to-end (select → start →
apps populate) — only that the two clicks now do what their labels say
rather than the first one silently doing both.

---

## 8. Backward Compatibility

- No case JSON file required any modification. `CASE_FORMAT.md` is still
  accurate.
- `CaseManager`'s public API is unchanged and extended (added
  `completeCase()`, `archiveCase()`) — nothing was removed or renamed.
- A session saved before this epic simply doesn't exist yet (there was
  no session persistence at all), so there is nothing to migrate *from*
  — `SessionManager._migrate()` exists and defensively merges over a
  fresh default shape for forward compatibility with this version's own
  future changes, per the requirement that future format changes have
  somewhere to branch.
- `Recycle Bin`, `Settings`, and every other Phase 1 app that doesn't
  touch case data at all needed no changes and received none.

---

## 9. Out of Scope (per Epic 01)

No backend, no cloud save, no multiplayer, no authentication, no Steam,
no achievements. `currentUser` on `ApplicationContext` is a single
hard-coded local profile (`{ id: 'detective-local', name: 'Detective',
rank: 'Rookie' }`) — a stable non-null shape for applications to read
today, not a real profile system. Building one is future work this
architecture is meant to make easy, not something this epic implements.

---

## 11. Epic 01.1 — Active Investigation Architecture Refactor

Epic 01 shipped the foundation but left eight applications on a legacy
`case:selected` compatibility shim rather than fully independent of Case
Management. Epic 01.1 closed that gap. This section documents what
changed on top of everything above; §§1–10 describe the layer this was
built on and remain accurate except where noted below.

### 11.1 InvestigationSession replaces the raw case object

`core/InvestigationSession.js` defines the shape every application now
consumes — `investigationId`, `caseId`, `title`, `status`, `startedAt`,
`currentObjectives`, `completedObjectives`, `unlockedEvidence`,
`unlockedEmails`, `unlockedWitnesses`, `unlockedLocations`,
`unlockedReports`, `progress`, `solved`, `failed`. Applications never see
the raw `CaseManager` case object anymore.

The `unlocked*` fields are `null` today — there is no content-gating
engine yet (Mission 19 is still Planned). `null` means "not gated, show
everything," which is what every application already does. These fields
exist now so that engine has a schema to write into later without
another round of per-application changes. `completedObjectives` is
always `[]` for the same reason (Mission 16 — Objective Engine — is also
Planned); `currentObjectives` is the case's full static list.

### 11.2 ApplicationContext's flat API (Epic 01.1 §2)

The nested `context.investigation.start(id)` object from Epic 01 was
replaced with the flat API the spec required:

```
context.startInvestigation(caseId)
context.stopInvestigation()
context.getActiveInvestigation()
context.hasActiveInvestigation()
```

### 11.3 Event names

Epic 01's colon-namespaced events (`investigation:started`,
`investigation:changed`, `investigation:stopped`, `investigation:resumed`)
were replaced outright with the camelCase names Epic 01.1 specified:

| Event | Payload | Fired when |
|---|---|---|
| `investigationStarted` | `{ investigation }` | `startInvestigation()` succeeds |
| `investigationChanged` | `{ investigation \| null }` | After every transition — started, stopped, resumed, completed |
| `investigationStopped` | `{ investigationId }` | `stopInvestigation()` |

**The legacy `case:selected` compatibility event has been retired.**
`ActiveInvestigationManager` no longer emits it. Every application was
migrated in this same pass, so the shim's job is done — see §11.5.

### 11.4 Hard block, not confirm-and-override (§8)

Epic 01 let the player start a second investigation after confirming a
dialog. Epic 01.1 replaces that with a hard block: `ActiveInvestigationManager.start()`
returns `{ ok: false, reason: 'blocked', current }` if a *different*
investigation is Active, and Case Management disables the Start/Continue
button and shows *"Finish or stop the current investigation before
starting another"* instead of offering an override. A new **Stop
Investigation** button was added to Case Management's detail panel for
the currently active case — Case Management is the only application
responsible for starting or stopping an investigation, per §11.6.

### 11.5 Every application migrated off Case Management

All nine applications were rewritten to the same pattern:

```js
// Constructor
this._activeCaseId = null;
this._onInvestigationChanged = ( { investigation } ) => this._syncInvestigation( investigation );

// open()
EventBus.on( 'investigationChanged', this._onInvestigationChanged );
this._syncInvestigation( this.context.getActiveInvestigation() ); // synchronous — don't wait for an event

// close()
EventBus.off( 'investigationChanged', this._onInvestigationChanged );

// Handler
_syncInvestigation( investigation ) {
    if ( !investigation ) {
        this._activeCaseId = null;
        this._renderEmptyState( 'No active investigation.\n\nOpen Case Management and start an investigation.' );
        return;
    }
    if ( this._activeCaseId === investigation.caseId ) {
        this._render();       // same investigation, but the DOM was torn
        return;                // down on close() — re-render from cached data
    }
    this._activeCaseId = investigation.caseId;
    // ...reset local UI state, call this app's own manager.loadForCase(), render...
}
```

The synchronous `this.context.getActiveInvestigation()` check in `open()`
is what makes reopening a window mid-session work correctly without
depending on event timing — a real bug in the Epic 01 pass (documented in
its §6) is now structurally impossible, because every app checks context
directly rather than only reacting to a past broadcast.

**Migration notes per application:**

| Application | What changed |
|---|---|
| Case Management | Hard-block UI (§11.4) + Stop Investigation button. Still the only app that imports `CaseManager` — that's correct, browsing/starting/stopping cases *is* its job per Epic 01.1's own framing. |
| Evidence, CCTV, City Map | Already tracked `_activeCaseId`; renamed the event and fixed the same-investigation-reopen bug. |
| Criminal Database, Forensics, Messenger | Previously had **no** change-detection at all — every `case:selected` blindly called `loadForCase()`. Added `_activeCaseId` tracking and a proper "No active investigation" empty state as part of this migration, not just an event rename. |
| Investigation Board | Canvas-based, no DOM empty-state pattern to reuse — added a canvas-drawn "No active investigation" overlay in `_draw()`. |
| Police Mail | The biggest functional gap: previously had **zero** case-scoping and showed every mail regardless of investigation. `MailManager.getFolder()` and `MailManager.search()` both gained an optional `caseId` parameter (department-wide mail, `caseId: null` in the JSON, always shows; case-specific mail only shows while that case is active). This is the one application where "migration" meant adding real new capability, not just renaming an event. |

### 11.6 Validation workflow (§12)

The exact workflow specified — start CASE-001, open each application in
turn and see it reflect CASE-001, stop the investigation and see every
open application fall back to its empty state, then start a different
case and see already-open applications refresh without reopening — is
structurally supported by the pattern in §11.5: every application
subscribes to `investigationChanged` for the life of the window and
re-syncs on every firing. Only one case (`case-001`) exists in the
current dataset, so the "start CASE-002" leg of that workflow can't be
exercised end-to-end today, but the code path is identical regardless of
which case id is passed to `startInvestigation()`.

### 11.7 What's still open

- Window position restore (documented as a known gap in §6) is unchanged
  by this epic.
- The `unlocked*` / `completedObjectives` fields exist but aren't
  populated by anything yet — that's Mission 19 / Mission 16 territory,
  not this refactor's job.
- `solved` / `failed` on `InvestigationSession` reflect `CaseManager`'s
  status but there's still no in-app way to mark a case solved (no
  accuse/verdict flow) or failed (no fail state exists in the game at
  all) — both are placeholders for future gameplay, same caveat as
  Epic 01 §9.

## 10. File Map

```
core/
    ApplicationContext.js          NEW
    BaseApp.js                     MODIFIED — context injection + onX() hooks
    Workstation.js                 MODIFIED — new boot steps 1c, 7d, 7l, 8b, 9b
managers/
    SessionManager.js               NEW
    ActiveInvestigationManager.js   NEW
    InvestigationWidgetManager.js   NEW
    ObjectiveManager.js             NEW (Mission 16)
    ResolutionManager.js            NEW (Mission 17)
    StateMachineManager.js          NEW (Mission 18)
    UnlockManager.js                 NEW (Mission 19)
    MailManager.js                  MODIFIED (Mission 17) — added injectMail()
    ApplicationManager.js           MODIFIED — session tracking + onX() hook calls
    CaseManager.js                  MODIFIED — added completeCase(), archiveCase()
core/objectives/
    ConditionMatcher.js             NEW (Mission 16)
    ObjectiveGraph.js               NEW (Mission 16)
    ObjectiveActions.js             NEW (Mission 16)
core/resolution/
    ResolutionValidator.js          NEW (Mission 17)
    ResolutionScorer.js              NEW (Mission 17)
    ResolutionReport.js              NEW (Mission 17)
    ResolutionOptions.js             NEW (Mission 17)
core/state-machine/
    StateTransitionMatcher.js       NEW (Mission 18)
    StateActions.js                  NEW (Mission 18)
    RandomEventEngine.js             NEW (Mission 18)
    StateTimerScheduler.js           NEW (Mission 18) — also reused by Mission 19
    HqMailBuilder.js                 NEW (Mission 18)
core/unlock/
    UnlockConditionMatcher.js       NEW (Mission 19)
    UnlockConditionGroup.js          NEW (Mission 19)
    UnlockActions.js                  NEW (Mission 19)
apps/
    case-management/index.js        MODIFIED — see §7
    cctv/index.js                   MODIFIED (Mission 16, 19) — cctv:camera-viewed + unlock filtering
    board/index.js                  MODIFIED (Mission 17) — Solve Investigation → Resolution Wizard
    board/ResolutionWizard.js       NEW (Mission 17)
    board/style.css                 MODIFIED (Mission 17) — wizard + solve-dialog styling
    evidence/index.js               MODIFIED (Mission 19) — unlock filtering
    messenger/index.js              MODIFIED (Mission 19) — unlock filtering
    police-mail/index.js            MODIFIED (Mission 19) — unlock filtering
    criminal-database/index.js      MODIFIED (Mission 19) — unlock filtering
    forensics/index.js              MODIFIED (Mission 19) — unlock filtering
data/cases/case-001/objectives/
    index.json, phases.json, obj-*.json (17 files) NEW (Mission 16)
data/cases/case-001/
    solution.json                   NEW (Mission 17)
    states.json                      NEW (Mission 18)
    unlocks.json                     NEW (Mission 19)
css/
    widgets/investigation-widget.css NEW
docs/
    ARCHITECTURE_2.md                NEW (this file)
```

## 12. Mission 16 — Objective Engine

Upgrades `ObjectiveManager` from a placeholder (Epic 01.1 §11.1 described
its `currentObjectives`/`completedObjectives` fields as unpopulated,
pending this mission) into a fully data-driven engine. A case's entire
investigation progression — branching objectives, dependencies, optional
and hidden tasks, conditions, actions, and phases — is now pure JSON
under `data/cases/{caseId}/objectives/`. No investigation-specific logic
lives in the engine itself.

### 12.1 Objective graph architecture

Three focused modules, kept under the file/class size limits in
`CODING_STYLE.md`:

```
core/objectives/ConditionMatcher.js   — condition type ↔ real EventBus event mapping
core/objectives/ObjectiveGraph.js     — pure dependency/availability/progress math
core/objectives/ObjectiveActions.js   — executes an objective's actions
managers/ObjectiveManager.js          — orchestrator: load, state, persistence, public API
```

`ObjectiveManager` is the only one of the four that's a stateful
singleton (like every other `*Manager`); the other three are pure
functions over plain data, which is what keeps the engine reusable by a
future Case Editor without dragging EventBus/StorageManager along.

An objective definition is exactly the shape MISSION 16's spec JSON
example shows — `id`, `title`, `description`, `category`, `priority`,
`optional`, `hidden`, `conditions[]`, `actions[]`, `dependencies[]`. A
case supplies a list of these files plus `phases.json` under an
`objectives/index.json` manifest, following the same
index-manifest-plus-files convention every other per-case data folder in
`CASE_FORMAT.md` already uses (evidence, forensics, people, etc.) — this
mission introduces no new file-loading pattern.

### 12.2 Dependency resolution

`ObjectiveGraph.recomputeAvailability()` is the entire algorithm: for
every objective that isn't already `completed` or `skipped`, if it's
`hidden` and not yet `revealed` its status is `hidden`; otherwise its
status is `available` if every id in its `dependencies` array is
`completed`, else `locked`. This runs after every completion, every
reveal, and every forced unlock — it's cheap (linear in objective count)
and stateless enough to just re-run from scratch rather than track
incremental deltas, which is what keeps it simple enough to stay pure.

Multiple dependencies are AND'd together, matching the spec's "Review DNA
Report requires Request DNA Analysis AND Collect Laboratory Report"
example directly — case-001's `obj-form-theory` depends on both
`obj-confirm-motive` and `obj-review-board` as a real instance of this.

### 12.3 Condition evaluation

Every objective's `conditions` array uses AND semantics — all conditions
must be satisfied for the objective to complete. `ObjectiveManager`
tracks a parallel `satisfied: boolean[]` per objective in its runtime
state; each condition type maps (via `ConditionMatcher`) to exactly one
real EventBus event name and a function that pulls the comparable id out
of that event's payload. On every fired event, only objectives currently
`available` are checked (locked/hidden/completed objectives never
evaluate conditions), and only the unsatisfied conditions in that
objective's array are tested — once all are true, the objective
completes.

This is also where the optional-objective checklist pattern comes from:
`obj-review-all-cameras` in case-001 has three `cameraViewed` conditions,
one per camera, and only completes once all three cameras have been
viewed — directly implementing the spec's "Inspect every CCTV camera"
example without any special-case code, just three array entries.

`customEvent` conditions bypass the built-in table entirely — they name
their own EventBus event (and optional `target`) directly in JSON.
`ObjectiveManager` collects every case's custom event names at load time
and subscribes to them alongside the built-ins, so the engine never has
to guess in advance what a case might reference.

### 12.4 Action execution

`ObjectiveActions.executeActions()` runs an objective's `actions` array,
in order, once it completes. Every action type from the spec is
implemented: `unlockObjective` (force an objective available immediately,
bypassing its own dependency check — an explicit designer override, kept
distinct from revealing), `revealHiddenObjective` (un-hides an objective
but its dependencies still apply normally), `changePhase`, `emitEvent`
(fires an arbitrary EventBus event/payload — this is what lets
`customEvent` conditions chain off other objectives' completions), and
the seven `unlockX` content actions.

**On the `unlockX` content actions not gating anything yet:** there is no
content-gating engine (Mission 19 — Dynamic Content Unlock Engine — is
still Planned). Every application already shows all of an active case's
content. These actions record the unlock in history and emit
`content:unlocked` so Mission 19 (or a UI toast) has something concrete
to hook into later — forward-compatible plumbing, not a fabricated
feature, consistent with how Epic 01.1 treated `InvestigationSession`'s
`unlocked*` fields.

Action order matters and is exploited deliberately in case-001:
`obj-collect-trace`'s actions list `revealHiddenObjective` before
`emitEvent` — the reveal runs first (making `obj-confirm-motive`
`available`, since its `customEvent` condition was already subscribed at
load time), so the `emitEvent` that follows in the same synchronous pass
is immediately seen and completes it. This is a real, working chain, not
a diagram — starting case-001 and completing the trace analysis actually
cascades through it live.

### 12.5 Event flow

`ObjectiveManager` never imports an application. Applications never
import `ObjectiveManager`. The entire connection is EventBus:
applications emit the same events they always did (`mail:read`,
`evidence:selected`, `forensics:collected`, `board:theory-created`,
etc.) with zero awareness that anything is listening for objective
purposes — exactly the "applications remain unaware of objective logic"
requirement. The one genuinely new event added this mission is
`cctv:camera-viewed`, emitted by the CCTV app when a camera is selected,
because no existing event captured "the player looked at this specific
camera." Every other condition type in case-001 maps onto an event the
codebase already emitted.

### 12.6 Save format

Storage key: `objectives-state:{caseId}` — one entry per case, not per
investigation-session, since re-starting the same case should resume the
same objective progress. Persisted shape:

```
{
  states: { [objectiveId]: { status, revealed, satisfied[], unlockedAt, completedAt } },
  currentPhaseId: string,
  history: [ { type, objectiveId?, phaseId?, contentType?, target?, timestamp } ]
}
```

"Unlocked content" and "hidden objectives" (both called out explicitly
in the spec's Save System section) are intentionally *not* stored as
separate duplicate lists — they're pure derivations of `states` +
`history` (hidden objectives are just `states` filtered by
`status === 'hidden'`; unlocked content is the `content-unlocked`
entries in `history`). Storing the same fact twice risks the two copies
drifting out of sync, which `CODING_STYLE.md`'s "avoid clever code,
prefer explicit solutions" principle argues against — one normalized
source is simpler to reason about and just as persistent.

### 12.7 Debug mode

`ObjectiveManager.debug()` — call it from the browser console — prints a
`console.table` of every objective grouped by completed/available/locked/
hidden, plus the full history and currently-subscribed event list, and
returns the same data as a plain object. `CODING_STYLE.md` prohibits
global variables, so this is a manager method to call explicitly rather
than a `window.*` debug global — a designer opens devtools, and calls
`ObjectiveManager.debug()` directly (the manager is already loaded as a
module-level singleton, so devtools' console can reach it via a live
expression the same way it can reach any other imported singleton).

### 12.8 Responsive

The Active Investigation widget is the only UI surface objectives
currently render into, and it already has a mobile breakpoint from Epic
01 (§5). The one addition this mission makes — highlighting the current
objective when it's `critical` priority — is a text color/weight change,
which doesn't introduce any new layout that could break at narrow
widths.

### 12.9 How Mission 17 (Case Resolution) will use this engine

Mission 17 is explicitly out of scope for this pass, but the engine was
built with its needs in mind:

- **`getProgress().requiredComplete`** is already the exact boolean
  Mission 17's "can the player attempt to solve this case yet" gate
  needs — true once every non-optional objective is completed,
  independent of the optional ones.
- **`getCompletedObjectives()` / `getHistory()`** give Mission 17
  everything it needs to validate *how* the player reached a conclusion
  — e.g. a resolution wizard could require specific objectives
  (`obj-collect-trace`, `obj-form-theory`) to be in the completed set
  before accepting an accusation, or could score a resolution's
  thoroughness against which optional objectives were also completed.
- **`content:unlocked` events** give Mission 17 a timeline of what
  evidence/reports were unlocked and when, useful for a "did the player
  have access to the information their conclusion relies on" check.
- **The `resolution` phase** in case-001's `phases.json` already exists
  as an empty placeholder (`unlockedApps: []`) — Mission 17 is the
  natural place to decide what that phase actually unlocks (a
  resolution/accusation UI) and to call
  `ApplicationContext.completeInvestigation()` (already implemented,
  currently unused by any gameplay flow) once a resolution is accepted.
- Nothing about Mission 17's resolution logic needs to live in
  `ObjectiveManager` itself — it will be a new manager/app that *reads*
  from this engine the same way the Investigation Widget does, keeping
  the "no investigation-specific logic in the engine" rule intact.

## 13. Mission 17 — Case Resolution Engine

Introduces the Deduction Engine: a case is solved by submitting a
complete investigation report, evaluated against a per-case
`solution.json`, not by simply picking a name from a list.

### 13.1 Deduction Engine architecture

Same three-pure-modules-plus-one-orchestrator shape as Mission 16, for
the same reasons (testability, reuse by a future Case Editor "preview my
solution" tool, staying under `CODING_STYLE.md`'s size limits):

```
core/resolution/ResolutionValidator.js  — pure: report vs. solution.json
core/resolution/ResolutionScorer.js     — pure: validation -> outcome + score
core/resolution/ResolutionReport.js     — pure: assembles the Case Summary
core/resolution/ResolutionOptions.js    — shared Motive/Timeline vocabularies
managers/ResolutionManager.js           — orchestrator: load, submit, persist, HQ mail
apps/board/ResolutionWizard.js          — the 7-step UI, launched from Investigation Board
```

`ResolutionWizard` lives inside `apps/board/` rather than as its own
top-level app because the spec is explicit that the Investigation Board
launches it — it's a mode of that window, not a separate OS window. It
renders as a full-screen overlay inside the board's own content element
(`position:absolute; inset:0` over `.board`, which is why `.board`
gained `position:relative`), and was kept in its own file specifically
*because* `apps/board/index.js` was already near `CODING_STYLE.md`'s
line limits — adding 400 more lines inline wasn't an option.

### 13.2 Validation workflow

`ResolutionManager.submit(report)`:

1. Emits `investigation:submitted`.
2. Builds a validation context by reading — never writing — from
   `ObjectiveManager` (completed objective ids, current phase, phase
   order list), `ForensicsManager` (collected analysis ids).
3. Injects the case's fixed `victim` (from `solution.json`, not a wizard
   step — there's no "choose the victim" step in the spec's 7 steps)
   into the report before validating.
4. `ResolutionValidator.validateReport()` checks five things against
   `solution.json` — suspect, weapon, location, motive, timeline — plus
   four requirement sets: required evidence submitted, required
   objectives completed, required forensic reports collected, and
   required phase reached (`current phase order >= required phase
   order`, so a player who moved past the required phase still passes —
   see `_isPhaseReached()`). Emits `investigation:validated`.
5. `ResolutionScorer.scoreResolution()` turns that into one of the five
   outcome tiers (§13.4) and a score object.
6. `ResolutionReport.buildReport()` resolves every id in the report into
   a readable name using lookups the manager gathered from
   `PeopleManager`, `EvidenceManager`, `MapManager`, and
   `ForensicsManager` — the pure module never imports a manager itself.
7. The attempt is recorded, an HQ mail is generated, and
   `resolution:generated` fires with the finished report.
8. On a `Perfect` or `Successful` outcome only,
   `ActiveInvestigationManager.complete()` is called (Epic 01.1's
   `completeInvestigation()` path, implemented back then and unused
   until now) and `investigation:completed` fires.

Nothing is ever locked by an unsuccessful attempt — `reopen()` exists
only to emit `investigation:reopened` for anything listening; the player
could just as well close the wizard and keep investigating without
calling it at all, because no state anywhere prevents that.

### 13.3 Resolution report generation

`ResolutionReport.buildReport()` is intentionally the only place that
turns ids into prose — `person-003` becomes `"Unidentified Male (Person
of Interest)"`, `ev-004` becomes its evidence title, and so on. This
keeps `ResolutionValidator` comparing ids only (fast, unambiguous) while
the Case Summary a player actually reads is fully readable, and it means
a future localization pass only has to touch the data these lookups
already resolve from, not this module.

### 13.4 Scoring model

Five outcome tiers, determined by `coreCorrectCount` (how many of
suspect/weapon/location/motive match `solution.json`, out of 4) and
`requirementsMet` (every required evidence/objective/forensics/phase
check passed):

| Core correct | Requirements met | Optional + full evidence | Outcome |
|---|---|---|---|
| 4/4 | yes | yes | **Perfect Investigation** |
| 4/4 | yes | no | **Successful Investigation** |
| 4/4 | no  | — | **Incomplete Investigation** |
| 2–3/4 | — | — | **Incorrect Investigation** |
| 0–1/4 | — | — | **Investigation Failed** |

Score fields (per spec's Scoring section): `completionPercent` (from
`ObjectiveManager.getProgress()`), `correctEvidencePercent` (required
evidence actually submitted), `optionalObjectivesPercent`,
`unusedEvidence` (evidence that exists for the case but was never
selected as supporting evidence), and `timeTakenMs` (now minus the
investigation's `startedAt`). Per spec, **no XP is computed or stored**
— the score object is plain data, saved for a future profile system to
read, and nothing in this mission consumes it as a reward.

### 13.5 Save format

Storage key: `resolution-state:{caseId}` — one entry per case, mirroring
`ObjectiveManager`'s convention:

```
{
  attempts:       [ { outcome, score, report, timestamp } ],
  bestScore:      { ...score, outcome } | null,
  lastSubmission: { outcome, score, report, timestamp } | null
}
```

"Best" is ranked by outcome tier first, `completionPercent` as the
tiebreaker within the same tier (`_isBetter()`) — a Perfect attempt with
lower completion than a later Successful attempt is still never treated
as worse, matching the tier ordering above.

### 13.6 Event flow

```
Wizard.submit()
  → ResolutionManager.submit()
      → investigation:submitted
      → (reads ObjectiveManager / ForensicsManager — no events, direct reads)
      → investigation:validated     { validation }
      → (reads PeopleManager / EvidenceManager / MapManager for names)
      → resolution:generated        { report }
      → MailManager.injectMail()    → mail:new, mail:loaded
      → [if Perfect/Successful] ActiveInvestigationManager.complete()
                                     → investigation:completed
                                     → investigationChanged (Epic 01.1)
                                     → context:changed (Epic 01)
```

Police Mail needs zero new code to show the HQ response — it already
reacts to `mail:loaded`/`mail:new` the same as any file-loaded mail (see
Epic 01.1 §11.5's Police Mail migration), and `injectMail()` goes through
the exact same `_mergeMail()` path as JSON-loaded mail, so the injected
message is indistinguishable from a hand-authored one once it exists.

### 13.7 How Mission 18 (Investigation State Machine) will use this

Mission 18 is explicitly out of scope here, but this mission was built
so it has real hooks to expand from:

- **Multiple attempts are already tracked** (`getAttempts()`) — a
  branching-path state machine could key different narrative outcomes
  off *which* attempt sequence a player took (e.g. reaching "Successful"
  on the first try vs. after three "Incomplete" attempts), rather than
  Mission 18 needing to build attempt-tracking itself.
- **`investigation:completed` already fires with the outcome tier**, not
  just a boolean — a state machine can branch on `Perfect` vs.
  `Successful` distinctly (e.g. unlocking a bonus epilogue only on
  Perfect) without touching `ResolutionManager`.
- **Replay support** falls directly out of "nothing ever locks" (§13.2)
  — an investigation can already be resubmitted indefinitely; Mission 18
  deciding to branch the *narrative* on a resubmission is additive to a
  mechanic that already exists, not a new one.
- **Dynamic states** (a case that isn't simply Active/Completed but has
  named narrative beats) would sit naturally alongside the existing
  `ObjectiveManager` phase system (Mission 16) — Mission 18's state
  machine reading `ObjectiveManager.getCurrentPhaseId()` and
  `ResolutionManager.getAttempts()` the same way this mission's own
  validator does, rather than either engine needing to know about the
  other's internals.

## 14. Mission 18 — Investigation State Machine

Investigations become dynamic: a case is composed of Investigation
States, only one active at a time, and the world reacts to player
progress through it — content unlock signals, HQ mail, notifications,
and timers that survive a refresh.

### 14.1 State Machine architecture

Same shape as Missions 16/17 — pure modules plus one orchestrator:

```
core/state-machine/StateTransitionMatcher.js — trigger type ↔ real EventBus event
core/state-machine/StateActions.js            — executes a state's entry actions
core/state-machine/RandomEventEngine.js        — deterministic seeded random rolls
core/state-machine/StateTimerScheduler.js      — setTimeout bookkeeping (extracted
                                                  from the manager to stay under
                                                  CODING_STYLE.md's 500-line limit)
core/state-machine/HqMailBuilder.js            — pure HQ-mail-shape assembly
managers/StateMachineManager.js                — orchestrator
```

Unlike `ObjectiveManager` (a dependency *graph* — many objectives can be
`available` simultaneously) `StateMachineManager` is a true FSM — exactly
one state is ever active. That difference shapes the event-subscription
strategy: `ObjectiveManager` subscribes to every condition event a case
might need, once, at load time, because any available objective could
fire at any moment. `StateMachineManager` instead subscribes **only** to
the current state's own transition triggers, and tears that subscription
down and rebuilds it fresh on every transition — there's never a reason
to listen for an event a state the player isn't in cares about.

### 14.2 Transition system

A transition is `{ to, trigger }`. Five of the seven trigger types from
spec are event-driven (`objectiveCompleted`, `evidenceDiscovered`,
`messageRead`, `forensicsCompleted`, `customEvent`) and go through
`StateTransitionMatcher` the same way Mission 16's conditions do. The
other two are manager-driven, not event-driven:

- **`timeElapsed`** — carries a `delayMs`, scheduled via the timer system
  (§14.3) rather than an EventBus subscription.
- **`manualTrigger`** — never fires on its own. `StateMachineManager.
  triggerManualTransition(targetStateId)` is the public entry point;
  it's only valid if the current state actually declares a
  `manualTrigger` transition to that target, so it can't be used to
  jump the machine to an arbitrary state from outside.

First match wins. If a state somehow declared two transitions on the
same event, only the first evaluated fires — `_activateState()` tears
down the current state's listeners synchronously as its very first step,
so there's no window for a second match against a state that's already
been left.

`objectiveCompleted` reacting to `'objective:completed'` — a Mission 16
*output* — is the concrete version of the spec's own example chain
("Player reads HQ email → Crime Scene unlocked → new objective
appears..."): Mission 16 and Mission 18 aren't merged into one engine,
they're two independent engines that both speak EventBus, and each
happily reacts to the other's events without either importing the other.

### 14.3 Timer architecture

Every timer — whether a `timeElapsed` transition or a standalone,
non-transitioning `state.timers[]` entry (the spec's "5 minutes → HQ
requests update" example, which doesn't change state, just fires an
action) — is persisted as `{ id, stateId, endsAt, kind, ... }`, where
`endsAt` is an **absolute** timestamp, not a remaining duration. This is
what makes timers survive a refresh correctly rather than approximately:
on `loadForCase()`, any pending timer belonging to the resumed state has
its remaining time recomputed as `endsAt - Date.now()` — if that's
already ≤ 0 (the delay fully elapsed while the tab was closed), it fires
immediately as a catch-up; otherwise it's re-armed with only the
remaining duration, never the full original delay. `StateTimerScheduler`
owns the live `setTimeout` handles; `StateMachineManager` owns the
persisted record and the resume-time reconciliation, since scheduling
mechanics and case-scoped persistence are different concerns kept in
different files.

### 14.4 Random event framework

`RandomEventEngine.rollRandomEvents()` uses mulberry32, a small seedable
PRNG, so a state's random events (`state.randomEvents[]`, each with an
independent `probability`) roll deterministically from a stored
`randomSeed` — the same seed always produces the same fired/not-fired
outcome for the same state, which is what makes the spec's "Random event
seed" save field meaningful rather than decorative: replaying a
persisted session reproduces exactly what happened, including which
random events fired. Case-001's `lab-results` state demonstrates this
with a 60%-chance "Anonymous Tip Received" HQ mail — the spec's own
example event, generated for real rather than described.

### 14.5 Save structure

Storage key: `state-machine:{caseId}`:

```
{
  currentStateId: string,
  history:        [ { type: 'entered'|'exited'|'random-event'|'content-unlocked',
                       stateId, timestamp, reason?, triggeredBy?, eventId? } ],
  randomSeed:     number,
  pendingTimers:  [ { id, stateId, endsAt, kind, transitionTo?, actions?, repeat? } ]
}
```

History carries exactly what the spec's "State History" section asks
for — entered-at and exited-at are both just `history` entries with
`type: 'entered'`/`'exited'` and matching `stateId`/`timestamp`, and
`reason`/`triggeredBy` are recorded on both. No separate "entered
at"/"exited at" fields are duplicated elsewhere — same normalization
principle as Mission 16/17's save formats.

### 14.6 Event flow

```
Player action → real app event (e.g. messenger:message-read)
  → StateMachineManager's wired handler for the CURRENT state only
      → triggerMatchesEvent() → match found
          → _activateState(newStateId)
              → state:exited (old)
              → state:entered (new) + state:transition
              → StateActions.executeStateActions() → notify / generateHqMail /
                emitEvent / content:unlocked
              → RandomEventEngine roll → any fired event's own actions
              → new transition listeners wired, new timers armed
  → ApplicationContext's 'context:changed' rebroadcast (state:entered,
    state:transition both listened for) → every open application that
    reads from ApplicationContext refreshes with zero extra code, the
    same mechanism Epic 01.1 built for investigation changes generally
```

No application imports `StateMachineManager`. No application needs to —
the spec's "Applications automatically refresh... All update from
ApplicationContext" requirement is satisfied by the exact same
`context:changed` broadcast every other engine in this project already
plugs into, not a new bespoke wiring path.

### 14.7 How Mission 19 (Dynamic Unlock System) expands this

Mission 18 is explicitly out of scope for touching Mission 19, but was
built with it in mind, in the same way Mission 16 and 17 were:

- **`content:unlocked` is already the shared signal.** Mission 16's
  objective actions and Mission 18's state actions both emit the exact
  same event shape (`{ contentType, target, ...sourceId }`) for the
  exact same reason — right now, neither actually hides/reveals
  anything in an application, because entities are globally visible the
  moment their case is active. Mission 19's entire job, as its name
  says, is to make *individual entities* (an email, an evidence item, a
  suspect, a camera, a location) unlock independently — and it can do
  that by listening to the one event both engines already emit, rather
  than needing either engine to change.
- **States naturally become the "container" for what's unlocked when.**
  A state's `actions` list is already "the set of things that become
  true when this state is entered" — Mission 19 turning `unlockEvidence`
  from "emit a signal" into "actually hide `ev-004` from the Evidence
  Database until this fires" is a change entirely inside Mission 19's
  own gating layer, not a change to how states declare their actions.
- **Per-entity state (locked/unlocked/hidden) mirrors what Mission 16
  already proved out** for objectives (`hidden`/`revealed`/`locked`/
  `available`/`completed`) — Mission 19 has a working precedent for the
  state-tracking shape to reuse across evidence, mail, people, CCTV, and
  locations, rather than inventing a new one.
- **`StateMachineManager.getCurrentState()` and `getHistory()`** give
  Mission 19 the "what state is the player in, and what already
  happened" context a gating check needs — e.g. "this email is only
  visible once the `lab-results` state was entered" — without Mission 19
  needing its own copy of state tracking.

## 15. Mission 19 — Dynamic Content Unlock Engine

This is the mission Missions 16 and 18 were both explicitly building
toward. Every `content:unlocked` event either engine emitted was
documented, at the time, as "forward-compatible plumbing — nothing gates
on this yet." That's no longer true for the content types applications
actually filter through (§15.6). `UnlockManager` is the single authority
for "is this visible" — applications never decide that themselves.

### 15.1 UnlockManager architecture

Same pure-modules-plus-orchestrator shape as every engine since Mission
16:

```
core/unlock/UnlockConditionMatcher.js — condition type ↔ real EventBus event
core/unlock/UnlockConditionGroup.js    — pure AND/OR/nested boolean tree
core/unlock/UnlockActions.js            — executes a resolved rule's actions
managers/UnlockManager.js               — orchestrator
```

`UnlockManager` reuses `StateTimerScheduler` from `core/state-machine/`
for its `timeElapsed` conditions rather than writing a second timer
bookkeeper — that class was already generic (delay + callback, no
investigation-specific logic), so reusing it here is exactly the kind of
cross-engine reuse the "no investigation-specific logic in the engine"
rule is meant to enable, not prevent.

**Default-open model.** An entity with no rule targeting it is visible.
This was a deliberate design decision, not an oversight: flipping to
default-*locked* would mean every one of case-001's ~30 entities needs an
explicit unlock rule just to behave as it already did before this
mission, for zero narrative benefit on content that was never meant to
be gated. `unlocks.json` gates only the handful of entities whose
progressive reveal actually matters to the story — everything else is
visible immediately, same as always.

### 15.2 Rule evaluation

A rule is `{ id, target, type, conditions, actions? }`, matching the
spec's own example exactly (which has no `actions` field at all —
`UnlockActions.executeUnlockActions()` defaults a rule with no actions
to a single implicit `{ type: 'unlock' }`, so the simplest possible rule
does exactly what its absence of an `actions` block implies).

Each rule's leaf conditions are tracked with a `Set<number>` of
satisfied indices (assigned by `normalizeConditions()` at load time, in
tree order). On every subscribed event, every *unresolved* rule checks
its unsatisfied leaves against that event; a matching leaf is added to
the set and the rule's tree is re-evaluated. Once a rule resolves, it's
marked `resolved` permanently — no rule re-locks once satisfied.

### 15.3 Condition groups

`UnlockConditionGroup.js` is the whole AND/OR/nested-group
implementation: a rule's `conditions` field is normalized into a
`{ match: 'all'|'any', conditions: [...] }` tree (a bare array becomes
an implicit `match: 'all'` group, so simple rules — like the spec's own
example — never need to think about groups at all), and
`evaluateConditionTree()` recursively resolves it against the satisfied
set. Case-001 has real, live examples of both: `unlock-trace-analysis`
requires `evidenceViewed(ev-006)` **AND** `forensicCompleted(analysis-003)`
(the spec's own "Review DNA Report requires X AND Y" pattern, reused
here); `unlock-motive-hint` fires on `evidenceViewed(ev-004)` **OR**
`forensicCompleted(analysis-003)` — either is enough.

### 15.4 Event flow

```
Player action → real app event (e.g. mail:read)
  → UnlockManager's subscribed handler
      → for every unresolved rule: check unsatisfied leaves against this event
          → leaf(es) satisfied → re-evaluate that rule's condition tree
              → tree now true → rule resolves
                  → UnlockActions.executeUnlockActions()
                      → 'unlock' → content:unlocked  (+ optional notify/generate)
                      → 'hide'   → content:hidden
                      → 'reveal' → content:revealed
  → ApplicationContext's 'context:changed' rebroadcast (content:unlocked/
    hidden/revealed all listened for) → every open application reading
    from ApplicationContext refreshes automatically
```

`objectiveAvailable` conditions are the one exception to pure
event-passthrough — "available" isn't itself a single event Mission 16
emits, so `UnlockManager` polls `ObjectiveManager.getAvailableObjectives()`
on every objective-related event (`objective:completed`,
`objective:progress`, `objective:unlocked`, `objective:revealed`) rather
than needing Mission 16 to add a dedicated event for a state it doesn't
otherwise announce.

### 15.5 Save structure

Storage key: `unlocks:{caseId}`:

```
{
  rules:         { [ruleId]: { satisfied: number[], resolved: boolean, timerEndsAt: number|null } },
  unlocked:       { [type]: [ids] },
  hidden:          { [type]: [ids] },
  history:         [ { type: 'unlocked'|'hidden'|'revealed'|'enable'|..., ruleId, targetType, targetId, timestamp } ],
  notifications:  [ notification ]
}
```

Maps every field the spec's Save System section names — unlocked
entities, hidden entities, reveal history, unlock history, and
notification history — without inventing a duplicate representation of
anything: "reveal history" and "unlock history" are both just `history`
entries filtered by `type`, the same normalization principle every
engine's save format in this project has used since Mission 16.

### 15.6 Application integration

The spec's own diagram — *"Applications → ApplicationContext →
UnlockManager → Visible Content"* — is implemented literally:
`ApplicationContext.isUnlocked(type, id)` and
`ApplicationContext.getVisibleIds(type, allIds)` are thin delegates to
`UnlockManager`; no application imports `UnlockManager` directly.

Six applications were wired to actually filter through it this pass —
every one the spec named by name (Evidence Database, Messenger, Police
Mail) plus three more whose case-001 content this mission's own
`unlocks.json` gates (Criminal Database, CCTV, Forensics Lab). The
pattern is identical in all six: fetch the full list from the app's own
domain manager exactly as before, then `context.getVisibleIds(type, ids)`
before rendering, and listen for `content:unlocked`/`content:hidden` to
re-render live. City Map and Investigation Board were **not** wired this
pass — case-001's `unlocks.json` doesn't gate any `location` or
`boardTemplate`/`theory` entities, so there was nothing to demonstrate,
and wiring a filter with zero live rules to exercise it would be
unverifiable. `UnlockManager` already supports both target types
generically; adding the two remaining apps' filter call is the same
one-line pattern as the six already done, whenever a future case's
`unlocks.json` needs it.

### 15.7 Debug mode

`UnlockManager.debug()` — call from the browser console — prints every
rule (target, type, resolved, satisfied count) as a table, plus pending
rules, currently unlocked entities by type, and the last trigger that
changed anything. Same console-method pattern as `ObjectiveManager.
debug()` and `StateMachineManager.debug()` — no global variables, per
`CODING_STYLE.md`.

### 15.8 How Mission 20 (Tutorial Case) will use this

Mission 20 is explicitly out of scope here, but per its own spec line,
its job is to demonstrate every major mechanic Missions 15–19
introduced — which means it needs all four engines built so far
(Objectives, Resolution, State Machine, Unlock) working together in one
compact, teachable case, not a fifth new system:

- A tutorial case's `unlocks.json` is the natural place to make the
  *first* things a new player sees feel deliberately staged — a locked
  "advanced" application or a hidden evidence item that unlocks after
  the tutorial's first objective, mirroring case-001's
  `unlock-camera` rule (itself copied verbatim from the spec's own
  example) but pared down to the single clearest example rather than
  case-001's six.
- Because gating is entirely data-driven and default-open, a tutorial
  case can gate as little or as much as it needs to teach the concept
  without touching any engine code — exactly the "no investigation
  should require custom JavaScript" requirement this mission's own spec
  insists on, now provable by whatever Mission 20 builds.
- `UnlockManager.debug()`, alongside `ObjectiveManager.debug()` and
  `StateMachineManager.debug()`, gives Mission 20 (or whoever plays it
  first) a ready-made way to verify the tutorial's rules actually fired
  as designed, without building any new debugging tool.

