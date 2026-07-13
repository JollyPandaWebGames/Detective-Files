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

MISSION 05

Settings Application

--------------------------------------------------

Goal

Replace the placeholder Settings application with the first fully
functional CID OS application.

This mission validates the Application Framework and introduces
persistent local settings.

No backend should be used.

Everything is stored locally.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Settings application.

Settings must extend BaseApp.

The application should open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Create a two-column layout.

Left panel:

\- General

\- Appearance

\- Accessibility

\- About

Right panel:

Displays the selected category.

--------------------------------------------------

GENERAL

--------------------------------------------------

Provide the following settings:

\- Language

\- English (default)

\- Placeholder for future languages

\- Confirm before closing windows

\- On / Off

\- Enable desktop animations

\- On / Off

--------------------------------------------------

APPEARANCE

--------------------------------------------------

Provide:

Theme

\- CID Dark (default)

\- Future themes placeholder

Desktop Wallpaper

Choose from:

\- Police Office

\- Evidence Room

\- City at Night

Changing the wallpaper updates immediately.

--------------------------------------------------

ACCESSIBILITY

--------------------------------------------------

Options:

\- UI Scale

\- 90%

\- 100%

\- 110%

\- 125%

\- Larger window title text

\- On / Off

\- Reduce animations

\- On / Off

Changes should apply immediately where possible.

--------------------------------------------------

ABOUT

--------------------------------------------------

Display:

Detective Files

CID OS Version

Application Framework Version

Developer

Jolly Panda Studio

Placeholder copyright.

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Create StorageManager.

Responsibilities:

\- Save settings

\- Load settings

\- Reset settings

Store data using LocalStorage.

No server.

--------------------------------------------------

SETTINGS FORMAT

--------------------------------------------------

Example:

{

"language":"en",

"theme":"cid-dark",

"wallpaper":"office",

"uiScale":100,

"confirmClose":true,

"animations":true,

"reduceAnimations":false

}

--------------------------------------------------

LIVE UPDATES

--------------------------------------------------

Changing:

Theme

Wallpaper

UI Scale

Should immediately update CID OS.

No page refresh.

--------------------------------------------------

RESET

--------------------------------------------------

Provide a button:

Reset to Default

Ask for confirmation.

Restore factory settings.

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Example events:

settings:changed

theme:changed

wallpaper:changed

ui-scale:changed

Applications should react through events rather than direct references.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Two-column layout.

Tablet

Collapsible sidebar.

Phone

Single-column layout with a category selector at the top.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Maintain consistent pixel-art styling.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Accounts

Cloud sync

Audio

Gameplay

Mail

Messenger

Cases

Evidence

Notifications

Plugins

Backend

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 05:

The player can:

\- Open Settings

\- Change preferences

\- Save settings locally

\- Reopen CID OS and retain settings

\- Change wallpaper

\- Change UI scale

\- Reset settings

Settings should become the first complete application inside CID OS.

Explain:

\- Storage architecture

\- Event flow

\- LocalStorage structure

\- How future applications can read user settings

Do not continue to Mission 06.
