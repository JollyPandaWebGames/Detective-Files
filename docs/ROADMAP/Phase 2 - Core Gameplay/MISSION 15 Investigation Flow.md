You are continuing development of Detective Files.

The game's operating system is called CID OS.

Before implementing anything, read and strictly follow:

\- ARCHITECTURE_2.md

\- ARCHITECTURE.md

\- PROJECT_SPEC.md

\- ROADMAP.md

\- UI_GUIDELINES.md

\- CODING_STYLE.md

\- APP_SDK.md

\- CASE_FORMAT.md

These documents are the project's single source of truth.

Only implement Mission 15.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 15

Investigation Flow

--------------------------------------------------

GOAL

Implement the core investigation lifecycle.

An investigation is no longer just a collection of data.

It is now a living process with objectives, progression, locked content,
completed tasks, and case states.

This mission introduces the Investigation Flow Engine.

No rewards, XP, profile system, achievements or daily cases.

--------------------------------------------------

CORE IDEA

--------------------------------------------------

Every investigation progresses through Objectives.

Objectives unlock new information.

New information unlocks more objectives.

Eventually the detective reaches the final conclusion.

--------------------------------------------------

INVESTIGATION STATES

--------------------------------------------------

Support:

Not Started

Active

Paused

Completed

Archived

Failed (future use)

Only one investigation may be Active.

--------------------------------------------------

OBJECTIVE MODEL

--------------------------------------------------

Each investigation contains objectives.

Example:

Read First Email

↓

Open Evidence Database

↓

Inspect Knife

↓

Watch CCTV Camera 03

↓

Interview Witness

↓

Request DNA Analysis

↓

Review DNA Report

↓

Build Theory

↓

Solve Investigation

--------------------------------------------------

DATA STRUCTURE

--------------------------------------------------

Create:

/data/cases/{caseId}/objectives.json

Example:

{

"id":"obj-read-email",

"title":"Read the Assignment",

"description":"Read the official assignment email from Headquarters.",

"type":"mail",

"target":"mail-001",

"state":"Locked",

"optional":false,

"hidden":false,

"dependencies":\[\],

"unlocks":\[

"obj-open-evidence"

\]

}

--------------------------------------------------

OBJECTIVE STATES

--------------------------------------------------

Support:

Locked

Available

Active

Completed

Skipped

Hidden

--------------------------------------------------

OBJECTIVE TYPES

--------------------------------------------------

Support:

Open Application

Read Email

Read Message

Inspect Evidence

Watch CCTV

Visit Location

Request Analysis

Collect Report

Read Person Profile

Create Board Connection

Create Theory

Solve Investigation

Custom

--------------------------------------------------

OBJECTIVE ENGINE

--------------------------------------------------

Create:

ObjectiveManager

Responsibilities:

Load objectives

Track progress

Unlock objectives

Complete objectives

Save progress

Emit events

--------------------------------------------------

AUTO COMPLETION

--------------------------------------------------

Objectives complete automatically.

Examples:

Opening Police Mail

↓

Completes

Read Email

Watching Camera 03

↓

Completes

Watch CCTV

Opening Evidence EV-004

↓

Completes

Inspect Evidence

--------------------------------------------------

OBJECTIVE PANEL

--------------------------------------------------

Update the Active Investigation Widget.

Display:

Current Objective

Progress

Completed Objectives

Remaining Objectives

Current Phase

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Every application emits events.

Examples:

mail:opened

mail:read

evidence:viewed

camera:watched

message:opened

person:viewed

analysis:requested

analysis:collected

board:theory-created

The ObjectiveManager listens to these events.

--------------------------------------------------

LOCKED CONTENT

--------------------------------------------------

Applications should automatically hide unavailable content.

Example:

Witness Conversation

↓

Locked

Until:

Read CCTV Report

Locations

↓

Locked

Until:

Read Assignment

Evidence

↓

Locked

Until:

Open Evidence Database

The player should never see content before it becomes available.

--------------------------------------------------

CASE PHASES

--------------------------------------------------

Support investigation phases.

Example:

Phase 1

Assignment

↓

Phase 2

Crime Scene

↓

Phase 3

Witnesses

↓

Phase 4

Laboratory

↓

Phase 5

Theory

↓

Phase 6

Resolution

Applications may display the current phase.

--------------------------------------------------

EVENTS

--------------------------------------------------

ObjectiveManager emits:

objective:unlocked

objective:completed

objective:updated

phase:changed

investigation:progress

Applications continue using ApplicationContext.

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Completed objectives

Current phase

Current objective

Unlocked content

Investigation progress

--------------------------------------------------

PROGRESS

--------------------------------------------------

Calculate investigation completion.

Example:

Objectives:

20

Completed:

8

Progress:

40%

Update the Active Investigation Widget immediately.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Tablet

Phone

Objective display must remain readable.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

XP

Rewards

Achievements

Daily cases

Profile

Ranking

Statistics

Case validation

Multiple endings

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 15:

The game now supports a complete investigation flow.

Every investigation has:

Objectives

Phases

Progress

Locked content

Automatic objective completion

Automatic unlocking

Persistent progression

Every CID OS application reacts to investigation progress.

Explain:

\- Objective architecture

\- ObjectiveManager

\- Unlock workflow

\- Event flow

\- Save structure

\- How Mission 16 (Objective Engine) expands this system with dependency
graphs, branching objectives, and conditional logic.

Do not continue to Mission 16.
