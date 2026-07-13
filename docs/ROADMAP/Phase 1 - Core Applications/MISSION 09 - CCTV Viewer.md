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

Only implement Mission 09.

Do not continue to future missions.

--------------------------------------------------

MISSION 09

CCTV Viewer

--------------------------------------------------

Goal

Replace the placeholder CCTV Viewer application with a functional
surveillance review system.

Detectives use CCTV Viewer to inspect surveillance footage, search for
clues, bookmark important timestamps, and create evidence for
investigations.

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder CCTV Viewer application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Split the window into four sections.

LEFT SIDEBAR

Camera List

CENTER

Video Player

BOTTOM

Playback Timeline

RIGHT SIDEBAR

Camera Information

Bookmarks

Notes

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

Only display cameras assigned to the currently selected case.

Listen for:

case:selected

--------------------------------------------------

CAMERA DATA

--------------------------------------------------

Load cameras from:

/data/cases/{caseId}/cctv/

Example:

camera-01.json

{

"id":"camera-01",

"name":"Lobby Entrance",

"location":"Main Entrance",

"duration":420,

"video":"lobby.mp4",

"thumbnail":"camera01.png",

"available":true

}

--------------------------------------------------

CAMERA LIST

--------------------------------------------------

Display:

• Camera thumbnail

• Camera name

• Recording duration

• Recording date

Support:

Selection

Scrolling

--------------------------------------------------

VIDEO PLAYER

--------------------------------------------------

Provide:

Play

Pause

Seek

Current Time

Duration

Playback Speed

Playback speeds:

0.25x

0.5x

1x

2x

4x

--------------------------------------------------

TIMELINE

--------------------------------------------------

Interactive timeline.

Player can:

Click to seek

Drag playhead

Display bookmark markers

Display evidence markers

--------------------------------------------------

BOOKMARKS

--------------------------------------------------

Player can create bookmarks.

Each bookmark contains:

Timestamp

Title

Description

Bookmarks are editable.

Persist locally.

--------------------------------------------------

NOTES

--------------------------------------------------

Player can write notes for each camera.

Autosave locally.

--------------------------------------------------

VIDEO CONTROLS

--------------------------------------------------

Support:

Play

Pause

Stop

Skip Forward (10 sec)

Skip Backward (10 sec)

Jump to bookmark

--------------------------------------------------

ZOOM

--------------------------------------------------

Support digital zoom.

Levels:

100%

150%

200%

300%

Pan while zoomed.

--------------------------------------------------

FRAME STEPPING

--------------------------------------------------

Provide:

Previous Frame

Next Frame

Useful for detailed investigations.

--------------------------------------------------

CREATE EVIDENCE

--------------------------------------------------

Player can capture the current frame.

Selecting:

Create Evidence

Creates a new image evidence entry.

The new evidence appears automatically in Evidence Database.

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

cctv:opened

cctv:bookmark-added

cctv:note-updated

cctv:evidence-created

Listen:

case:selected

evidence:opened

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

Bookmarks

Notes

Last playback position

Zoom level

Example:

{

"camera-01":{

"bookmarks":\[

{

"time":92,

"title":"Suspect enters building"

}

\],

"notes":"Blue backpack appears here.",

"lastPosition":184

}

}

--------------------------------------------------

MAIL INTEGRATION

--------------------------------------------------

Police Mail attachments may contain CCTV references.

Opening the attachment should:

Open CCTV Viewer

↓

Select camera

↓

Jump to specified timestamp

--------------------------------------------------

EVIDENCE INTEGRATION

--------------------------------------------------

Captured frames become Evidence Database entries.

Evidence Database should immediately display newly captured images.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Four-panel layout.

Tablet

Collapsible sidebars.

Phone

Single-column navigation:

Camera List

↓

Player

↓

Bookmarks

Maintain CID OS appearance.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Dark CID OS theme.

Pixel borders.

Consistent spacing.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Video editing

Real AI image enhancement

Online streaming

Audio analysis

Facial recognition

Motion detection

Networking

Backend

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 09:

The player can:

\- Browse surveillance cameras

\- Watch recordings

\- Seek through footage

\- Change playback speed

\- Zoom video

\- Step frame-by-frame

\- Add bookmarks

\- Write camera notes

\- Capture frames as evidence

\- Open CCTV clips directly from Police Mail

\- Automatically create evidence entries from captured frames

Explain:

\- CCTV file structure

\- Bookmark storage

\- Evidence creation workflow

\- Event flow

\- How Mission 10 (City Map) will integrate with camera locations

Do not continue to Mission 10.
