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

Do not redesign the architecture.

Only implement Mission 03.

Do not continue to future missions.

--------------------------------------------------

MISSION 03

Window Framework

--------------------------------------------------

Goal

Implement the complete window framework used by every application in CID
OS.

No real applications should exist yet.

Only the window system.

The framework must be reusable, modular, and responsive.

--------------------------------------------------

WINDOW MANAGER

--------------------------------------------------

Create WindowManager.

Responsibilities:

\- Create windows

\- Destroy windows

\- Focus windows

\- Track active window

\- Maintain window stack

\- Manage z-index

\- Minimize windows

\- Restore windows

\- Close windows

WindowManager must never know application logic.

--------------------------------------------------

WINDOW COMPONENT

--------------------------------------------------

Create a reusable Window component.

Each window contains:

\- Title Bar

\- Content Area

\- Window Controls

\- Status Bar placeholder

Applications will inject their UI into the content area.

--------------------------------------------------

TITLE BAR

--------------------------------------------------

Contains:

\- Application Icon (emoji or PNG)

\- Window Title

\- Spacer

\- Minimize Button

\- Close Button

No maximize button yet.

--------------------------------------------------

WINDOW CONTROLS

--------------------------------------------------

Implement:

\- Close

\- Minimize

States:

\- Normal

\- Hover

\- Pressed

Pixel-art styling.

--------------------------------------------------

WINDOW CONTENT

--------------------------------------------------

Create a reusable content container.

For now display placeholder text:

"This application is under development."

--------------------------------------------------

WINDOW DRAGGING

--------------------------------------------------

Desktop & Tablet

\- Drag only from Title Bar

\- Smooth dragging

\- Bring window to front while dragging

Phone

\- Disable dragging

\- Windows open fullscreen

The Window component must automatically choose the correct behavior
based on screen size.

--------------------------------------------------

RESPONSIVE WINDOW MODES

--------------------------------------------------

Desktop

Floating windows.

Tablet

Floating windows with reduced default size.

Phone

Fullscreen windows.

Applications must not know which mode is being used.

--------------------------------------------------

WINDOW STACK

--------------------------------------------------

Support unlimited windows.

Clicking any window:

\- Bring to front

\- Become active

\- Update title bar style

Only one window is active.

--------------------------------------------------

WINDOW POSITION

--------------------------------------------------

Desktop

Cascade newly opened windows.

Example

Window 1

120,80

Window 2

150,110

Window 3

180,140

Phone

Ignore positioning.

Always fullscreen.

--------------------------------------------------

WINDOW LIMITS

--------------------------------------------------

Prevent windows from leaving the viewport.

Keep at least 80px visible.

--------------------------------------------------

MINIMIZE

--------------------------------------------------

Minimize hides the window.

Do not destroy it.

Window state remains alive.

--------------------------------------------------

RESTORE

--------------------------------------------------

WindowManager.restore(windowId)

Restores minimized windows.

Taskbar integration comes later.

--------------------------------------------------

CLOSE

--------------------------------------------------

Destroy DOM.

Remove references.

Avoid memory leaks.

--------------------------------------------------

TEST WINDOWS

--------------------------------------------------

Create temporary applications for testing.

Examples:

Window A

Window B

Window C

Each window should display:

Title

Emoji

Placeholder content

Desktop icons should now open these test windows instead of logging to
the console.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Use:

\- Pixel borders

\- Dark title bars

\- Square corners

\- Consistent spacing

\- Active window highlighting

--------------------------------------------------

RESPONSIVE DESIGN

--------------------------------------------------

The workstation must remain usable on:

Desktop

Laptop

Tablet

Phone

No separate mobile application.

The same window framework adapts automatically.

--------------------------------------------------

ACCESSIBILITY

--------------------------------------------------

Keyboard focus.

Escape closes focused test window.

Tab navigation.

Visible focus states.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Application loading

Plugin architecture

Storage

Themes beyond current implementation

Window resizing

Window snapping

Taskbar running applications

Mail

Messenger

Evidence

Cases

Backend

Authentication

Audio

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 03:

The user can:

\- Double-click a desktop icon

\- Open a window

\- Open multiple windows

\- Drag windows (desktop/tablet)

\- Bring windows to front

\- Minimize windows

\- Restore windows programmatically

\- Close windows

The workstation should now feel like a real operating system.

Explain:

\- New files

\- Architecture decisions

\- Window lifecycle

\- How Mission 04 will connect BaseApp and the AppManager to this
framework

Do not continue to Mission 04.
