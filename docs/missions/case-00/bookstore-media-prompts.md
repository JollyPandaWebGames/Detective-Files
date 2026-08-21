# Bookstore Media Prompts — Case 00 Tutorial

Version: 1.0

This document supplements `docs/missions/case-00/media-prompts.md` with a
focused, complete set of Google Flow prompts for the Bookstore location
(`loc-00-2`, in-world name **Ellery & Finch Books**), covering every asset
slot the City Map / Evidence / CCTV integration in Part 3–5 of this task
can use.

`C00-LOC-002` in `media-prompts.md` already covers the exterior
establishing shot and remains the canonical prompt for that asset — it is
repeated here (word-for-word, same Asset ID) purely so this file is a
complete, one-stop reference for every Bookstore asset rather than
requiring the reader to cross-reference two documents.

None of these assets are currently required to ship — City Map, Evidence,
and CCTV all render today with emoji markers / no location art. Generate
art only if/when an application is updated to actually display an image
in that slot.

---

## Fixed instruction (apply to every prompt below)

> Use the established Detective Files art style, environment design,
> lighting language and visual identity. Maintain consistency with
> existing game environments.

Per `docs/UI_GUIDELINES.md`, that established visual identity is:
low-detail pixel art, retro desktop OS, police workstation aesthetic,
dark theme, professional, minimal, functional. Nothing below should read
as fantasy, medieval, cyberpunk, or otherwise inconsistent with that.

---

## 1. Bookstore Exterior

**Asset ID:** C00-LOC-002
**Asset:** Ellery & Finch Books — Exterior
**Purpose:** City Map / investigation-location establishing art.
**Prompt:** Use the established Detective Files art style, environment
design, lighting language and visual identity. Maintain consistency with
existing game environments. Pixel-art exterior of a small street-corner
bookstore at night, "Ellery & Finch Books" signage above the door, warm
window light spilling onto a dark street, a single display window facing
the street, believable modern bookstore (not antique/fantasy), consistent
perspective with existing game locations, low-detail retro aesthetic, no
characters, no unnecessary text beyond the shop sign, no watermark.

## 2. Bookstore Interior

**Asset ID:** C00-LOC-002-INT
**Asset:** Ellery & Finch Books — Interior
**Purpose:** Investigation-location detail art (Evidence Database /
location detail panel).
**Prompt:** Use the established Detective Files art style, environment
design, lighting language and visual identity. Maintain consistency with
existing game environments. Pixel-art interior of a small, believable
modern bookstore suited to an investigative police-mystery atmosphere:
tall bookshelves along the walls, a checkout counter near the entrance
with a visible till, a small reading area with a chair near a window, a
locked display case (glass front, visibly forced open) near the counter
as the incident's focal point, muted evening lighting, low-detail retro
aesthetic, clearly recognizable as a bookstore, no characters, no
unnecessary text, no watermark.

## 3. Bookstore Map Icon / Marker

**Asset ID:** C00-LOC-002-ICON
**Asset:** Ellery & Finch Books — Map Marker
**Purpose:** City Map marker icon (replaces/augments the generic 📍
default marker for this location's type).
**Prompt:** Use the established Detective Files art style, environment
design, lighting language and visual identity. Maintain consistency with
existing game environments. Small low-detail pixel-art icon of an open
book or a bookshelf silhouette, designed as a map pin/marker glyph,
single flat dark-theme color palette matching existing City Map markers,
readable at small size (roughly 24x24px), simple silhouette with minimal
internal detail, no text, no watermark, transparent background.

## 4. Bookstore Investigation Location Illustration

**Asset ID:** C00-LOC-002-INV
**Asset:** Ellery & Finch Books — Investigation Illustration
**Purpose:** Larger illustrative panel for the City Map location detail
view or a case-briefing screen.
**Prompt:** Use the established Detective Files art style, environment
design, lighting language and visual identity. Maintain consistency with
existing game environments. Pixel-art wide illustration of the bookstore
storefront and immediate street from an investigator's approach angle,
believable modern bookstore suitable for the Detective Files world,
investigative/police-mystery atmosphere (quiet street, isolated pool of
light, no crowds), bookshelves visible through the window, entrance door
slightly ajar, consistent perspective with existing game locations,
low-detail retro aesthetic, no unnecessary text, no watermark.

## 5. Bookstore Evidence Scene

**Asset ID:** C00-LOC-002-EVID
**Asset:** Broken Display Case (in situ)
**Purpose:** Evidence Database photograph for the display-case-latch
evidence item, shown inside the bookstore rather than as an isolated
prop shot.
**Prompt:** Use the established Detective Files art style, environment
design, lighting language and visual identity. Maintain consistency with
existing game environments. Pixel-art close-in scene inside the
bookstore showing a glass display case with its latch forced open, case
contents disturbed, checkout counter and bookshelves visible in the
background, dim interior lighting typical of a break-in discovered after
hours, low-detail retro aesthetic, no characters, no unnecessary text, no
watermark.

## 6. Bookstore CCTV Scene

**Asset ID:** C00-LOC-002-CCTV
**Asset:** Bookstore Storefront — CCTV Frame
**Purpose:** Static CCTV frame for `camera-00-1`, matching the City
Map's `relatedCameras` link for this location.
**Prompt:** Use the established Detective Files art style, environment
design, lighting language and visual identity. Maintain consistency with
existing game environments. Low-fidelity black-and-white or desaturated
pixel-art CCTV still frame looking down at the bookstore's front door
and window from a corner-mounted angle, timestamp burned into the
bottom-left corner in a simple monospace font, faint scanline/grain
texture consistent with existing CCTV frames in the project, no
identifiable character faces, no watermark.

---

## Notes

- All prompts above target the same in-world location as `loc-00-2` in
  `data/cases/case-00/map/locations.json` (display name "Ellery & Finch
  Books"). The tutorial and City Map search refer to it by the generic
  term "Bookstore" (see `bookstore`/`book store`/`books` in that
  location's `keywords` array) so the player can find it without already
  knowing its proper name — the art and copy should stay Ellery & Finch
  Books; do not rename the in-fiction location to literally "Bookstore."
- If art is generated for #3 (map marker), `MARKER_TYPES` in
  `apps/city-map/index.js` needs a new entry (or the location's `type`
  needs to change from `Incident Location` to a type already in that
  map) before the custom icon can actually be wired in — currently
  `Incident Location` falls through to `DEFAULT_MARKER` (📍). That's an
  application code change, not a docs change, and is out of scope here.
