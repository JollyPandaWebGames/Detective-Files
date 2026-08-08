# Media Assets — Operation Zero
## Detective Files — Mission 20

Version: 1.0

**Important context before this list:** as of Mission 20, no CID OS
application renders an actual image, photo, or video asset for case
content. Evidence, people, and conversations render via emoji icons
(`PREVIEW_EMOJI`, `avatarEmoji`) and text; CCTV cameras render metadata
(`importantTimestamps`) rather than playing a `video` file; evidence
`thumbnail`/`preview` fields exist in the data schema but are not
consumed by `apps/evidence/index.js`; Case Management does not render a
case's `thumbnail` field either. This is true for Case 001 as well, not
just the tutorial — it is the current state of the engine, not a
tutorial-specific gap.

Because of this, **every asset below is currently Optional / polish**,
per Part 9's "do not overproduce" instruction — none of them are load-
bearing for the tutorial to be understood or completed today. They are
listed so a future pass that wires actual image rendering into these
apps has a ready-made, correctly-scoped asset list rather than needing
to reconstruct one. If/when an app is updated to render one of these
fields, flip its Required column from No to Yes at that time.

---

## CHARACTERS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-CHAR-001 | Danny Cole | Image | Victim portrait | Criminal Database / People profile (not currently rendered — emoji avatar used) | No | Not Generated |
| TF20-CHAR-002 | Marcus Reed | Image | Suspect portrait | Criminal Database profile (not currently rendered) | No | Not Generated |
| TF20-CHAR-003 | Elena Cruz | Image | Witness portrait | Messenger contact avatar (not currently rendered) | No | Not Generated |
| TF20-CHAR-004 | Captain Morgan | Image | HQ sender portrait | Police Mail (not currently rendered) | No | Not Generated |

## LOCATIONS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-LOC-001 | Third & Main Pawn & Loan | Image | Crime scene establishing art | City Map location detail (not currently rendered) | No | Not Generated |
| TF20-LOC-002 | Police Headquarters | Image | Location establishing art | City Map location detail (not currently rendered) | No | Not Generated |
| TF20-LOC-003 | Forensics Laboratory | Image | Location establishing art | City Map location detail (not currently rendered) | No | Not Generated |
| TF20-SCENE-001 | Pawn shop back room (post-incident) | Image | Wide narrative shot of the disturbed scene | Story documentation / no current in-app slot | No | Not Generated |

## EVIDENCE

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-EVIDENCE-001 | Overturned Stool | Image | Evidence photograph | Evidence Database (`ev-000-2.thumbnail`/`preview`, not currently rendered) | No | Not Generated |
| TF20-EVIDENCE-002 | Cut Zip Tie | Image | Evidence photograph, forensics subject | Evidence Database (`ev-000-3`), Forensics Lab (not currently rendered) | No | Not Generated |
| TF20-EVIDENCE-003 | Torn Pawn Ticket | Image | Evidence photograph, motive clue | Evidence Database (`ev-000-4`, not currently rendered) | No | Not Generated |
| TF20-EVIDENCE-004 | Danny's Phone | Image | Evidence photograph | Evidence Database (`ev-000-5`, not currently rendered) | No | Not Generated |

## DOCUMENTS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-DOC-001 | Case Brief | Image | Attachment cover art | Police Mail attachment (`att-000-1`), Evidence Database (`ev-000-1`, not currently rendered) | No | Not Generated |
| TF20-DOC-002 | Pawn Ticket handwriting detail | Image | Close-up legibility asset for the motive clue | Evidence Database detail view (not currently rendered) | No | Not Generated |

## UI / SCREEN CONTENT

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-UI-001 | Operation Zero case thumbnail | Image | Case Management list card art | Case Management (`case-000.json.thumbnail`, not currently rendered) | No | Not Generated |
| TF20-UI-002 | Case Solved artwork | Image | Resolution success feedback | Resolution Wizard / HQ mail (no current image slot in this flow) | No | Not Generated |

## CCTV

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-CCTV-001 | Back Alley Camera — establishing frame | Image | Static frame representing the feed | CCTV Viewer (`camera-000-1.thumbnail`, not currently rendered) | No | Not Generated |
| TF20-CCTV-002 | Back Alley Camera — Reed approaching (t=112s) | Image | Frame matching `importantTimestamps[1]` | CCTV Viewer scrubber preview (not currently rendered) | No | Not Generated |

## CUTSCENES / VIDEOS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-VIDEO-001 | Back Alley Camera footage | Video | Actual playable CCTV clip | CCTV Viewer (`camera-000-1.video`, currently `null` — app has no video player) | No | Not Generated |

Per Part 9, no additional cutscenes are proposed for Mission 20. A
tutorial case does not need cinematic video, and `camera-000-1`'s
`importantTimestamps` metadata already conveys what the footage shows
without a rendered clip.

## OTHER

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| TF20-STORY-001 | "The Confrontation" | Image | Optional narrative illustration | Story documentation / possible future marketing use — no in-app slot | No | Not Generated |

The tooltip highlight effect (`cid-tooltip-target-highlight`) and the
tooltip bubble are pure CSS/DOM, not image assets, and require no
generation.

---

## Summary

- Total assets listed: **20** (4 characters, 3 locations, 1 crime scene,
  4 evidence, 2 documents, 2 UI, 2 CCTV, 1 video, 1 other).
- Required today: **0** — the tutorial is fully playable and
  comprehensible without any of them, because no application currently
  renders these fields.
- Recommended priority if/when image rendering is added to these apps,
  in order of gameplay impact: `TF20-EVIDENCE-002` (the item forensics
  is run on), `TF20-CHAR-002` (the suspect), `TF20-LOC-001` (the crime
  scene), `TF20-UI-001` (case list art), then the rest.
