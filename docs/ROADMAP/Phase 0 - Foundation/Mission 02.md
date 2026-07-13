You are continuing development of the browser-based detective simulation
game Detective Files.

The game's operating system is called:

CID OS

(Criminal Investigation Department Operating System)

Before implementing anything, read and follow these project documents:

\- ARCHITECTURE.md

\- PROJECT_SPEC.md

\- ROADMAP.md

\- UI_GUIDELINES.md

\- CODING_STYLE.md

\- APP_SDK.md

\- CASE_FORMAT.md

These documents are the project's single source of truth.

Do NOT redesign the architecture.

Only implement Mission 02.

--------------------------------------------------

MISSION 02

Desktop Environment

--------------------------------------------------

Goal:

Transform the empty CID OS desktop into a functional desktop
environment.

The player should be able to interact with the desktop exactly like a
lightweight operating system.

Do NOT implement application windows yet.

--------------------------------------------------

TASKBAR

--------------------------------------------------

Create a pixel-art taskbar fixed to the bottom of the screen.

Requirements:

\- Full width

\- Fixed height

\- Pixel-art styling

\- Dark theme

\- Responsive layout

The taskbar contains:

• Start Button (left)

• Running Applications Area (center)

(empty placeholder for now)

• System Clock (right)

The taskbar must always remain visible.

--------------------------------------------------

SYSTEM CLOCK

--------------------------------------------------

Display the current local time.

Requirements:

\- 24-hour format

\- Update every second

\- No seconds displayed

\- Format example:

21:45

Future date display is not required.

--------------------------------------------------

START BUTTON

--------------------------------------------------

Create a pixel-art Start button.

Requirements:

\- Located on the left side

\- Hover state

\- Pressed state

\- Keyboard accessible

Clicking the button toggles the Start Menu.

--------------------------------------------------

START MENU

--------------------------------------------------

Create the first version of the Start Menu.

Requirements:

\- Opens above the taskbar

\- Pixel-art appearance

\- Dark theme

\- Vertical layout

\- Scrollable if necessary

\- Closes when clicking outside

\- Closes when Escape is pressed

Menu sections:

Applications

System

About

--------------------------------------------------

APPLICATION LIST

--------------------------------------------------

Applications are NOT hardcoded.

Read application metadata from:

/data/apps.json

Generate the Start Menu automatically.

Each entry displays:

Application Icon

Application Name

Do NOT launch applications yet.

Clicking an application should simply log:

Opening: \<appId\>

--------------------------------------------------

DESKTOP ICONS

--------------------------------------------------

Create desktop icons dynamically.

Requirements:

Icons are generated from:

/data/apps.json

Each icon contains:

\- Pixel icon

\- Application name

Icons align to a desktop grid.

Default spacing:

80px

Icons should reposition automatically when the browser resizes.

Desktop icons are selectable.

Double-clicking an icon should log:

Opening: \<appId\>

--------------------------------------------------

ICON SELECTION

--------------------------------------------------

Support:

Single click → Select icon

Click elsewhere → Deselect

Only one icon selected at a time.

Selected icons use the active selection style from UI_GUIDELINES.md.

--------------------------------------------------

DESKTOP CONTEXT MENU

--------------------------------------------------

Right-clicking the desktop opens a context menu.

Menu items:

Refresh

Sort Icons

Settings

Properties

These actions are placeholders.

Log their names to the console.

Clicking outside closes the menu.

--------------------------------------------------

DESKTOP MANAGER

--------------------------------------------------

Expand DesktopManager responsibilities.

DesktopManager now controls:

Desktop

Wallpaper

Desktop icons

Selection

Grid positioning

Context menu

Desktop events

Do NOT manage windows.

--------------------------------------------------

TASKBAR MANAGER

--------------------------------------------------

Create a dedicated Taskbar component.

Responsibilities:

Start button

Clock

Running application placeholder

Start menu toggle

The Taskbar should not contain application logic.

--------------------------------------------------

APP METADATA

--------------------------------------------------

Create or update:

/data/apps.json

Example:

\[

{

"id": "case-management",

"title": "Case Management",

"icon": "case.png"

},

{

"id": "police-mail",

"title": "Police Mail",

"icon": "mail.png"

},

{

"id": "messenger",

"title": "Messenger",

"icon": "messenger.png"

},

{

"id": "evidence-database",

"title": "Evidence Database",

"icon": "evidence.png"

},

{

"id": "forensics-lab",

"title": "Forensics Lab",

"icon": "lab.png"

},

{

"id": "cctv-viewer",

"title": "CCTV Viewer",

"icon": "cctv.png"

},

{

"id": "city-map",

"title": "City Map",

"icon": "map.png"

},

{

"id": "investigation-board",

"title": "Investigation Board",

"icon": "board.png"

},

{

"id": "criminal-database",

"title": "Criminal Database",

"icon": "criminal.png"

},

{

"id": "settings",

"title": "Settings",

"icon": "settings.png"

}

\]

--------------------------------------------------

ACCESSIBILITY

--------------------------------------------------

Support:

Tab navigation

Enter activates Start button

Escape closes menus

Visible focus state

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Window System

Window dragging

Application loading

Plugin loader

Application instances

Storage

Themes beyond Mission 01

Authentication

Gameplay

Cases

Evidence

Messenger

Mail

Backend

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After completing Mission 02 the user should be able to:

• Boot into CID OS

• View the desktop

• See desktop icons

• Select icons

• Open the Start Menu

• View installed applications

• See the system clock

• Right-click the desktop

• Feel like they are using a real operating system

Clicking an application should only log:

Opening: \<appId\>

Do not implement actual application launching.

After completion explain:

\- Files created

\- New components

\- Architecture decisions

\- How Mission 03 (Window System) will integrate with this
implementation

Do not continue to Mission 03.
