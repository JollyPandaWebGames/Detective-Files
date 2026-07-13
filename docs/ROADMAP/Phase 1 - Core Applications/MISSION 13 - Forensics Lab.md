You are continuing development of Detective Files.

The game's operating system is called CID OS.

Before implementing anything, read and strictly follow:

\- ARCHITECTURE.md

\- PROJECT_SPEC.md

\- ROADMAP.md

\- UI_GUIDELINES.md

\- CODING_STYLE.md

\- APP_SDK.md

\- CASE_FORMAT.md

These documents are the project's single source of truth.

Only implement Mission 13.

Do not continue to future missions.

--------------------------------------------------

MISSION 13

Forensics Lab

--------------------------------------------------

Goal

Replace the placeholder Forensics Lab application with a laboratory
analysis system.

The laboratory allows detectives to submit evidence for scientific
analysis and receive reports after a configurable amount of time.

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Forensics Lab application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Split the application into three sections.

LEFT SIDEBAR

Analysis Queue

\- Pending

\- In Progress

\- Completed

CENTER PANEL

Selected Analysis

RIGHT PANEL

Evidence Information

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

Only display evidence belonging to the currently selected case.

Listen for:

case:selected

--------------------------------------------------

SUPPORTED ANALYSES

--------------------------------------------------

DNA Analysis

Fingerprint Analysis

Blood Analysis

Toxicology

Ballistics

Fiber Analysis

Document Examination

Digital Device Analysis

Each evidence item specifies which analyses are available.

--------------------------------------------------

DATA STRUCTURE

--------------------------------------------------

Load definitions from:

/data/cases/{caseId}/forensics/

Example:

analysis-001.json

{

"id":"analysis-001",

"evidenceId":"ev-004",

"type":"Fingerprint",

"duration":300,

"result":"result-001.json",

"status":"Available"

}

--------------------------------------------------

REQUEST ANALYSIS

--------------------------------------------------

The player can submit supported analyses.

Once submitted:

\- Status becomes Pending

\- Countdown begins

\- Request is saved locally

--------------------------------------------------

ANALYSIS TIMER

--------------------------------------------------

Support configurable durations.

Examples:

Fingerprint

30 seconds

DNA

5 minutes

Ballistics

2 minutes

Toxicology

3 minutes

The timer should continue even if the application is closed.

Use timestamps instead of active countdown loops.

--------------------------------------------------

QUEUE

--------------------------------------------------

Display:

Analysis Type

Evidence

Remaining Time

Status

Progress Indicator

Support sorting.

--------------------------------------------------

RESULTS

--------------------------------------------------

When analysis completes:

Status changes to Completed.

Display:

Summary

Full Report

Confidence

Detected Matches

Recommendations

--------------------------------------------------

RESULT FILE

--------------------------------------------------

Example:

{

"id":"result-001",

"summary":"Fingerprint matches suspect John Carter.",

"confidence":98,

"details":"Fingerprint comparison completed successfully.",

"newEvidence":\[

"ev-018"

\],

"relatedPeople":\[

"person-005"

\]

}

--------------------------------------------------

COLLECT RESULTS

--------------------------------------------------

Player must manually collect completed reports.

Collecting a report:

\- Marks it as reviewed

\- Creates any new evidence

\- Unlocks any related people

\- Emits completion events

--------------------------------------------------

SEARCH

--------------------------------------------------

Search analyses by:

Evidence

Analysis Type

Status

--------------------------------------------------

PLAYER NOTES

--------------------------------------------------

Each analysis supports detective notes.

Autosave locally.

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

forensics:requested

forensics:completed

forensics:collected

forensics:note-updated

Listen:

case:selected

evidence:selected

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

Pending analyses

Completion timestamps

Collected reports

Notes

Example:

{

"analysis-001":{

"requestedAt":1740500000,

"completed":false,

"collected":false,

"notes":"Need DNA confirmation."

}

}

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Evidence Database

Evidence can be submitted directly.

Completed analyses update evidence information.

--------------------------------------------------

Police Mail

When an analysis finishes:

Generate a new HQ email informing the detective.

The email links directly to the completed report.

--------------------------------------------------

Messenger

Future conversations may unlock after collecting reports.

--------------------------------------------------

Criminal Database

Completed reports may update suspect profiles.

--------------------------------------------------

Investigation Board

Completed reports become available as new evidence nodes.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-column layout.

Tablet

Collapsible sidebar.

Phone

Queue

↓

Analysis

↓

Evidence

Touch-friendly controls.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Dark CID OS appearance.

Pixel borders.

Laboratory-inspired icons.

Consistent spacing.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Real scientific algorithms

Automatic case solving

Online processing

Background server jobs

Networking

Backend

Authentication

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 13:

The player can:

\- Submit evidence for analysis

\- View active laboratory queue

\- Wait for timed completion

\- Collect completed reports

\- Unlock new evidence from reports

\- Generate HQ notification emails

\- Add detective notes

\- Persist laboratory progress across sessions

The Forensics Lab should introduce delayed progression and become the
scientific analysis hub of every investigation.

Explain:

\- Analysis queue architecture

\- Timer implementation

\- Result generation workflow

\- Local storage format

\- Event flow

\- How Mission 14 (Investigation Board) will consume forensic reports as
evidence nodes

Do not continue to Mission 14.
