# Story — The Missing Scientist
## Detective Files — Case 001

> This file follows the structure of `docs/missions/CASE_TEMPLATE.md`. It
> is adapted from the pre-existing `docs/CASE001_DESIGN.md`, which
> remains the authoritative deep-dive (evidence dependency map, false
> leads by design, application usage table) — this file exists so Case
> 001 has documentation in the same shape as every other case going
> forward, without duplicating that deep-dive unnecessarily.

# Case Information

- **Case ID:** `case-001`
- **Case Title:** The Missing Scientist
- **Difficulty:** Medium
- **Estimated Playtime:** 30 minutes
- **Status:** Playable, content-complete, resolution-scored (Mission 17's
  Resolution Engine now validates a submission against `solution.json` —
  the "no resolution flow yet" limitation noted in the original
  `CASE001_DESIGN.md` has since been resolved by later missions).

# Story

## Premise
A senior biochemist vanishes from his own locked laboratory. Security
footage proves he never walked out the front door.

## Incident
Dr. Emil Rask worked alone on a secret research project. An unidentified
man followed him into the building minutes later; the one camera
covering the lab lost signal shortly after. What's left in the lab — an
overturned chair, a shattered beaker, a cleanly cut lanyard cord where a
USB drive should have been — reads as a planned extraction, not a
voluntary disappearance or an accident.

## Victim
**Dr. Emil Rask**, 54, senior research scientist, 22 years at Valcourt
BioLabs. Secretive about his current project, carried the only known
copy of his research on a personal USB drive.

## Suspects
**Unidentified Male ("Person of Interest")** — entered the building
roughly 2.5 minutes behind Dr. Rask without signing the visitor log. A
partial fingerprint and full mitochondrial DNA profile were recovered
but matched no record on file. This is the confirmed suspect
(`person-003`) per `solution.json`, despite remaining formally
unidentified in-fiction — the case is solvable on physical and
circumstantial evidence even though the suspect is never named.

## Witnesses
**Dr. Yara Osei** — Rask's research assistant; sent home early the night
he disappeared; connects the missing USB drive to a motive.
**Marcus Webb** — night security guard; corroborates the timing of the
intruder's entry and an anonymous van sighting.

## Truth
Dr. Rask was incapacitated with his own experimental sedative (RX-7,
present in the shattered beaker) and his research drive was deliberately
cut from his lanyard and taken. This is recorded in `solution.json`:
victim `person-001`, suspect `person-003`, weapon/instrument `ev-004`
(the beaker), location `loc-001`, motive `theft`, timeline `2145-2215`.
The identity and affiliation of the person who commissioned the
extraction is deliberately left open — see `CASE001_DESIGN.md` §8 for
the design intent behind that choice.

---

For the full timeline, evidence dependency map, false-leads-by-design
breakdown, and per-application usage table, see `docs/CASE001_DESIGN.md`
— it remains more detailed than this template requires and is not
duplicated here to avoid two documents drifting out of sync.
