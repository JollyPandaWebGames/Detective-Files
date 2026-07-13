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

Only implement Mission 19.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 19

Dynamic Content Unlock Engine

--------------------------------------------------

GOAL

Implement a centralized engine responsible for unlocking every piece of
investigation content.

The unlock system must be completely data-driven.

No application should contain unlock logic.

No investigation should require custom JavaScript.

--------------------------------------------------

CORE IDEA

--------------------------------------------------

Everything in Detective Files may be locked.

Everything may also become unlocked.

Examples:

Emails

Messenger conversations

Evidence

People

Suspects

Witnesses

Locations

Buildings

CCTV videos

Camera timestamps

Forensic reports

Objectives

Board templates

Theories

Hints

Tutorial popups

Applications

Desktop shortcuts

--------------------------------------------------

UNLOCK ENGINE

--------------------------------------------------

Create:

UnlockManager

Responsibilities:

Load unlock rules

Evaluate conditions

Unlock content

Emit events

Persist progress

--------------------------------------------------

UNLOCK RULES

--------------------------------------------------

Create:

unlocks.json

Example

/data/cases/case001/unlocks.json

--------------------------------------------------

{

"rules":\[

{

"id":"unlock-camera",

"target":"camera-03",

"type":"cctv",

"conditions":\[

{

"event":"objectiveCompleted",

"value":"obj-open-evidence"

}

\]

}

\]

}

--------------------------------------------------

SUPPORTED TARGET TYPES

--------------------------------------------------

Evidence

Email

Conversation

Person

Location

CCTV

Timestamp

Objective

Forensics

Board Template

Hint

Application

Desktop Shortcut

Notification

Custom

--------------------------------------------------

SUPPORTED CONDITIONS

--------------------------------------------------

Objective Completed

Objective Available

State Entered

State Exited

Evidence Viewed

Evidence Collected

Email Read

Conversation Opened

Location Visited

Camera Watched

Timestamp Bookmarked

Theory Created

Board Connection Created

Forensic Requested

Forensic Completed

Time Elapsed

Random Event

Custom Event

--------------------------------------------------

MULTIPLE CONDITIONS

--------------------------------------------------

Support:

AND

OR

Nested Groups

Example

Read HQ Email

AND

Review Camera

OR

Interview Witness

--------------------------------------------------

UNLOCK ACTIONS

--------------------------------------------------

Unlock

Hide

Reveal

Enable

Disable

Notify

Highlight

Pin

Generate

Queue

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Applications never decide what is visible.

Applications simply ask:

ApplicationContext

↓

UnlockManager

↓

Visible Content

Example

Evidence Database

↓

Visible Evidence

Messenger

↓

Visible Conversations

Police Mail

↓

Visible Emails

--------------------------------------------------

NOTIFICATIONS

--------------------------------------------------

Support notifications.

Examples

New evidence discovered.

HQ sent a new email.

DNA report is available.

New witness found.

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Unlocked entities

Hidden entities

Reveal history

Unlock history

Notification history

--------------------------------------------------

DEBUG MODE

--------------------------------------------------

Developer panel

Display:

Every unlock rule

Satisfied conditions

Pending rules

Unlocked entities

Locked entities

Last trigger

--------------------------------------------------

EVENT SYSTEM

--------------------------------------------------

Emit:

content:unlocked

content:hidden

content:revealed

notification:generated

Applications refresh automatically.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Tablet

Phone

No UI differences required.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Rewards

XP

Achievements

Profiles

Cloud synchronization

Steam integration

Case editor

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 19:

Every investigation entity can unlock dynamically.

No application contains unlock logic.

Unlock rules are entirely defined in JSON.

Future investigations require only data files.

Explain:

\- UnlockManager architecture

\- Rule evaluation

\- Condition groups

\- Event flow

\- Save structure

\- Application integration

\- How Mission 20 (Tutorial Case) demonstrates every major investigation
mechanic introduced in Missions 15–19.

Do not continue to Mission 20.
