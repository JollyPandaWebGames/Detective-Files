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

Only implement Mission 11.

Do not continue to future missions.

--------------------------------------------------

MISSION 11

Messenger

--------------------------------------------------

Goal

Replace the placeholder Messenger application with a functional in-game
messaging system.

Messenger allows detectives to communicate with:

\- Witnesses

\- Police officers

\- Detectives

\- Informants

\- Suspects

\- Headquarters

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Messenger application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Split the application into three sections.

LEFT SIDEBAR

Conversation List

CENTER

Chat Conversation

RIGHT SIDEBAR

Contact Information

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

Only display conversations related to the currently selected case.

Global conversations (Headquarters, System) should always be visible.

Listen for:

case:selected

--------------------------------------------------

DATA STRUCTURE

--------------------------------------------------

Load conversations from:

/data/cases/{caseId}/messenger/

Example:

conversation-julia.json

{

"id":"conv-001",

"contactId":"person-012",

"name":"Julia Carter",

"role":"Witness",

"avatar":"julia.png",

"online":false,

"messages":\[

{

"id":"msg-001",

"sender":"Julia Carter",

"timestamp":"2026-02-14T09:15:00",

"text":"I saw someone leaving the museum around 10 PM.",

"attachments":\[\]

}

\]

}

--------------------------------------------------

CONVERSATION LIST

--------------------------------------------------

Display:

\- Avatar

\- Name

\- Role

\- Last Message Preview

\- Timestamp

\- Unread Count

Support:

Scrolling

Selection

Search

--------------------------------------------------

CHAT VIEW

--------------------------------------------------

Display messages as chat bubbles.

Each message contains:

Sender

Timestamp

Text

Attachments

Read status

--------------------------------------------------

MESSAGE TYPES

--------------------------------------------------

Support:

Text

Image

Location

Evidence Reference

Case Reference

System Message

Future-proof the architecture for additional message types.

--------------------------------------------------

ATTACHMENTS

--------------------------------------------------

Supported placeholders:

📷 Image

📍 Location

📄 Document

🔍 Evidence

🎥 CCTV Clip

Clicking an attachment should launch the corresponding application.

--------------------------------------------------

LOCATION LINKS

--------------------------------------------------

Messages may reference locations.

Clicking a location should:

Open City Map

↓

Focus the specified marker.

--------------------------------------------------

EVIDENCE LINKS

--------------------------------------------------

Messages may reference evidence.

Clicking should:

Open Evidence Database

↓

Select the evidence.

--------------------------------------------------

SEARCH

--------------------------------------------------

Search messages by:

Sender

Message text

Contact

Results update instantly.

--------------------------------------------------

PLAYER NOTES

--------------------------------------------------

Each conversation supports detective notes.

Store locally.

Autosave.

--------------------------------------------------

PIN CONVERSATIONS

--------------------------------------------------

Player can pin important conversations.

Pinned conversations appear first.

Persist locally.

--------------------------------------------------

DIALOGUE SYSTEM

--------------------------------------------------

For this mission:

Support branching dialogue structure.

Player responses should be selectable.

Conversation JSON should support:

\- NPC messages

\- Player choices

\- Conditional branches

No gameplay logic yet.

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

messenger:conversation-opened

messenger:message-read

messenger:note-updated

messenger:conversation-pinned

Listen:

case:selected

map:location-selected

evidence:selected

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

Read messages

Pinned conversations

Conversation notes

Last opened conversation

Example:

{

"conv-001":{

"read":true,

"pinned":false,

"notes":"Witness seems nervous.",

"lastMessage":"msg-018"

}

}

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Evidence Database

Evidence links open the corresponding evidence.

--------------------------------------------------

City Map

Location links focus the selected location.

--------------------------------------------------

Police Mail

Emails may instruct the detective to contact someone.

Clicking "Contact Witness" opens Messenger.

--------------------------------------------------

Case Management

Starting a case may automatically unlock new conversations.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-column layout.

Tablet

Collapsible contact list.

Phone

Conversation list

↓

Chat

↓

Contact info

Touch-friendly navigation.

--------------------------------------------------

PIXEL STYLE

--------------------------------------------------

Follow UI_GUIDELINES.md.

Dark CID OS appearance.

Pixel-art avatars.

Consistent spacing.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

Real networking

Typing indicators

Voice messages

Video calls

File uploads

Push notifications

Backend

Authentication

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 11:

The player can:

\- Browse conversations

\- Read witness messages

\- Search conversations

\- Pin important chats

\- Write detective notes

\- Follow links to Evidence Database

\- Follow links to City Map

\- Open Messenger directly from Police Mail

\- Preview branching dialogue structures

Messenger should become the communication hub for every investigation.

Explain:

\- Conversation file structure

\- Dialogue branching architecture

\- Local storage format

\- Event flow

\- How Mission 12 (Criminal Database) will integrate contacts, suspects,
and witness profiles

Do not continue to Mission 12.
