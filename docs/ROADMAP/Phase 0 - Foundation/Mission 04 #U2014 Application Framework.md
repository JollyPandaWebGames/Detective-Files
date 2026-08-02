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

Only implement Mission 04.

Do not redesign the architecture.

Do not continue to future missions.

--------------------------------------------------

MISSION 04

Application Framework

--------------------------------------------------

Goal

Replace the temporary test windows with a real application framework.

Every desktop icon should launch an application through AppManager.

Applications should extend BaseApp.

Window creation should be handled automatically.

This mission builds the foundation for every future application.

--------------------------------------------------

BASE APP

--------------------------------------------------

Complete the BaseApp implementation.

Every application extends BaseApp.

BaseApp should provide:

\- id

\- title

\- icon

\- window

\- state

Lifecycle methods:

create()

open()

close()

minimize()

restore()

destroy()

Applications may override these methods.

--------------------------------------------------

APP MANAGER

--------------------------------------------------

Complete AppManager.

Responsibilities:

\- Register applications

\- Launch applications

\- Close applications

\- Track running applications

\- Prevent duplicate instances when singleton=true

\- Return running instances

\- Focus existing instance instead of opening another

AppManager should be the only system allowed to launch applications.

--------------------------------------------------

APP LOADER

--------------------------------------------------

Complete AppLoader.

Responsibilities:

\- Discover applications

\- Read app.json

\- Dynamically import application modules

\- Validate application metadata

\- Register applications with AppManager

Applications should never be hardcoded.

--------------------------------------------------

APPLICATION REGISTRATION

--------------------------------------------------

Each application contains:

app.json

index.js

style.css

The loader should automatically register every application found.

--------------------------------------------------

DESKTOP INTEGRATION

--------------------------------------------------

Double-clicking a desktop icon should now:

Desktop

↓

AppManager

↓

AppLoader

↓

Application Instance

↓

WindowManager

↓

Window

DesktopManager should never create windows directly.

--------------------------------------------------

WINDOW INTEGRATION

--------------------------------------------------

Applications should never create windows directly.

Instead:

BaseApp requests a window from WindowManager.

WindowManager creates it.

BaseApp receives the content container.

Applications only populate the content area.

--------------------------------------------------

PLACEHOLDER APPLICATIONS

--------------------------------------------------

Replace Window A/B/C with real placeholder applications.

Implement:

Case Management

Police Mail

Messenger

Evidence Database

Forensics Lab

CCTV Viewer

City Map

Investigation Board

Criminal Database

Settings

Each application should:

\- Extend BaseApp

\- Open inside a window

\- Display its title

\- Display its emoji/icon

\- Display placeholder content:

"This application is under development."

--------------------------------------------------

TASKBAR INTEGRATION

--------------------------------------------------

The taskbar should now display running applications.

Each running application shows:

\- Icon

\- Active state

Clicking a taskbar item:

If minimized:

Restore.

Otherwise:

Bring window to front.

--------------------------------------------------

APPLICATION STATES

--------------------------------------------------

Support:

Closed

Running

Focused

Minimized

Only one focused application at a time.

--------------------------------------------------

EVENT BUS

--------------------------------------------------

Applications should communicate only through EventBus.

Do not directly reference other applications.

Example events:

app:opened

app:closed

window:focused

window:minimized

--------------------------------------------------

ERROR HANDLING

--------------------------------------------------

If an application cannot be loaded:

Display an error dialog window.

Do not crash CID OS.

--------------------------------------------------

RESPONSIVE BEHAVIOR

--------------------------------------------------

Desktop

Floating windows.

Tablet

Floating windows.

Phone

Fullscreen windows.

Applications should not know the difference.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Real Mail

Real Messenger

Real CCTV

Real Database

Evidence

Cases

Saving

Authentication

Backend

Networking

Audio

Animations

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 04:

The player can:

\- Double-click any desktop icon

\- Launch a real application

\- Open multiple different applications

\- Switch between running applications

\- See running applications in the taskbar

\- Reuse existing windows for singleton applications

\- Minimize and restore applications

The workstation should now feel like a complete desktop operating
system.

Explain:

\- New architecture

\- Application lifecycle

\- How applications are loaded

\- How Mission 05 will replace placeholders with real functionality

Do not continue to Mission 05.
