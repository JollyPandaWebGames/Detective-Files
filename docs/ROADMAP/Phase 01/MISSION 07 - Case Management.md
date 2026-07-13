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

Only implement Mission 05.

Do not continue to future missions.

--------------------------------------------------

MISSION 07

Case Management

--------------------------------------------------

Goal

Replace the placeholder Case Management application with the first real
detective application.

This application is the central hub of Detective Files.

Every investigation begins here.

No backend.

Everything is loaded from local JSON files.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Case Management application.

The application must extend BaseApp.

The application opens inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Split the window into three areas.

Left Sidebar

Displays folders:

• Active Cases

• Solved Cases

• Archived

Center Panel

Displays the selected case list.

Right Panel

Displays details of the selected case.

--------------------------------------------------

CASE DATA

--------------------------------------------------

Load cases from:

/data/cases/

Each case contains:

case.json

Example:

{

"id":"case-001",

"title":"The Missing Necklace",

"difficulty":"Easy",

"status":"Unlocked",

"description":"A valuable necklace disappeared during a charity event.",

"thumbnail":"thumbnail.png",

"estimatedTime":"20 minutes",

"reward":100

}

--------------------------------------------------

CASE LIST

--------------------------------------------------

Display:

Thumbnail

Title

Difficulty

Status

Estimated Time

Reward

Support scrolling.

--------------------------------------------------

CASE DETAILS

--------------------------------------------------

When a case is selected display:

Title

Difficulty

Description

Estimated Time

Reward

Current Progress

Objectives

--------------------------------------------------

OBJECTIVES

--------------------------------------------------

Example

□ Read initial report

□ Review CCTV

□ Interview witness

□ Inspect evidence

Objectives are read-only for now.

--------------------------------------------------

START BUTTON

--------------------------------------------------

Each unlocked case has:

Start Investigation

Clicking the button should:

\- Mark the case as "In Progress"

\- Save progress locally

\- Emit an event:

case:started

No gameplay yet.

--------------------------------------------------

PROGRESS

--------------------------------------------------

Create local save data.

Example:

{

"case-001":{

"status":"In Progress",

"progress":15

}

}

Use StorageManager.

--------------------------------------------------

CASE FILTERS

--------------------------------------------------

Support filtering by:

Difficulty

Status

Search by title

--------------------------------------------------

LOCKED CASES

--------------------------------------------------

Locked cases:

Display a lock icon.

Cannot be started.

Show:

"Complete previous investigations to unlock."

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-column layout.

Tablet

Collapsible sidebar.

Phone

Single-column layout with bottom navigation.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Maintain CID OS appearance.

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Events:

case:selected

case:started

case:loaded

case:progress

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Evidence

Mail

Messenger

CCTV

Map

Investigation Board

Gameplay

Puzzle solving

Achievements

Backend

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 05:

The player can:

\- Browse available cases

\- View case information

\- Search and filter cases

\- Start an investigation

\- Save progress locally

\- Reopen CID OS and keep progress

The Case Management application becomes the central hub of Detective
Files.

Explain:

\- File structure

\- Save format

\- Event flow

\- How Mission 06 (Police Mail) will integrate with the selected case

Do not continue to Mission 06.
