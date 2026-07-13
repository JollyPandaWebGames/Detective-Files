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

Only implement Mission 12.

Do not continue to future missions.

--------------------------------------------------

MISSION 12

Criminal Database

--------------------------------------------------

Goal

Replace the placeholder Criminal Database application with a complete
people database.

The Criminal Database stores information about every person involved in
an investigation.

This includes:

\- Suspects

\- Victims

\- Witnesses

\- Police Officers

\- Detectives

\- Persons of Interest

\- Unknown Individuals

Everything is loaded from local JSON files.

No backend.

--------------------------------------------------

APPLICATION

--------------------------------------------------

Replace the placeholder Criminal Database application.

The application must extend BaseApp.

Open inside the standard Window component.

--------------------------------------------------

LAYOUT

--------------------------------------------------

Split the window into three sections.

LEFT SIDEBAR

Categories

\- All People

\- Suspects

\- Witnesses

\- Victims

\- Officers

\- Detectives

\- Persons of Interest

\- Unknown

CENTER PANEL

People List

RIGHT PANEL

Profile Details

--------------------------------------------------

CASE INTEGRATION

--------------------------------------------------

Only display people related to the currently selected case.

Listen for:

case:selected

--------------------------------------------------

DATA STRUCTURE

--------------------------------------------------

Load data from:

/data/cases/{caseId}/people/

Example:

person-001.json

{

"id":"person-001",

"name":"Julia Carter",

"role":"Witness",

"age":31,

"occupation":"Museum Curator",

"status":"Interviewed",

"avatar":"julia.png",

"description":"Witness present during the theft.",

"knownAliases":\[\],

"knownAddresses":\[

"Museum District"

\],

"relatedEvidence":\[

"ev-002",

"ev-005"

\],

"relatedLocations":\[

"loc-001"

\],

"relatedMessages":\[

"conv-001"

\],

"notes":""

}

--------------------------------------------------

PEOPLE LIST

--------------------------------------------------

Display:

\- Avatar

\- Name

\- Role

\- Status

\- Last Updated

Support:

Scrolling

Sorting

Selection

--------------------------------------------------

SEARCH

--------------------------------------------------

Search by:

\- Name

\- Alias

\- Occupation

\- Role

\- Description

Results update instantly.

--------------------------------------------------

FILTERS

--------------------------------------------------

Support filters:

Role

Status

Occupation

--------------------------------------------------

PROFILE DETAILS

--------------------------------------------------

Display:

Avatar

Name

Role

Age

Occupation

Description

Known Aliases

Known Addresses

Current Status

Related Evidence

Related Locations

Related Conversations

Detective Notes

--------------------------------------------------

DETECTIVE NOTES

--------------------------------------------------

Player can write notes for every person.

Autosave locally.

--------------------------------------------------

PIN PEOPLE

--------------------------------------------------

Player can mark important people.

Pinned profiles appear first.

Persist locally.

--------------------------------------------------

RELATIONSHIPS

--------------------------------------------------

Display known relationships.

Example:

Friend

Family

Coworker

Employer

Business Partner

Unknown

Clicking a related person opens their profile.

--------------------------------------------------

APPLICATION SHORTCUTS

--------------------------------------------------

Each profile provides quick actions:

Open Evidence

Open Messenger

Open City Map

Future:

Open Investigation Board

--------------------------------------------------

STATUS SYSTEM

--------------------------------------------------

Support statuses:

Unknown

Interview Pending

Interviewed

Suspect

Cleared

Arrested

Missing

Deceased

--------------------------------------------------

EVENTS

--------------------------------------------------

Use EventBus.

Emit:

person:selected

person:pinned

person:note-updated

Listen:

case:selected

messenger:conversation-opened

evidence:selected

map:location-selected

--------------------------------------------------

LOCAL STORAGE

--------------------------------------------------

Persist:

Pinned people

Detective notes

Last selected profile

Example:

{

"person-001":{

"pinned":true,

"notes":"Possible motive: financial problems.",

"lastViewed":true

}

}

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Messenger

Opening a conversation may highlight the contact's profile.

--------------------------------------------------

Evidence Database

Evidence mentioning a person should open their profile.

--------------------------------------------------

City Map

Locations related to a person can be opened directly.

--------------------------------------------------

Police Mail

Emails may contain references to people.

Selecting the reference should open the corresponding profile.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Three-column layout.

Tablet

Collapsible sidebar.

Phone

Category selector

↓

People list

↓

Profile details

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

Facial recognition

Automatic suspect scoring

Criminal record editing

Online databases

Networking

Backend

Authentication

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 12:

The player can:

\- Browse all people involved in the case

\- Search and filter profiles

\- Read detailed information

\- View relationships

\- Pin important people

\- Write detective notes

\- Open related Evidence

\- Open related Messenger conversations

\- Open related City Map locations

\- Navigate seamlessly between connected applications

The Criminal Database should become the central repository for every
person involved in an investigation.

Explain:

\- People data structure

\- Relationship system

\- Local storage format

\- Event flow

\- How Mission 13 (Forensics Lab) will enrich profiles with laboratory
results

Do not continue to Mission 13.
