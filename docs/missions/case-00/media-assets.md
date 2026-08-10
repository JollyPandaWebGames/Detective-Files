# Media Assets — Tutorial Investigation
## Detective Files — Case 00

Version: 1.0

**Status note, carried over from prior case documentation:** as of this
writing, no CID OS application renders an actual image or video asset
for case content — evidence, people, and conversations render via emoji
icons and text, and CCTV cameras render metadata rather than playing a
video file. This is a codebase-wide state, not specific to Case 00. Every
asset below is therefore currently **Optional / polish** — none are
required for the tutorial to be playable or understandable today. They
are listed in full because Case 00 is meant to be the template every
future case's asset list follows, per the brief's closing framing
(STORY → DESIGN → OBJECTIVES → JSON → MEDIA ASSETS → GOOGLE FLOW PROMPTS
→ IMPLEMENTATION → QA → PLAYTEST).

Naming convention: `C00-{CATEGORY}-{number}`, per the brief's own
example (`C00-CHAR-001`, `C00-VIDEO-001`).

---

## CHARACTERS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-CHAR-001 | Detective (player) | Image | Player-facing avatar, if CID OS ever renders one | Not currently rendered anywhere | No | Not Generated |
| C00-CHAR-002 | Nora Finch | Image | Bookstore owner / reporting party portrait | Criminal Database / People profile (not currently rendered) | No | Not Generated |
| C00-CHAR-003 | Callum Voss | Image | Suspect portrait | Criminal Database profile (not currently rendered) | No | Not Generated |
| C00-CHAR-004 | Priya Shah | Image | Witness portrait | Messenger contact avatar (not currently rendered) | No | Not Generated |

## LOCATIONS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-LOC-001 | Police Headquarters | Image | Location establishing art | City Map (not currently rendered) | No | Not Generated |
| C00-LOC-002 | Ellery & Finch Books | Image | Incident location establishing art | City Map (not currently rendered) | No | Not Generated |
| C00-LOC-003 | Pawn shop (secondary) | Image | Secondary location tied to the forensic lead | City Map (not currently rendered) | No | Not Generated |

## EVIDENCE

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-EVIDENCE-001 | Crime scene photograph | Image | Wide shot of the store's stockroom/display case area | Evidence Database (not currently rendered) | No | Not Generated |
| C00-EVIDENCE-002 | Broken display case latch | Image | Physical evidence photograph | Evidence Database (not currently rendered) | No | Not Generated |
| C00-EVIDENCE-003 | Pawn shop receipt | Image | Document evidence, forensic subject | Evidence Database, Forensics Lab (not currently rendered) | No | Not Generated |
| C00-EVIDENCE-004 | CCTV screenshot | Image | Still frame from the bookmarked timestamp | Evidence Database / CCTV Viewer (not currently rendered) | No | Not Generated |
| C00-EVIDENCE-005 | Forensic report | Image | Report cover art | Forensics Lab (not currently rendered) | No | Not Generated |

## UI / DOCUMENTS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-DOC-001 | Police report | Image | Case brief cover art | Police Mail attachment (not currently rendered) | No | Not Generated |
| C00-DOC-002 | Email attachment icon | Image | Attachment thumbnail | Police Mail (not currently rendered — attachments render as a generic icon+name) | No | Not Generated |
| C00-DOC-003 | Investigation Board cards | Image | Card background/frame art | Investigation Board (cards currently render as plain text/emoji nodes, not styled cards) | No | Not Generated |

## CCTV

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-CCTV-001 | CCTV scene (establishing) | Image | Static frame representing the storefront camera feed | CCTV Viewer (not currently rendered) | No | Not Generated |
| C00-CCTV-002 | Important timestamp frame | Image | Frame matching the bookmarked moment (Callum alone, lights off) | CCTV Viewer (not currently rendered) | No | Not Generated |

## COMPLETION

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-UI-001 | Investigation Complete artwork | Image | Tutorial completion screen art (T00-13) | Resolution feedback / tutorial completion message (no current image slot in this flow) | No | Not Generated |

## CUTSCENES / VIDEOS

| Asset ID | Name | Type | Purpose | Used in | Required | Status |
|---|---|---|---|---|---|---|
| C00-VIDEO-001 | Opening Investigation Briefing | Video | Sets the tone for the case assignment | No current video player in Police Mail / Case Management | No | Not Generated |
| C00-VIDEO-002 | CCTV Suspicious Moment | Video | Dramatizes the moment referenced by T00-08's bookmarked timestamp | CCTV Viewer has no video player currently (`camera.video` is unused) | No | Not Generated |
| C00-VIDEO-003 | Investigation Completion | Video | Reusable "case closed" moment for T00-13 and future cases | No current video slot in the resolution/completion flow | No | Not Generated |

---

## Summary

- Total assets listed: **20** (4 characters, 3 locations, 5 evidence, 3
  UI/documents, 2 CCTV, 1 completion, 3 video).
- Required today: **0**, for the same engine-wide reason documented in
  every other case's media-assets.md.
- Recommended priority if/when image rendering is added: `C00-CHAR-003`
  (the suspect), `C00-EVIDENCE-003` (the receipt forensics runs on),
  `C00-LOC-002` (the incident location), `C00-UI-001` (completion
  screen), then the rest.
