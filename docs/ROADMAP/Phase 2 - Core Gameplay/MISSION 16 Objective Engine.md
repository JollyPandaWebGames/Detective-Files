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

Only implement Mission 16.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 16

Objective Engine

--------------------------------------------------

GOAL

Upgrade the ObjectiveManager into a fully data-driven Objective Engine.

Investigation progression must now be entirely controlled by JSON
configuration.

Designers should be able to build complete investigations without
writing JavaScript.

--------------------------------------------------

CORE IDEA

--------------------------------------------------

Objectives are now connected as a graph rather than a linear list.

An objective may unlock:

\- One objective

\- Multiple objectives

\- Optional objectives

\- Hidden objectives

\- Entire investigation phases

--------------------------------------------------

OBJECTIVE GRAPH

--------------------------------------------------

Support branching progression.

Example

Read Assignment

├── Open Evidence Database

│

├── Read Witness Email

│

└── Visit Crime Scene

The player may complete these in any order.

--------------------------------------------------

DEPENDENCIES

--------------------------------------------------

Objectives support dependency rules.

Example

Review DNA Report

requires

Request DNA Analysis

AND

Collect Laboratory Report

--------------------------------------------------

OPTIONAL OBJECTIVES

--------------------------------------------------

Support optional tasks.

Examples

Inspect every CCTV camera

Interview all witnesses

Read historical police reports

Optional objectives contribute to completion percentage but are not
required to finish the investigation.

--------------------------------------------------

HIDDEN OBJECTIVES

--------------------------------------------------

Hidden objectives remain invisible until unlocked.

Example

Find Secret Basement

Only appears after discovering a hidden key.

--------------------------------------------------

OBJECTIVE CONDITIONS

--------------------------------------------------

Support conditions.

Examples

Application Opened

Specific Email Read

Specific Message Read

Evidence Viewed

Evidence Tagged

Location Visited

CCTV Timestamp Reviewed

Forensic Analysis Requested

Forensic Report Collected

Person Profile Opened

Investigation Board Connection Created

Theory Created

Custom Event

--------------------------------------------------

CUSTOM CONDITIONS

--------------------------------------------------

Allow objectives to listen for custom events.

Example

event

weapon:identified

The engine must remain extensible.

--------------------------------------------------

OBJECTIVE ACTIONS

--------------------------------------------------

Objectives may execute actions when completed.

Supported actions:

Unlock Objective

Unlock Evidence

Unlock Conversation

Unlock Person

Unlock Email

Unlock CCTV

Unlock Location

Unlock Forensics

Reveal Hidden Objective

Change Investigation Phase

Emit Event

--------------------------------------------------

OBJECTIVE JSON

--------------------------------------------------

Example

{

"id":"obj-watch-camera",

"title":"Review Security Camera",

"description":"Inspect Camera 03 footage.",

"optional":false,

"hidden":false,

"conditions":\[

{

"type":"cameraViewed",

"target":"camera-03"

}

\],

"actions":\[

{

"type":"unlockEvidence",

"target":"ev-018"

},

{

"type":"unlockObjective",

"target":"obj-question-witness"

}

\],

"dependencies":\[

"obj-open-evidence"

\]

}

--------------------------------------------------

OBJECTIVE CATEGORIES

--------------------------------------------------

Support categories.

Main

Investigation

Evidence

Interview

Travel

Laboratory

Theory

Resolution

Optional

--------------------------------------------------

INVESTIGATION PHASES

--------------------------------------------------

Allow phase transitions.

Example

Assignment

↓

Crime Scene

↓

Witnesses

↓

Evidence

↓

Laboratory

↓

Theory

↓

Resolution

Each phase defines:

Available objectives

Unlocked applications

Visible content

--------------------------------------------------

OBJECTIVE PRIORITY

--------------------------------------------------

Support

Critical

Normal

Optional

Hidden

Widget highlights Critical objectives.

--------------------------------------------------

OBJECTIVE HISTORY

--------------------------------------------------

Maintain history.

Display:

Completed time

Skipped

Unlocked time

Current state

--------------------------------------------------

EVENT SYSTEM

--------------------------------------------------

The Objective Engine listens to every application event.

Examples

mail:read

message:opened

evidence:viewed

location:visited

camera:viewed

analysis:requested

analysis:collected

board:connection-created

board:theory-created

Applications remain unaware of objective logic.

--------------------------------------------------

EDITOR FRIENDLY

--------------------------------------------------

The Objective Engine must not contain investigation-specific code.

Every investigation should be editable using only JSON.

Future Case Editor will use this engine directly.

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Objective states

Unlock history

Current phase

Current progress

Unlocked content

Hidden objectives

--------------------------------------------------

DEBUG MODE

--------------------------------------------------

Add developer debugging support.

Display:

Current phase

Completed objectives

Locked objectives

Available objectives

Triggered events

Useful for investigation designers.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Tablet

Phone

Objective information remains readable.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Case Editor

Visual graph editor

AI-generated objectives

Procedural investigations

Cloud synchronization

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 16:

The game supports a fully data-driven investigation engine.

Objectives may branch.

Objectives may unlock content.

Objectives support dependencies.

Objectives support optional and hidden tasks.

The engine contains no investigation-specific logic.

Future investigations can be created entirely through JSON files.

Explain:

\- Objective graph architecture

\- Dependency resolution

\- Condition evaluation

\- Action execution

\- Event flow

\- Save format

\- How Mission 17 (Case Resolution) will use this engine to validate
player conclusions and determine investigation outcomes.

Do not continue to Mission 17.
