You are continuing development of Detective Files.

The game's operating system is called CID OS.

This is NOT a gameplay mission.

This is NOT a new application.

This is a major architecture refactor that must be completed before
Phase 2 begins.

All existing functionality from Phase 1 (Mission 00–14) must continue to
work after the refactor.

Do not implement any new gameplay systems.

--------------------------------------------------

EPIC 01

CID OS Architecture 2.0

--------------------------------------------------

GOAL

Refactor the entire application architecture to introduce a centralized
Application Context and Session system.

This will become the foundation for every future feature including:

\- Active Investigation

\- Save / Resume

\- User Profiles

\- Cloud Save

\- Localization

\- Themes

\- Notifications

\- Multiplayer

\- Modding

--------------------------------------------------

ARCHITECTURE

--------------------------------------------------

Introduce the following new core systems.

ApplicationContext

SessionManager

ActiveInvestigation

ContextProvider

Context Events

Applications must never communicate directly with individual managers.

Everything should flow through ApplicationContext.

--------------------------------------------------

APPLICATION CONTEXT

--------------------------------------------------

Create:

ApplicationContext

The context is the single source of truth for the entire operating
system.

It exposes:

currentSession

currentInvestigation

currentUser

settings

theme

language

notifications

desktop

windowState

Applications should never directly access individual managers.

--------------------------------------------------

SESSION

--------------------------------------------------

Introduce SessionManager.

A session represents the current detective workspace.

Session contains:

Current Investigation

Open Windows

Desktop State

Window Positions

Current Objectives

Notification Queue

Running Timers

Future Save Metadata

Only one session exists locally.

--------------------------------------------------

ACTIVE INVESTIGATION

--------------------------------------------------

Replace every "Selected Case" workflow.

Only one investigation may be active.

States:

Locked

Available

Active

Completed

Archived

Applications always display the Active Investigation.

--------------------------------------------------

CASE MANAGEMENT

--------------------------------------------------

Replace:

Open Case

with

Start Investigation

Starting another investigation requires confirmation.

Completed investigations remain active until another investigation
begins.

--------------------------------------------------

ACTIVE INVESTIGATION WIDGET

--------------------------------------------------

Create a permanent desktop widget.

Position:

Bottom-right.

The widget cannot be closed.

Only:

Expand

Collapse

Widget displays:

Case Name

Progress

Objectives

Remaining Tasks

Status

Open Case button

No Active Investigation state

Completed Investigation state

--------------------------------------------------

APPLICATIONS

--------------------------------------------------

Update every application.

Instead of:

case:selected

Applications now use:

ApplicationContext.currentInvestigation

When context changes:

Applications refresh automatically.

Affected:

Case Management

Police Mail

Messenger

Evidence Database

CCTV Viewer

City Map

Criminal Database

Forensics Lab

Investigation Board

--------------------------------------------------

BASE APP

--------------------------------------------------

Refactor BaseApp.

Every application receives:

context

Implement lifecycle:

onOpen()

onClose()

onSuspend()

onResume()

onContextChanged()

--------------------------------------------------

EVENTS

--------------------------------------------------

Replace:

case:selected

with

context:changed

investigation:started

investigation:stopped

investigation:completed

investigation:changed

investigation:resumed

Applications should react automatically.

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Current Session

Current Investigation

Desktop Widget State

Window Layout

Opened Applications

Objectives

Progress

Restore everything after refresh.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Tablet

Phone

The Active Investigation widget remains available on every device.

--------------------------------------------------

BACKWARD COMPATIBILITY

--------------------------------------------------

Migrate previous save format automatically.

No existing case JSON files should require modification.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

No backend

No cloud save

No multiplayer

No authentication

No Steam

No achievements

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After this Epic:

Every application works from ApplicationContext.

Only one investigation can be active.

Refreshing the page restores the complete detective workspace.

The desktop contains a permanent Active Investigation widget.

Future features should require minimal architectural changes.

Finally, generate:

ARCHITECTURE_2.md

Document the new architecture, data flow, lifecycle, event system, and
responsibilities of each core component.
