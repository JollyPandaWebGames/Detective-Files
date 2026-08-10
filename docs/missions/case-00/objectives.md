# Objectives — Tutorial Investigation
## Detective Files — Case 00

Version: 1.0

Case 00 is fully linear: every objective depends on exactly the one
before it. No hidden or optional objectives — a first-ever tutorial
should never ask the player to make a sequencing choice.

Each objective below documents: id, title, description, tutorialMessage,
application, trigger, completion condition, unlocks, nextObjective.

---

### T00-01 — Start Investigation
- **Description:** Start Case 00 from Case Management.
- **tutorialMessage:** "Welcome, Detective. This is your first
  investigation. Start the case to begin."
- **Application:** Case Management
- **Trigger:** N/A — see implementation note below.
- **Completion condition:** N/A.
- **Unlocks:** T00-03 (see note)
- **nextObjective:** T00-03

> **Implementation note:** T00-01 is not implemented as a gated
> objective JSON file. The Objective Engine only begins evaluating
> conditions once a case is already loaded — by definition, "start the
> investigation" can't be a condition the engine gates, since nothing is
> loaded yet for it to gate. This message is instead carried by
> `case-00.json`'s own `description` field, which Case Management
> already renders for every case (no new mechanism needed). See
> `implementation.md` for the full reasoning.

### T00-02 — Open Active Investigation
- **Description:** Notice the Active Investigation widget.
- **tutorialMessage:** "This is your Active Investigation. Every CID OS
  application will now use this investigation. You can minimize this
  panel, but it cannot be closed while an investigation is active."
- **Application:** Active Investigation widget
- **Trigger:** N/A — see implementation note below.
- **Completion condition:** N/A.
- **Unlocks:** T00-03
- **nextObjective:** T00-03

> **Implementation note:** Same reasoning as T00-01 — there's no
> discrete player action to gate here (the widget simply appears once an
> investigation is active; it isn't an app the player "opens"). This
> message is folded into the front of T00-03's own `description` field
> instead of existing as a separate blocking objective.

### T00-03 — Read Police Mail
- **Description:** Open Police Mail and read the incident report.
- **tutorialMessage:** "This is your Active Investigation. Every CID OS
  application will now use this investigation. You can minimize this
  panel, but it cannot be closed while an investigation is active. —
  Your first lead has arrived. Open Police Mail." → then "Read the
  investigation report."
- **Application:** Police Mail
- **Trigger:** `emailRead` (target: the case brief mail item)
- **Completion condition:** Mail marked read.
- **Unlocks:** T00-04
- **nextObjective:** T00-04

### T00-04 — Open Attachment
- **Description:** Open the attached document.
- **tutorialMessage:** "Open the attached document."
- **Application:** Police Mail
- **Trigger:** `attachmentOpened` (target: `att-00-1`)
- **Completion condition:** Attachment viewed.
- **Unlocks:** T00-05
- **nextObjective:** T00-05

### T00-05 — Inspect Evidence
- **Description:** Open Evidence Database, inspect the broken display
  case, and add a detective note.
- **tutorialMessage:** "Your report mentions physical evidence. Open
  Evidence Database." → "Inspect the evidence." → "Add a detective
  note."
- **Application:** Evidence Database
- **Trigger:** `evidenceViewed` (target: `ev-00-2`) + `evidenceNoted`
  (target: `ev-00-2`)
- **Completion condition:** Both fire for the display-case evidence item.
- **Unlocks:** T00-06
- **nextObjective:** T00-06

### T00-06 — Inspect City Map
- **Description:** Open City Map and inspect Ellery & Finch Books.
- **tutorialMessage:** "The report contains a location. Open City Map
  and inspect the location."
- **Application:** City Map
- **Trigger:** `locationVisited`
- **Completion condition:** Location detail opened.
- **Unlocks:** T00-07
- **nextObjective:** T00-07

### T00-07 — Read Messenger
- **Description:** Open Messenger and review Priya Shah's account.
- **tutorialMessage:** "A witness has information. Open Messenger and
  review the conversation."
- **Application:** Messenger
- **Trigger:** `messageRead`
- **Completion condition:** Conversation opened and read; unlocks the
  pawn receipt evidence item.
- **Unlocks:** T00-08
- **nextObjective:** T00-08

### T00-08 — Review CCTV
- **Description:** Open CCTV Viewer, find the important moment, and
  bookmark it.
- **tutorialMessage:** "The witness mentioned a suspicious time. Check
  the CCTV footage." → "Find the important moment." → "Bookmark the
  timestamp."
- **Application:** CCTV Viewer
- **Trigger:** `cameraViewed` (target: `camera-00-1`) + `timestampBookmarked`
  (target: `camera-00-1`)
- **Completion condition:** Both fire for the case's one camera.
- **Unlocks:** T00-09
- **nextObjective:** T00-09

### T00-09 — Complete Forensics
- **Description:** Submit the pawn receipt for analysis.
- **tutorialMessage:** "One piece of evidence requires laboratory
  analysis." → open Forensics, start the analysis.
- **Application:** Forensics Lab
- **Trigger:** `analysisRequested` → `analysisCollected`
- **Completion condition:** Report collected. Case 00 uses a short fixed
  duration (see `implementation.md`) rather than a long real-time wait,
  per the brief's explicit instruction not to require one.
- **Unlocks:** T00-10
- **nextObjective:** T00-10

### T00-10 — Search Criminal Database
- **Description:** Look up Callum Voss.
- **tutorialMessage:** "The new evidence gives us a name. Search the
  Criminal Database."
- **Application:** Criminal Database
- **Trigger:** `personProfileOpened`
- **Completion condition:** Profile opened (gated open only after
  T00-09 completes — see `unlocks.json`).
- **Unlocks:** T00-11
- **nextObjective:** T00-11

### T00-11 — Build Investigation Board
- **Description:** Connect evidence → person → location, and form a
  theory.
- **tutorialMessage:** "You have gathered enough information. Now
  connect the clues."
- **Application:** Investigation Board
- **Trigger:** `boardConnectionCreated` + `theoryCreated`
- **Completion condition:** At least one connection and one theory
  card exist.
- **Unlocks:** T00-12
- **nextObjective:** T00-12

### T00-12 — Solve Investigation
- **Description:** Submit the resolution.
- **tutorialMessage:** "You have enough evidence. Review your
  investigation and submit your conclusion."
- **Application:** Investigation Board (Resolution Wizard)
- **Trigger:** `investigationSolved` — `ResolutionManager` already only
  emits its underlying event (`investigation:completed`) on a correct
  submission; an incorrect or incomplete one never fires it, so this
  objective genuinely can't complete on a wrong answer.
- **Completion condition:** `ResolutionManager` confirms a correct
  submission against `solution.json`.
- **Unlocks:** T00-13
- **nextObjective:** T00-13

### T00-13 — Complete Tutorial
- **Description:** Return to Case Management to see the case marked
  solved.
- **tutorialMessage:** "Investigation Complete. You solved your first
  investigation. You can replay Case 00 at any time to practice the
  investigation workflow."
- **Application:** Case Management
- **Trigger:** `applicationOpened` (target: `case-management`)
- **Completion condition:** Case Management reopened after T00-12
  completes — a natural, real "close the loop" action, and the
  Active Investigation widget already shows this objective's
  description (the completion message above) the moment it becomes
  current, satisfying "wait for the player, then show the message"
  without needing any new delivery mechanism.
- **Unlocks:** nothing further.
- **nextObjective:** none
