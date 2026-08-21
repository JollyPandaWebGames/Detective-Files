# Case 00 Tutorial QA — Map Search & Deadlock Prevention

Version: 1.0

## Method

This project has no headless-browser or end-to-end test harness (no
Playwright/Puppeteer/Cypress config exists in the repo, and this
environment's outbound network is restricted to package registries, not
a browser to run against a live build). Every row below is therefore
**static verification**: tracing the actual `data/tutorial/case-00-dialogue.json`
node graph against the real EventBus events, objective definitions, and
DOM selectors the shipped code produces, rather than a live click-through.
Where that distinction matters, "Actual Behavior" says so explicitly.
Nothing below is reported as "should work" — every row is either traced
to a concrete, checked fact, or listed under Remaining Issues as
unverified.

Two automated checks were run directly against the data:

- Every `next` pointer in all 69 dialogue nodes was traversed from
  `t00-001` to completion: **no broken links, no cycles, no unreachable
  nodes.**
- Every `requiredAction.event` referenced by an instruction node
  (`app:opened`, `case:card-selected`, `forensics:requested`,
  `investigationStarted`, `map:search-performed`, `objective:completed`)
  was grepped against the codebase: **all six are genuinely emitted**
  by real application code, not just referenced by the tutorial JSON
  (this is the specific failure mode Part 10 of the task warns about —
  a node waiting on an event nothing ever fires).
- Every `objective:completed` node's `objectiveId` (T00-03 through
  T00-13, minus T00-09 which has no tutorial gate) was checked against
  `data/cases/case-00/objectives/*.json`: **all exist.**
- Every `highlightTarget` CSS selector referenced by an instruction node
  was checked against the class names actually rendered by the
  corresponding app's `index.js`: **all resolve**, including the two new
  ones added for map search (`.citymap__search-input`,
  `.citymap__search-results`).

## Root Cause Found

