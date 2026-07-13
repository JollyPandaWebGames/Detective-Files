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

Only implement Mission 18.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 18

Investigation State Machine

--------------------------------------------------

GOAL

Transform investigations from static sequences into dynamic state-driven
experiences.

Investigations should react to player actions, completed objectives,
elapsed investigation time, and internal events.

The investigation becomes a living system.

--------------------------------------------------

CORE IDEA

--------------------------------------------------

A case is composed of Investigation States.

Only one state is active at any time.

States determine:

Visible content

Unlocked applications

Available objectives

Emails

Messages

People

Evidence

Locations

Forensics

Board recommendations

--------------------------------------------------

STATE MACHINE

--------------------------------------------------

Create:

InvestigationStateMachine

Responsibilities:

Load states

Evaluate transitions

Activate states

Emit events

Persist state

--------------------------------------------------

STATE JSON

--------------------------------------------------

Example:

/data/cases/{caseId}/states.json

--------------------------------------------------

{

"states":\[

{

"id":"assignment",

"title":"Assignment",

"initial":true,

"transitions":\[

"crime-scene"

\]

}

\]

}

--------------------------------------------------

STATE TRANSITIONS

--------------------------------------------------

Transitions may occur by:

Objective completed

Evidence discovered

Message read

Forensics completed

Time elapsed

Custom event

Manual trigger

--------------------------------------------------

EXAMPLES

--------------------------------------------------

Player reads HQ email

↓

Crime Scene unlocked

↓

New objective appears

↓

Witness receives message

↓

Messenger updates automatically

--------------------------------------------------

DNA completed

↓

New suspect unlocked

↓

Police Mail receives HQ email

↓

Board recommendation changes

--------------------------------------------------

STATE ACTIONS

--------------------------------------------------

When entering a state:

Unlock objectives

Unlock evidence

Unlock messages

Unlock emails

Unlock people

Unlock locations

Unlock CCTV

Unlock analyses

Show notification

Generate HQ mail

Emit events

--------------------------------------------------

TIME-BASED EVENTS

--------------------------------------------------

Support delayed transitions.

Examples:

30 seconds

↓

Forensics completed

2 minutes

↓

Witness sends message

5 minutes

↓

HQ requests update

Timers must survive page refresh.

--------------------------------------------------

APPLICATION REACTIONS

--------------------------------------------------

Applications automatically refresh.

No manual reload.

Evidence

Messenger

Police Mail

Criminal Database

Map

Board

Forensics

All update from ApplicationContext.

--------------------------------------------------

INVESTIGATION EVENTS

--------------------------------------------------

Support random events.

Example:

Witness unavailable.

Evidence contaminated.

Power outage.

Anonymous email received.

Random events remain optional per case.

--------------------------------------------------

STATE HISTORY

--------------------------------------------------

Maintain complete history.

Display:

Entered At

Exited At

Reason

Triggered By

Useful for debugging and future replay.

--------------------------------------------------

DEBUG MODE

--------------------------------------------------

Developer overlay:

Current State

Available Transitions

Triggered Conditions

Pending Timers

Locked States

--------------------------------------------------

EVENT SYSTEM

--------------------------------------------------

Emit:

state:entered

state:exited

state:transition

state:timer-started

state:timer-finished

Applications react automatically.

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Current state

History

Pending timers

Triggered transitions

Random event seed

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Tablet

Phone

No special UI required.

State system remains completely data-driven.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Dynamic weather

AI suspects

Procedural investigations

Networking

Cloud Save

Achievements

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 18:

Investigations become dynamic.

The world reacts to player progress.

States automatically unlock new content.

Timers survive refresh.

Applications refresh automatically.

Future cases can create complex branching investigations without
modifying engine code.

Explain:

\- State Machine architecture

\- Transition system

\- Timer architecture

\- Random event framework

\- Save structure

\- Event flow

\- How Mission 19 (Dynamic Unlock System) expands this by allowing
individual entities (emails, evidence, suspects, CCTV, locations) to
unlock independently from state transitions.

Do not continue to Mission 19.
