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


```
core/
    ApplicationContext.js          NEW
    BaseApp.js                     MODIFIED — context injection + onX() hooks
    Workstation.js                 MODIFIED — new boot steps 1c, 7d, 7l, 8b, 9b
managers/
    SessionManager.js               NEW
    ActiveInvestigationManager.js   NEW
    InvestigationWidgetManager.js   NEW
    ApplicationManager.js           MODIFIED — session tracking + onX() hook calls
    CaseManager.js                  MODIFIED — added completeCase(), archiveCase()
apps/
    case-management/index.js        MODIFIED — see §7
css/
    widgets/investigation-widget.css NEW
docs/
    ARCHITECTURE_2.md                NEW (this file)
```
