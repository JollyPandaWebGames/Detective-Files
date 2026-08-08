# MEDIA_GENERATION_WORKFLOW.md
## Detective Files — Media Generation Workflow

Version: 1.0

This document defines the standard process for taking a case from design
to fully illustrated, playable content. It applies to Mission 20 and every
case that follows it.

---

## 1. Naming Convention

Every asset gets a stable, unique ID before a single prompt is written.
IDs never change once assigned — if an asset is regenerated or replaced,
the ID stays the same and only the underlying file is swapped.

```
TF{mission-or-case-number}-{CATEGORY}-{number}
```

- `TF` — project prefix ("The Files" / Detective Files), constant.
- `{mission-or-case-number}` — `20` for the tutorial, `01`/`02`/`03` for
  Cases 001–003, and so on. Always two digits.
- `{CATEGORY}` — one of the fixed category codes below.
- `{number}` — three-digit, sequential within that case + category,
  starting at `001`.

| Category code | Used for |
|---|---|
| `CHAR`      | Character portraits |
| `LOC`       | Location artwork |
| `SCENE`     | Crime scene compositions |
| `EVIDENCE`  | Evidence photographs |
| `DOC`       | In-fiction documents (letters, reports, tickets) |
| `REPORT`    | Police / forensic report imagery |
| `CCTV`      | CCTV frame stills |
| `BOARD`     | Investigation Board content (pins, photos, connectors) |
| `STORY`     | Story / narrative illustrations |
| `UI`        | Loading screens, transitions, mission-complete art |
| `HINT`      | Tutorial visual hint graphics |
| `VIDEO`     | Any video clip |

Examples:

```
TF20-CHAR-001       Danny Cole portrait
TF20-LOC-001        Third & Main Pawn & Loan exterior
TF20-EVIDENCE-001   Cut zip tie photograph
TF20-DOC-001        Case Brief document art
TF20-CCTV-001       Back Alley Camera frame
TF20-VIDEO-001      Suspect confrontation clip
```

---

## 2. The Ten-Step Process

1. **Design the case.** Story, characters, evidence, and objective flow
   are finalized in `story.md` and `design.md` before any art is
   commissioned. Media should never be generated ahead of design — it
   causes rework when the story changes.

2. **Define the asset list.** Every visual and video the case needs is
   enumerated in `media-assets.md`, each with a stable Asset ID, marked
   Required or Optional. Optional assets are cut first if scope needs to
   shrink.

3. **Create image prompts.** Every Required (and any approved Optional)
   asset gets a full Google Flow prompt in `media-prompts.md`, written
   against the established Detective Files art style, character designs,
   environment design, and visual identity — never redefining them.

4. **Generate assets in Google Flow.** Run each prompt. Generate a small
   number of variants per asset (2–3) rather than iterating prompt
   wording repeatedly; if none of the variants work, revise the prompt
   once and regenerate.

5. **Review visual consistency.** Check every generated asset against the
   Character Bible and existing art (wallpapers, prior case assets) for
   the same case. Reject anything that redesigns a character's
   appearance, breaks the pixel-art / retro-OS visual identity, or
   introduces a color palette outside the established dark theme.

6. **Rename assets using project IDs.** The chosen file is renamed to its
   Asset ID plus the correct extension (e.g. `TF20-CHAR-001.png`). No
   asset is imported under a generator-assigned filename.

7. **Import assets.** Approved files are placed under the case's asset
   directory (mirroring the pattern used for existing case cover art,
   e.g. `data/cases/case-000/assets/`).

8. **Connect assets to case data.** The corresponding JSON field
   (`thumbnail`, `preview`, `video`, `avatarEmoji` → avatar image, etc.)
   is updated to reference the asset's filename. Note: as of Mission 20,
   most evidence/CCTV apps render icon-based previews rather than actual
   images — confirm an app actually displays a given field before
   spending generation budget on it (see `media-assets.md` "Generation
   status" column).

9. **Test inside CID OS.** Open the case in-game (or via the relevant
   app in isolation) and confirm the asset renders correctly at its
   actual display size, in both the default and any alternate theme.

10. **Mark asset as approved.** Update the "Generation status" column in
    `media-assets.md` from `Not Generated` → `Generated` → `Approved`.
    An asset is only "Approved" once it has passed step 9.

---

## 3. Video Guidance

- Prefer 5–15 second clips over long cinematic sequences.
- Every video prompt must specify: scene description, characters,
  location, action, camera direction, lighting, duration recommendation,
  and transition — not just the visual prompt text.
- Do not create video for content a static image or in-app UI can convey
  just as well (e.g. don't animate a document the player can just read).
- CCTV footage does not need to be a rendered video at all unless a case
  specifically calls for motion; a still frame plus `importantTimestamps`
  metadata (see `CASE_FORMAT.md`) is sufficient for most cases, including
  Mission 20.

---

## 4. Scope Discipline

Mission 20 and every subsequent case should feel polished, not
overproduced:

- Generate only assets that directly support gameplay comprehension —
  evidence the player inspects, people they talk to, places they visit.
- Do not generate cinematic sequences that don't change what the player
  understands or does.
- When in doubt, cut the optional asset and ship the required one.
