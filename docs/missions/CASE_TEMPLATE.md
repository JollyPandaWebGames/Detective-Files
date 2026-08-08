# CASE_TEMPLATE.md
## Detective Files — Standard Case Documentation Template

Version: 1.0
Applies to: Every investigation from Mission 20 onward (Operation Zero, Case
001, Case 002, Case 003, and any future case).

This template exists so no case needs its own documentation structure
invented from scratch. Copy this file into a new `docs/missions/case-XXX/`
folder, split it across the files below, and fill in each section.

Recommended file split for a case folder:

```
docs/missions/case-XXX/
├── story.md            → Case Information + Story
├── design.md            → Investigation + Resolution
├── media-assets.md      → Media
└── media-prompts.md     → Generation Prompts
```

`QA` lives at the bottom of `design.md` for each case, tracked as a simple
checklist.

---

# Case Information

- **Case ID:**
- **Case Title:**
- **Difficulty:** (Very Easy / Easy / Medium / Hard)
- **Estimated Playtime:**
- **Status:** (Design / In Progress / Content-Complete / Playable / Locked)

---

# Story

## Premise
One or two sentences — what is this case, in-fiction, before the player
opens it.

## Incident
What actually happened, chronologically, from an omniscient point of view.
This is the ground truth the player is meant to uncover — it should not be
handed to the player directly.

## Victim
Name, role, and a short description of who they are and why they matter to
the case.

## Suspects
One entry per suspect: name, role, motive (if guilty), alibi (if
innocent), and what evidence points toward or away from them.

## Witnesses
One entry per witness: name, role, what they know, and how the player
reaches them (Messenger conversation ID, etc).

## Truth
The confirmed solution — who did it, how, why, and when. This section is
the source of truth for `solution.json` and should never be shown to the
player directly; it exists so writers and QA can verify every clue is
consistent with it.

---

# Investigation

## Starting State
What the player has access to the moment the case begins (which apps are
unlocked, which mail is waiting, what phase/state the case starts in).

## Objectives
List every objective by ID, title, and one-line description. Mark hidden
and optional objectives explicitly.

## Dependencies
The dependency graph — which objective unlocks which. A simple ordered or
branching list is fine; see Mission 20's design doc for a worked example.

## Unlocks
Any content gated behind `unlocks.json` rules (people, evidence,
conversations, cameras, forensics, mail) and the condition that reveals
each one.

## Evidence
List every evidence item by ID, title, and category. Note which are
required vs. optional for resolution.

## Locations
List every map location by ID and name, with what's found there.

## Messages
List every Messenger conversation by ID and contact.

## Emails
List every mail item by ID, sender, and purpose (briefing, nudge,
unlock trigger, automatic feedback).

## CCTV
List every camera by ID, location, and what it shows.

## Forensics
List every analysis by ID, the evidence it's run on, and what it reveals.

## Board
Note any board-specific requirements (minimum evidence cards, suspects, or
theories expected before submission feels justified).

---

# Resolution

## Required Evidence
The evidence IDs `solution.json` expects in `requiredEvidence`.

## Required Deduction
The victim / suspect / weapon / location / motive / timeline combination
that constitutes a correct resolution.

## Possible Conclusions
Note whether the case supports only one correct resolution (as of Mission
17, all cases do) or is designed with red herrings that lead to a
plausible-but-wrong submission.

## Success Conditions
What HQ feedback / mail / state the player sees on a correct submission.

## Failure Conditions
What happens on an incorrect or incomplete submission — note that as of
Mission 17 the Resolution Engine allows resubmission rather than a hard
game-over.

---

# Media

List every asset the case requires, split by category. Use the project
asset ID convention from `docs/MEDIA_GENERATION_WORKFLOW.md`
(`TF{mission}-{CATEGORY}-{number}`, e.g. `TF20-CHAR-001`).

## Characters
## Locations
## Evidence
## Documents
## CCTV
## Images
## Videos

For each asset, record: Asset ID, Name, Type, Purpose, Where it appears,
Required/Optional, Generation status.

---

# Generation Prompts

## Google Flow image prompts
One entry per image asset, in the format used in
`docs/missions/mission-20/media-prompts.md`. Every prompt must instruct
Google Flow to reuse the established Detective Files art style, character
designs, environment design, and visual identity rather than redefining
them.

## Google Flow video prompts
One entry per video asset, including scene description, characters,
location, action, camera direction, lighting, duration recommendation,
and transition, in addition to the prompt text itself.

---

# QA

Track each item as Not Started / In Progress / Passed.

- [ ] Gameplay tested — full playthrough start to finish
- [ ] Story tested — no contradictions between story.md and in-game text
- [ ] Evidence tested — every evidence item opens, reads correctly, and
      matches its story.md description
- [ ] Objective flow tested — every objective triggers, unlocks, and
      completes in the intended order, including hidden/optional ones
- [ ] Resolution tested — correct submission succeeds; at least one
      incorrect submission is attempted and handled gracefully
- [ ] Media verified — every Required asset is generated, correctly
      named, and visually consistent with the Character Bible / art style
