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

Only implement Mission 14.

Do not continue to future missions.

--------------------------------------------------

MISSION 14

Investigation Board

--------------------------------------------------

Goal

Replace the placeholder Investigation Board application with the primary
detective gameplay system.

The Investigation Board is where the detective organizes information,
creates connections, builds theories, and solves cases.

Every major application feeds information into the board.

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Investigation Board application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

LEFT SIDEBAR

Board Tools

\- Add Evidence

\- Add Person

\- Add Location

\- Add Camera

\- Add Note

\- Add Group

CENTER

Infinite Investigation Canvas

RIGHT SIDEBAR

Selected Node Inspector

--------------------------------------------------

BOARD

--------------------------------------------------

The board is an infinite canvas.

Support:

Pan

Zoom

Mouse Wheel Zoom

Touch Zoom

Drag Navigation

Reset View

--------------------------------------------------

NODE TYPES

--------------------------------------------------

Support the following nodes:

Evidence

Person

Location

Camera

Conversation

Email

Forensics Report

Custom Note

Theory

Each node has its own pixel-art icon.

--------------------------------------------------

ADDING NODES

--------------------------------------------------

The detective can add nodes from:

Evidence Database

Messenger

Police Mail

City Map

Criminal Database

CCTV Viewer

Forensics Lab

Or create custom notes.

--------------------------------------------------

NODE DISPLAY

--------------------------------------------------

Each node displays:

Icon

Title

Subtitle

Category

Color

Pinned state

--------------------------------------------------

NODE INTERACTION

--------------------------------------------------

Support:

Select

Move

Drag

Delete

Duplicate

Focus

Pin

Collapse

Expand

--------------------------------------------------

CONNECTIONS

--------------------------------------------------

Player can connect any two nodes.

Connections have:

Direction

Label

Color

Thickness

Connections are editable.

--------------------------------------------------

RELATION TYPES

--------------------------------------------------

Examples:

Owns

Visited

Seen With

Called

Threatened

Family

Friend

Business

DNA Match

Fingerprint Match

Weapon Used

Unknown

Custom

--------------------------------------------------

GROUPS

--------------------------------------------------

Player can create groups.

Groups may contain:

Nodes

Connections

Notes

Each group has:

Title

Color

Description

--------------------------------------------------

THEORY NODES

--------------------------------------------------

Player can create theory cards.

Theory contains:

Title

Description

Confidence

Related Nodes

Theories are editable.

--------------------------------------------------

CUSTOM NOTES

--------------------------------------------------

Sticky notes.

Editable.

Resizable.

Color selection.

--------------------------------------------------

INSPECTOR

--------------------------------------------------

Selecting a node displays:

Complete information

Related applications

Related entities

Quick actions

--------------------------------------------------

QUICK ACTIONS

--------------------------------------------------

Evidence

↓

Open Evidence Database

Person

↓

Open Criminal Database

Camera

↓

Open CCTV Viewer

Location

↓

Open City Map

Conversation

↓

Open Messenger

Report

↓

Open Forensics Lab

--------------------------------------------------

SEARCH

--------------------------------------------------

Search every node.

Results immediately focus the selected node.

--------------------------------------------------

AUTO IMPORT

--------------------------------------------------

When new information appears:

Evidence

People

Reports

Messages

Emails

Automatically become available for adding.

Do NOT automatically place them on the board.

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Node positions

Connections

Groups

Zoom

Camera position

Notes

Theories

Collapsed state

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Example:

{

"case-001":{

"camera":{

"x":1200,

"y":800,

"zoom":1.2

},

"nodes":\[

...

\],

"connections":\[

...

\],

"groups":\[

...

\]

}

}

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

board:node-added

board:node-selected

board:connection-created

board:group-created

board:theory-created

board:updated

Listen:

case:selected

evidence:created

person:selected

mail:selected

conversation:selected

forensics:collected

--------------------------------------------------

CASE SOLVING

--------------------------------------------------

Introduce the Solve Case workflow.

Button:

Solve Investigation

Pressing it opens a review dialog.

Display:

Current objectives

Missing evidence

Incomplete analyses

Unconnected important nodes

Player theories

For Mission 14:

Do NOT determine whether the solution is correct.

Only build the review workflow.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Full board experience.

Tablet

Optimized dragging.

Phone

Read-only board.

Node inspection.

No editing required.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Dark CID OS theme.

Pixel-art push pins.

Pixel paper cards.

Pixel strings.

Pixel shadows.

Maintain visual consistency with the operating system.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Automatic deduction

AI reasoning

Case validation

Hint system

Multiplayer

Cloud sync

Networking

Backend

Authentication

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 14:

The player can:

\- Build an investigation board

\- Add every type of investigation node

\- Connect nodes with relationships

\- Organize groups

\- Create theories

\- Write custom notes

\- Navigate an infinite canvas

\- Save the complete board

\- Launch related applications from nodes

\- Open the Solve Investigation review dialog

The Investigation Board should become the central gameplay mechanic of
Detective Files.

Explain:

\- Board architecture

\- Node system

\- Connection model

\- Storage format

\- Event flow

\- How Mission 15 (Investigation Flow & Case Resolution) will evaluate
player theories and determine whether a case has been solved.

Do not continue to Mission 15.