The Bookstore marker was not merely hard-to-find — it **never rendered
on the City Map canvas at all**, under any pan/zoom/filter combination.
`CityMap._activeFilters` was seeded from `Object.keys(MARKER_TYPES)`
only, and both the render loop and the click hit-test loop skipped any
location whose `type` wasn't in that set. The Bookstore's type is
`"Incident Location"` and the Pawn Shop's is `"Secondary Location"` —
neither is a key in `MARKER_TYPES` — so both were silently filtered out
with no checkbox in the UI that could ever re-enable them. This is the
actual mechanism behind "Bookstore is not visible / easily discoverable
on the map" and would have kept blocking `T00-06` (`locationVisited:
loc-00-2`) even after adding search, since a player who panned to the
correct coordinates by hand still would never have seen a marker there
to click. Fixed in `apps/city-map/index.js` — a location's type can now
only be hidden by a filter checkbox if it actually has one.

## Test Table

| Test ID | Tutorial State | Expected Behavior | Actual Behavior | Status | Notes |
|---|---|---|---|---|---|
| C00-QA-001 | Tutorial Start | `investigationStarted` for case-00 (or first `workstation:ready` with case-00 unlocked/untouched) triggers `TutorialManager.start()`, always from node `t00-001`. | Confirmed in `TutorialManager.initialize()` — both listeners call `start()`, which always begins at `this._data.nodes[0].id`. No dependency on Part 3's changes. | Pass (static) | Unrelated to this task's scope; unchanged. |
| C00-QA-002 | Dialogue (Lessons 1–3) | Nodes t00-001…t00-012 render as dialogue with Continue/Skip; `t00-013` is the first instruction. | Traced — chain intact, no dead ends. | Pass (static) | |
| C00-QA-003 | Case Management | `t00-013` highlights `[data-app-id="case-management"]` on desktop scope, waits for `app:opened{appId:'case-management'}`; `t00-017` waits for `case:card-selected`. | Both events confirmed emitted by `ApplicationManager.js` / `apps/case-management/index.js`. `_isAlreadySatisfied` also short-circuits `app:opened` for case-management the moment an investigation is already active, and `case:card-selected`/`investigationStarted` the same way — covers a replay where the player is dropped back in mid-flow. | Pass (static) | |
| C00-QA-004 | Start Case | `t00-019` highlights the start button, waits for `investigationStarted`. | Event confirmed emitted twice in `ActiveInvestigationManager.js` (two code paths, same event/shape). | Pass (static) | |
| C00-QA-005 | Active Investigation | t00-020…023 dialogue only, no gameplay dependency. | N/A — pure dialogue. | Pass (static) | |
| C00-QA-006 | Police Mail | Open app, select the assignment mail (`.mail__list-item`), open its attachment (`.mail__attachment-chip`), both gated on `objective:completed`. | Selectors confirmed present in `apps/police-mail/index.js`/`style.css`. Objective ids T00-03/T00-04 exist. | Pass (static) | |
| C00-QA-007 | Evidence | Open app (`t00-031`), inspect+note the evidence item (`t00-033`, `.ev`, `objective:completed` T00-05). | Selector and objective confirmed. | Pass (static) | |
| C00-QA-008 | City Map | Open app (`t00-036`). | Unchanged from before this task; confirmed event/selector. | Pass (static) | |
| C00-QA-009 | Map Search | New: `t00-037` highlights `.citymap__search-input`, waits for `map:search-performed` with `resultIds` containing `loc-00-2`. | `CityMap._handleSearchInput()` now emits `map:search-performed` on every live-typed or Enter-triggered search with `{caseId, query, resultIds}`; `TutorialManager._matchesPayload` has a new `containsLocationId` case that checks `resultIds.includes(...)`. Bookstore's `keywords` (`bookstore`, `book store`, `books`, `ellery`, `finch`) and `MapManager.search()`'s new keyword check mean typing "Bookstore" (or "book", "ellery", etc.) genuinely returns it. | Pass (static) | Query match is deliberately not exact-string ("did the player literally type Bookstore") to avoid punishing case/whitespace variance — it's satisfied by the *result set* containing the right location, same philosophy as every other objective-gated step in this file. |
| C00-QA-010 | Bookstore | `t00-037b` highlights `.citymap__search-results`, waits for `objective:completed` T00-06 (`locationVisited: loc-00-2`, unchanged condition). Selecting a result calls `_focusLocation()`, which selects + centers + emits `map:location-selected`. | Confirmed the full chain: click → `_selectSearchResult` → `_focusLocation` → `_selectLocation` (emits `map:location-selected{location}`) → `ConditionMatcher.locationVisited` → `ObjectiveManager` marks T00-06 complete → emits `objective:completed{objective:{id:'T00-06',...}}` → tutorial advances. Also fixed the root-cause render/hit-test bug (see above) so the marker is clickable directly on the canvas too, not only via search. | Pass (static) | This objective completes identically whether the player clicks the canvas marker directly or the search result — search is a discovery aid, not a new completion path, so no regression risk to a player who happens to spot the marker without searching. |
| C00-QA-011 | Messenger | t00-039…042, unchanged. | Selector/event confirmed. | Pass (static) | |
| C00-QA-012 | CCTV | t00-043…046, unchanged. | Selector/event confirmed. | Pass (static) | |
| C00-QA-013 | Forensics | t00-047…050, unchanged. `forensics:requested` confirmed emitted by `ForensicsManager.js`. | Confirmed. | Pass (static) | |
| C00-QA-014 | Criminal Database | t00-051…054, unchanged. | Confirmed. | Pass (static) | |
| C00-QA-015 | Investigation Board | t00-055…060, unchanged. | Confirmed. | Pass (static) | |
| C00-QA-016 | Case Resolution | t00-061…067, ends the chain (`t00-067.next` is `null` → `_finish()`). | Confirmed traversal reaches `t00-067` with `next: null`, `_finish()` unlocks and emits `tutorial:completed`. | Pass (static) | |
| C00-QA-017 | Tutorial Completion | `_finish()` sets state `COMPLETED`, unlocks world, hides dialog/highlight. | Confirmed in code. | Pass (static) | |
| C00-QA-018 | Tutorial Replay | Starting Case 00 again resets objectives/board/state-machine/tooltips/evidence per-case (per `docs/missions/case-00/design.md`'s `resetForCase` contract) and `TutorialManager.start()` always begins at node 1 regardless of any prior run. | Confirmed `ObjectiveManager.resetForCase()` exists and is documented as part of the case-management "replay" flow; `TutorialManager.start()` has no persisted-progress read path (see next row). | Pass (static) | Not independently re-verified beyond confirming the contract exists — this predates this task and wasn't in scope to re-audit end-to-end. |
| C00-QA-019 | Tutorial Resume | Task spec (Part 16) asks for a "Continue Training?" prompt after an interrupted session. | **Not implemented — and not attempted.** `TutorialManager`'s own class doc (v2.0.4) documents that a prior resume implementation was removed after two separate reload-related bugs (see `docs/TUTORIAL_SYSTEM.md §7`), and states every tutorial start is a fresh run by product decision. `ActiveInvestigationManager` never re-affirms Case 00 as active across a reload, and Case Management never offers "Continue Investigation" for it. Implementing Part 16 as specified would mean reversing a documented, deliberate architecture decision made after real bugs — that's a product call, not something to silently override while fixing an unrelated map-search bug. | **Conflict — flagged, not fixed** | See "Known Spec Conflict" below. |
| C00-QA-020 | Mobile Landscape | Search UI must remain usable at landscape widths. | City Map's responsive CSS has a tablet breakpoint (640–1023px, 150px sidebar) and a phone breakpoint (≤639px, sidebar hidden entirely). Search input/results/clear button were added inside the existing sidebar container and inherit both breakpoints — no new fixed widths introduced. Typical phone landscape widths (~667px–926px) land in the tablet breakpoint, where the sidebar (and search) stays visible. The ≤639px breakpoint (which hides the sidebar, and would hide search with it) is documented elsewhere as reachable only in portrait, which the game's orientation-lock screen blocks. | Pass (static), **not visually verified** | No real device/emulator was used — this is a CSS-rule read, not a rendered screenshot. Flagged as a gap below. |
| C00-QA-021 | Window Close/Reopen | If City Map is closed after `t00-036` and reopened, the instruction must recover. | `TutorialHighlight._resolveTarget` re-queries every animation frame and keeps retrying (8s timeout) if the target vanishes; the new "Need Help?" button also force-recalls `_showInstructionNode()`, which re-issues `TutorialHighlight.show()` from scratch. `map:search-performed`/`objective:completed` listeners are bound for the tutorial's lifetime, not per-window-instance, so a fresh search after reopening still satisfies the same node. | Pass (static) | |
| C00-QA-022 | Application Already Open | Reopening a singleton app (`city-map.singleton: true` in `app.json`) doesn't re-emit `app:opened`. | `TutorialManager._isAlreadySatisfied` explicitly handles `app:opened` by checking `ApplicationManager.isRunning(appId)` instead of waiting for a fresh event — this is pre-existing, unmodified code, and applies unchanged to `t00-036`. | Pass (static) | |
| C00-QA-023 | Application Minimized | City Map minimized mid-search must not block. | `CityMap.minimize()` only calls `_saveViewState()`; it doesn't tear down `_searchResultsEl`/`_searchInputEl` or their listeners. `restore()` re-renders the canvas but doesn't clear search state. | Pass (static) | |
| C00-QA-024 | Tutorial Help | New: every instruction node now shows a "Need Help?" button. | `TutorialDialog.showInstruction()` renders it when an `onHint` handler is passed; `TutorialManager._showInstructionNode()` always passes one. Clicking it shows a one-line mentor explanation (from the node's new `hint` field, added for every instruction node in Part 6's Bookstore sequence; falls back to the instruction text for older nodes without one) with a Continue button that returns to the same instruction and **re-issues** the highlight — it never calls `_advance()`, so it cannot auto-complete the objective (Part 12's explicit requirement). | Pass (static) | Only the three new/rewritten Bookstore-lesson nodes (`t00-036`, `t00-037`, `t00-037b`) have hand-written `hint` text; the other 18 pre-existing instruction nodes get the generic fallback (their own instruction text repeated). Adding tailored hints to all of them was out of scope for this pass — see Remaining Issues. |
| C00-QA-025 | Deadlock Recovery | Player must never be permanently stuck with no way forward on an instruction node. | Previously: instruction banners had **no Skip control at all** — only dialogue nodes did. If a required event never fired and the highlight target never resolved, the player had zero interactive path forward. Fixed generically (not just for Bookstore): `TutorialDialog.showInstruction()` now always renders a "Skip Tutorial" control alongside "Need Help?" on every instruction node, wired to the existing `_skip()` path. | Pass (static) | This was a latent deadlock risk across **all** 21 instruction nodes, not only the Bookstore one — flagged and fixed as part of this task since Part 9/11 explicitly call for auditing every tutorial state for this failure mode. |

## Known Spec Conflict

Part 16 of the task ("Save / Resume Test") asks for a "Continue
Training?" / "Restart Tutorial" prompt after an interrupted session.
`managers/TutorialManager.js`'s own docstring (v2.0.4) documents that
this exact feature existed before, was buggy in two different ways
across two versions, and was **deliberately removed** in favor of
"every start is the one and only run that exists." Re-implementing it
here would mean quietly reversing a documented product decision inside
a task scoped to map search — that's not this task's call to make
unilaterally. Recommendation: raise Part 16 as its own follow-up with
the person who made the v2.0.4 decision, rather than resolving it as a
side effect of this fix.

## Remaining Issues

1. **No live/visual verification.** Everything above is a code-level
   trace (event emission, selector existence, node-graph traversal,
   objective-id existence), not a rendered click-through in a browser —
   this environment has no browser or test runner available. The most
   valuable next step is a real manual playthrough (or standing up
   Playwright against a dev server) to catch anything a static read
   can't, e.g. actual visual overlap of the search dropdown with the
   canvas, real touch-event behavior on an actual phone, or timing
   issues in the highlight retry loop.
2. **Filter list has no checkbox for `Incident Location` /
   `Secondary Location`.** The root-cause fix (Part above) makes both
   types un-hideable, which is correct today, but the filter UI itself
   still only reflects `MARKER_TYPES`' seven categories. If a future
   case adds a type meant to be *togglable*, it'll need a real entry in
   `MARKER_TYPES`/the filter list, not just the "never hidden" fallback
   this fix relies on.
3. **Hint text is only written for the three Bookstore-lesson
   instruction nodes.** The other 18 instruction nodes' "Need Help?"
   button falls back to repeating the instruction text verbatim, which
   is safe but not very useful. Worth a follow-up pass to write a real
   `hint` line for each.
4. **Save/Resume (Part 16)** — see "Known Spec Conflict" above;
   intentionally not implemented.
5. **Mobile landscape** — CSS was reasoned about, not rendered; see
   C00-QA-020.
