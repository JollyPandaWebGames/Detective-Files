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

Only implement Mission 08.

Do not continue to future missions.

--------------------------------------------------

MISSION 08

Evidence Database

--------------------------------------------------

Goal

Replace the placeholder Evidence Database application with a fully
functional evidence management system.

The Evidence Database is the central repository for every investigation.

Evidence can originate from:

\- Police Mail attachments

\- Crime scenes

\- CCTV exports

\- Forensics reports

\- Witness interviews

\- Future gameplay systems

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Evidence Database application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Three-panel layout.

LEFT SIDEBAR

Evidence Categories

\- All Evidence

\- Physical Evidence

\- Documents

\- Photographs

\- Digital Files

\- Fingerprints

\- DNA

\- Other

CENTER PANEL

Evidence List

RIGHT PANEL

Evidence Details

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

Only display evidence belonging to the currently selected case.

Changing the active case updates the evidence list automatically.

Listen for:

case:selected

--------------------------------------------------

DATA STRUCTURE

--------------------------------------------------

Load evidence from:

/data/cases/{caseId}/evidence/

Each evidence item:

{

"id":"ev-001",

"caseId":"case-001",

"title":"Bloody Kitchen Knife",

"category":"Physical Evidence",

"type":"weapon",

"status":"Collected",

"location":"Kitchen",

"collectedBy":"Officer Smith",

"date":"2026-01-18",

"description":"A stainless steel kitchen knife with visible blood
stains.",

"thumbnail":"knife.png",

"preview":"knife_large.png",

"tags":\[

"weapon",

"blood",

"kitchen"

\],

"related":\[

"ev-003",

"ev-008"

\]

}

--------------------------------------------------

EVIDENCE LIST

--------------------------------------------------

Display:

\- Thumbnail

\- Evidence ID

\- Title

\- Category

\- Status

Support:

\- Sorting

\- Scrolling

\- Selection

--------------------------------------------------

SEARCH

--------------------------------------------------

Instant search.

Search:

\- Title

\- Description

\- Tags

\- Evidence ID

--------------------------------------------------

FILTERS

--------------------------------------------------

Filter by:

Category

Status

Tags

Filters update instantly.

--------------------------------------------------

DETAIL PANEL

--------------------------------------------------

Display:

Evidence ID

Title

Category

Description

Location Found

Collected By

Collection Date

Status

Tags

Related Evidence

Player Notes

--------------------------------------------------

PLAYER NOTES

--------------------------------------------------

Allow detectives to write personal notes.

Store locally.

Autosave.

--------------------------------------------------

PINNED EVIDENCE

--------------------------------------------------

Player can mark evidence as Important.

Pinned evidence appears first.

Persist locally.

--------------------------------------------------

RELATED EVIDENCE

--------------------------------------------------

Clicking a related evidence item immediately opens it.

--------------------------------------------------

PREVIEW PANEL

--------------------------------------------------

Support placeholder previews.

Images

Display large preview.

Documents

Display placeholder page.

Fingerprints

Display placeholder forensic image.

DNA

Display placeholder DNA report.

Video

Display placeholder until CCTV Viewer exists.

--------------------------------------------------

CHAIN OF CUSTODY

--------------------------------------------------

Display read-only history.

Collected

Transferred

Analyzed

Archived

Future missions will extend this.

--------------------------------------------------

MAIL INTEGRATION

--------------------------------------------------

When opening an attachment from Police Mail:

Automatically:

Open Evidence Database

↓

Focus corresponding evidence

↓

Highlight item

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

evidence:selected

evidence:opened

evidence:pinned

evidence:note-updated

Listen:

case:selected

mail:attachment-opened

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

Pinned evidence

Player notes

Last selected evidence

Scroll position

Example:

{

"ev-001":{

"favorite":true,

"notes":"Knife matches witness statement.",

"lastViewed":true

}

}

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-column layout.

Tablet

Collapsible sidebar.

Phone

Navigation:

Categories

↓

Evidence List

↓

Evidence Details

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

Evidence editing

Deleting evidence

Real image viewer

Video playback

Forensics integration

Investigation Board integration

Achievements

Backend

Authentication

Networking

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 08:

The player can:

\- Browse evidence

\- Search evidence

\- Filter evidence

\- Read detailed evidence information

\- Preview evidence

\- Pin important evidence

\- Write investigation notes

\- Open evidence directly from Police Mail

\- Persist notes and favorites locally

The Evidence Database should become the central repository for every
investigation.

Explain:

\- Evidence file structure

\- Storage format

\- Event flow

\- How Mission 09 (CCTV Viewer) will integrate with Evidence Database

Do not continue to Mission 09.
