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

Only implement Mission 06.

Do not continue to future missions.

--------------------------------------------------

MISSION 06

Police Mail

--------------------------------------------------

Goal

Replace the placeholder Police Mail application with a functional
in-game email system.

Police Mail is the primary way detectives receive assignments, reports,
lab results, and messages from headquarters.

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Police Mail application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Three-panel layout.

Left Sidebar

Folders:

• Inbox

• Starred

• Archive

• Sent (read-only)

Center Panel

Email list.

Right Panel

Selected email content.

--------------------------------------------------

EMAIL DATA

--------------------------------------------------

Load emails from:

/data/mail/

Each email contains:

{

"id":"mail-001",

"caseId":"case-001",

"from":"Captain Morgan",

"subject":"Case Assignment",

"date":"2026-06-29 08:30",

"priority":"High",

"read":false,

"starred":false,

"attachments":\[

"case-report.pdf"

\],

"body":"Detective, your next assignment is attached..."

}

--------------------------------------------------

EMAIL LIST

--------------------------------------------------

Display:

\- Read/Unread indicator

\- Sender

\- Subject

\- Date

\- Priority badge

\- Attachment icon

Unread emails should be visually highlighted.

--------------------------------------------------

EMAIL VIEW

--------------------------------------------------

Display:

\- Sender

\- Subject

\- Date

\- Priority

\- Body

\- Attachment list

Support vertical scrolling.

--------------------------------------------------

ATTACHMENTS

--------------------------------------------------

Display attached files.

Examples:

📄 Case Report

🖼 Crime Scene Photo

📋 Witness Statement

🧪 Lab Request

For this mission:

Attachments are view-only placeholders.

Opening an attachment displays a placeholder preview window.

--------------------------------------------------

EMAIL ACTIONS

--------------------------------------------------

Support:

\- Mark as Read

\- Mark as Unread

\- Star

\- Unstar

\- Archive

All changes are saved locally.

--------------------------------------------------

SEARCH

--------------------------------------------------

Search emails by:

\- Sender

\- Subject

\- Body

Filtering updates instantly.

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

When the player starts a case in Case Management:

If that case has unread emails,

Automatically:

\- Open Police Mail (if not already open)

\- Highlight the related email

\- Scroll to it

\- Select it

The player should immediately receive their assignment.

--------------------------------------------------

DAILY HQ MAIL

--------------------------------------------------

Support system messages that are not tied to a case.

Examples:

\- Daily Challenge

\- Promotion

\- New Case Available

\- CID News

\- System Update

These use:

caseId = null

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

\- Read status

\- Starred

\- Archived

Example:

{

"mail-001":{

"read":true,

"starred":false,

"archived":false

}

}

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Events:

mail:loaded

mail:selected

mail:read

mail:archived

mail:starred

case:started

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-panel layout.

Tablet

Collapsible folder sidebar.

Phone

Single-column navigation:

Folders

↓

Email List

↓

Email Content

Maintain the CID OS visual style.

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

Real networking

Sending emails

Replying

Forwarding

Attachments with real content

Evidence integration

Notifications

Audio

Backend

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 06:

The player can:

\- Browse emails

\- Read case assignments

\- Search messages

\- Archive emails

\- Star important messages

\- Persist email state locally

\- Automatically receive case assignment emails when starting
investigations

Police Mail should now feel like a genuine detective communication
system.

Explain:

\- Mail data structure

\- Local storage format

\- Event flow

\- How Mission 07 (Evidence Database) will use email attachments

Do not continue to Mission 07.
