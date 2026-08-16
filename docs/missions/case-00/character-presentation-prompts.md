# Character Presentation Prompts — Case 00 Tutorial

Version: 1.0

## A note on scope before you use this file

The Case 00 tutorial rewrite this document supports was specified as reusing
**existing** male and female main-character artwork. That artwork does not
exist in this project. Per `docs/missions/case-00/media-prompts.md`, there is
no Character Bible yet, no established male+female detective duo, and the
player character is deliberately generic/unstyled. The tutorial previously
used a single unillustrated mentor ("Senior Detective," emoji-only).

So this rewrite **establishes** two new named characters — **Det. Marcus
Reyes** and **Det. Elena Cho** — as the tutorial's mentor pair, and this file
is their first character bible entry. It is not documenting a redesign of
something that already existed; it's the origin document. Every future
Case 00 (and, if reused, future story-case) prompt for these two should
point back here and use the fixed instruction below so they stay visually
consistent with **each other** going forward.

Per `docs/UI_GUIDELINES.md`, the established visual identity is: low-detail
pixel art, retro desktop OS, police workstation aesthetic, dark theme,
professional, minimal, functional. Both characters should read as competent
CID detectives in that same world — not stylistically distinct from it.

None of these assets are currently required to ship the tutorial — it
renders with emoji portraits today (see `data/tutorial/case-00-dialogue.json`
`speakers.*.emoji`) exactly as the prior single-mentor version did. Generate
art only when/if the project decides to move dialogue portraits off emoji.

---

## Fixed instruction (apply to every prompt below, once art exists)

> Use the established Detective Files character design for Det. Marcus Reyes
> / Det. Elena Cho, as defined in this document and any generated reference
> sheet derived from it. Do not redesign or alter the character's identity,
> clothing, proportions, hairstyle, or established visual style once that
> reference exists.

---

## Base Character Descriptions

**Det. Marcus Reyes (male)** — mid-40s, senior detective, dry and
methodical, plain professional attire (shirt, tie loosened, no jacket
indoors), close-cropped hair, calm and slightly weathered expression.

**Det. Elena Cho (female)** — early-30s, detective, direct and encouraging,
plain professional attire (blazer over a simple top, badge visible),
shoulder-length hair pulled back, alert and approachable expression.

Both: low-detail pixel art, consistent lighting and proportions, clean
background, no text, no watermark, no logos.

---

## Dialogue Portraits (7 expressions × 2 characters)

**Asset ID:** C00-CHAR-005 — **Reyes, Neutral**
**Prompt:** Portrait of Det. Marcus Reyes as described above, neutral
resting expression, facing three-quarters toward camera.

**Asset ID:** C00-CHAR-006 — **Reyes, Explaining**
**Prompt:** Portrait of Det. Marcus Reyes, mid-sentence explaining
expression, one eyebrow slightly raised, mouth open as if speaking.

**Asset ID:** C00-CHAR-007 — **Reyes, Serious**
**Prompt:** Portrait of Det. Marcus Reyes, serious/focused expression,
narrowed eyes, jaw set.

**Asset ID:** C00-CHAR-008 — **Reyes, Surprised**
**Prompt:** Portrait of Det. Marcus Reyes, mildly surprised expression,
eyebrows raised, eyes slightly wider than neutral.

**Asset ID:** C00-CHAR-009 — **Reyes, Thinking**
**Prompt:** Portrait of Det. Marcus Reyes, thoughtful expression, gaze
slightly off-camera, hand near chin optional.

**Asset ID:** C00-CHAR-010 — **Reyes, Encouraging**
**Prompt:** Portrait of Det. Marcus Reyes, small approving half-smile,
warm but understated expression.

**Asset ID:** C00-CHAR-011 — **Reyes, Concerned**
**Prompt:** Portrait of Det. Marcus Reyes, concerned expression, slight
frown, brow lowered.

**Asset ID:** C00-CHAR-012 — **Cho, Neutral**
**Prompt:** Portrait of Det. Elena Cho as described above, neutral resting
expression, facing three-quarters toward camera.

**Asset ID:** C00-CHAR-013 — **Cho, Explaining**
**Prompt:** Portrait of Det. Elena Cho, mid-sentence explaining expression,
engaged and animated, mouth open as if speaking.

**Asset ID:** C00-CHAR-014 — **Cho, Serious**
**Prompt:** Portrait of Det. Elena Cho, serious/focused expression, direct
gaze, mouth set flat.

**Asset ID:** C00-CHAR-015 — **Cho, Surprised**
**Prompt:** Portrait of Det. Elena Cho, surprised expression, eyebrows
raised, mouth slightly open.

**Asset ID:** C00-CHAR-016 — **Cho, Thinking**
**Prompt:** Portrait of Det. Elena Cho, thoughtful expression, gaze
slightly upward or off-camera.

**Asset ID:** C00-CHAR-017 — **Cho, Encouraging**
**Prompt:** Portrait of Det. Elena Cho, genuine encouraging smile, open and
warm expression.

**Asset ID:** C00-CHAR-018 — **Cho, Concerned**
**Prompt:** Portrait of Det. Elena Cho, concerned expression, slight frown,
brow drawn in.

---

## Two-Character Scenes

**Asset ID:** C00-SCENE-001 — **Male speaking / female listening**
**Prompt:** Two-character scene: Det. Marcus Reyes mid-sentence, gesturing
slightly, Det. Elena Cho beside him listening attentively. CID OS office
setting, low-detail pixel art, dark palette.

**Asset ID:** C00-SCENE-002 — **Female speaking / male listening**
**Prompt:** Two-character scene: Det. Elena Cho mid-sentence, gesturing
slightly, Det. Marcus Reyes beside her listening attentively. Same setting
and style as C00-SCENE-001.

**Asset ID:** C00-SCENE-003 — **Both discussing evidence**
**Prompt:** Two-character scene: Reyes and Cho both looking down at a piece
of evidence between them (evidence bag or file), engaged expressions.

**Asset ID:** C00-SCENE-004 — **Both reviewing a case**
**Prompt:** Two-character scene: Reyes and Cho both facing a CID OS
workstation screen, reviewing a case file together.

**Asset ID:** C00-SCENE-005 — **Both reacting to a discovery**
**Prompt:** Two-character scene: Reyes and Cho both reacting with mild
surprise/interest to something just found (off-screen), synchronized
attention toward the same point.

---

## Notes for Whoever Generates These

- Generate the seven Reyes expressions and seven Cho expressions **first**,
  as a reference sheet, before attempting any two-character scene — the
  scenes should reuse that established look rather than being generated
  independently, or the two won't match across images.
- Keep every prompt's fixed instruction verbatim once a reference exists.
- If art direction changes either character's described appearance, update
  the **Base Character Descriptions** section above first, then regenerate
  — don't let individual asset prompts drift from it.
