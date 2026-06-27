# Detective Files
# CASE_FORMAT.md

Version: 1.0

---

# Purpose

This document defines the standard structure of every investigation.

Every case in Detective Files must follow this format.

The game engine should never contain case-specific logic.

Every investigation is data-driven.

Adding a new case should require only adding new data files.

---

# Philosophy

The engine is permanent.

Cases are content.

The engine never changes because of a new investigation.

---

# Folder Structure

Each case exists inside its own folder.

Example

/cases/

    case_001/

        case.json

        suspects.json

        witnesses.json

        evidence.json

        locations.json

        timeline.json

        emails.json

        messenger.json

        cctv.json

        forensics.json

        board.json

        report.json

        assets/

---

# Required Files

case.json

Main metadata

---

suspects.json

Every suspect

---

witnesses.json

Witnesses

---

evidence.json

Evidence list

---

timeline.json

Chronological events

---

locations.json

Investigation locations

---

emails.json

Police Mail messages

---

messenger.json

NPC conversations

---

cctv.json

Camera recordings

---

forensics.json

Laboratory requests

---

board.json

Investigation Board nodes

---

report.json

Correct solution

---

assets/

Images

Videos

Audio

Documents

PDF

Maps

Icons

---

# Case Metadata

case.json

Example

{
    "id": "case_001",

    "title": "The Missing Scientist",

    "description": "A renowned scientist disappeared from his laboratory.",

    "difficulty": 2,

    "type": "Missing Person",

    "rankRequired": "Rookie",

    "estimatedTime": 45,

    "thumbnail": "cover.png",

    "status": "available"
}

---

# Case Types

Missing Person

Murder

Kidnapping

Robbery

Cyber Crime

Fraud

Espionage

Cold Case

Serial Murder

Special Investigation

---

# Difficulty

1

Very Easy

2

Easy

3

Medium

4

Hard

5

Expert

---

# Suspects

Example

{
    "id": "suspect_01",

    "name": "John Miller",

    "age": 42,

    "occupation": "Lawyer",

    "photo": "john.png",

    "background": "...",

    "motive": "...",

    "alibi": "...",

    "status": "Unknown"
}

Unlimited suspects supported.

---

# Witnesses

Example

{
    "id": "witness_01",

    "name": "Sarah",

    "photo": "sarah.png",

    "statement": "...",

    "trustLevel": 75
}

---

# Locations

Each location

{
    "id": "warehouse",

    "name": "Warehouse",

    "mapPosition":

    {
        "x": 322,

        "y": 148
    },

    "locked": false
}

---

# Timeline

Every important event.

Example

08:00

Victim arrives.

09:30

Phone call.

10:05

Camera loses signal.

11:12

Explosion.

---

# Evidence

Each evidence object

{
    "id": "knife",

    "type": "Weapon",

    "name": "Kitchen Knife",

    "location": "Kitchen",

    "found": false,

    "image": "knife.png",

    "description": "...",

    "tags":

    [

        "Blood",

        "Fingerprint"

    ]
}

---

# Evidence Types

Photo

Video

Audio

Weapon

Fingerprint

DNA

Blood

Document

Email

Phone

GPS

Receipt

Ticket

Map

USB

Computer

Key

Unknown

---

# Police Mail

Every email

{
    "id":"mail_01",

    "from":"Captain",

    "subject":"New Assignment",

    "body":"...",

    "attachments":

    [

        "report.pdf"

    ]
}

---

# Messenger

Conversation tree.

Each message

{

"id":"msg01",

"speaker":"Sarah",

"text":"I saw someone leaving."

}

Future branching supported.

---

# CCTV

Each recording

{

"id":"camera01",

"camera":"Lobby",

"video":"lobby.mp4",

"duration":185,

"importantFrames":

[

53,

118

]

}

---

# Forensics

Each request

{

"id":"dna01",

"type":"DNA",

"duration":120,

"result":"dna_report.pdf"

}

Future real-time waiting supported.

---

# Investigation Board

Nodes

{

"id":"knife",

"type":"Evidence"

}

Connections

{

"from":"knife",

"to":"john"

}

The player creates additional links.

---

# Report

Correct solution.

{

"criminal":"john",

"requiredEvidence":

[

"knife",

"dna",

"camera01"

]

}

---

# Unlock Rules

Cases may require

Rank

Completed Cases

Achievements

Events

Purchased DLC

Season

---

# Rewards

XP

Credits

Achievements

Rank

New Cases

New Applications

---

# Localization

Every text should eventually support localization.

Future structure

/localization

en.json

fa.json

...

Never hardcode user-facing text.

---

# Save Data

Never modify case files.

Player progress belongs inside save files.

Example

Solved Evidence

Found Locations

Opened Emails

Completed Chats

Board Connections

Hints Used

Final Report

Everything is stored separately.

---

# Versioning

Each case contains

"version":"1.0"

Future updates remain compatible.

---

# Validation

Every case should pass validation before loading.

Required

Valid JSON

Unique IDs

Existing assets

Valid references

No duplicated evidence IDs

No duplicated suspect IDs

No broken links

---

# Future Expansion

Cases should support

Voice Acting

Cutscenes

3D Crime Scenes

Multiple Endings

Time Limited Events

Randomized Evidence

AI Generated Witnesses

Community Cases

Without changing the engine.

---

# Golden Rule

The engine knows HOW investigations work.

The case files know WHAT the investigation contains.

Never mix these responsibilities.