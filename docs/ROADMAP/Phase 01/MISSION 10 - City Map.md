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

Only implement Mission 10.

Do not continue to future missions.

--------------------------------------------------

MISSION 10

City Map

--------------------------------------------------

Goal

Replace the placeholder City Map application with an interactive
investigation map.

The City Map visualizes every important location related to the
currently active case.

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder City Map application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Split the application into three sections.

LEFT SIDEBAR

Map Filters

CENTER

Interactive Map

RIGHT SIDEBAR

Selected Location Details

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

Only display locations belonging to the currently selected case.

Listen for:

case:selected

--------------------------------------------------

MAP DATA

--------------------------------------------------

Load data from:

/data/cases/{caseId}/map/

Example:

locations.json

{

"locations":\[

{

"id":"loc-001",

"name":"Riverside Museum",

"type":"Crime Scene",

"x":640,

"y":280,

"description":"Primary crime scene.",

"relatedEvidence":\[

"ev-001",

"ev-004"

\],

"relatedCameras":\[

"camera-01",

"camera-02"

\]

}

\]

}

--------------------------------------------------

MAP

--------------------------------------------------

Display an illustrated city map.

Support:

Pan

Zoom

Center on location

Reset view

--------------------------------------------------

LOCATION MARKERS

--------------------------------------------------

Support marker types:

• Crime Scene

• CCTV Camera

• Evidence Location

• Witness Location

• Suspect Location

• Police Station

• Laboratory

Each marker should have a unique pixel-art icon.

--------------------------------------------------

FILTERS

--------------------------------------------------

Player can enable or disable:

Crime Scenes

Evidence

CCTV Cameras

Witnesses

Suspects

Police Stations

Laboratories

Changes apply instantly.

--------------------------------------------------

LOCATION DETAILS

--------------------------------------------------

When selecting a marker display:

Location Name

Type

Description

Address

Related Evidence

Related Cameras

Related Witnesses

Notes

--------------------------------------------------

PLAYER NOTES

--------------------------------------------------

Allow detectives to write notes for every location.

Autosave locally.

--------------------------------------------------

SEARCH

--------------------------------------------------

Search locations by:

Name

Address

Type

Description

Results update instantly.

--------------------------------------------------

QUICK ACTIONS

--------------------------------------------------

Each location may contain shortcuts:

Open Related Evidence

Open CCTV Camera

Open Witness Conversation

Open Criminal Profile

These launch the corresponding applications and automatically select the
related item.

--------------------------------------------------

MAP NAVIGATION

--------------------------------------------------

Support:

Mouse Drag

Mouse Wheel Zoom

Touch Drag

Pinch Zoom (mobile)

Double-click to center.

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

map:location-selected

map:location-focused

map:note-updated

Listen:

case:selected

evidence:selected

cctv:opened

mail:attachment-opened

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

Player Notes

Last Zoom Level

Last Camera Position

Last Selected Marker

Example:

{

"case-001":{

"zoom":1.5,

"center":{

"x":620,

"y":315

},

"selected":"loc-001",

"notes":{

"loc-001":"Possible escape route."

}

}

}

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Evidence Database

Selecting evidence with a known location should:

Open City Map

↓

Focus that location

↓

Highlight the corresponding marker

--------------------------------------------------

CCTV Viewer

Selecting a camera should:

Highlight its map marker.

--------------------------------------------------

Messenger

Witness conversations may contain locations.

Clicking a location should:

Open City Map

↓

Focus marker

--------------------------------------------------

Police Mail

Attachments containing locations should:

Open City Map

↓

Jump directly to the specified place.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-column layout.

Tablet

Collapsible sidebars.

Phone

Map fullscreen.

Bottom sheet for location details.

Touch-friendly controls.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Dark CID OS appearance.

Pixel-art icons.

Consistent spacing.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

GPS

Route finding

Real map APIs

Online maps

Live traffic

3D navigation

Street View

Networking

Backend

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 10:

The player can:

\- Explore the investigation map

\- Pan and zoom

\- Browse important locations

\- Filter marker types

\- Search locations

\- Read detailed information

\- Write investigation notes

\- Open related Evidence

\- Open related CCTV

\- Navigate directly from Police Mail

\- Jump between connected applications

The City Map should become the geographical hub of every investigation.

Explain:

\- Map data structure

\- Marker system

\- Event flow

\- Local storage format

\- How Mission 11 (Messenger) will integrate witness conversations with
map locations

Do not continue to Mission 11.
