# CASE001_DESIGN.md
## "The Missing Scientist" — Case Design Document

Version: 1.0
Case ID: `case-001`
Status: Playable content-complete (data layer). Formal resolution/verdict
mechanic is out of scope until Mission 17 — Case Resolution Engine ships.

---

## 1. Logline

Dr. Emil Rask, a senior biochemist at Valcourt BioLabs, walks into his
private laboratory at 21:40 and never walks out. The building's own
security system confirms it — his badge clocks in, but never clocks out.
The player must work out whether he vanished on his own terms, or whether
someone made sure he never left.

---

## 2. Story Summary

Dr. Rask spent two years developing **RX-7**, an experimental neuro-sedative,
in near-total secrecy — even from his own assistant. On the night of June
28th, he asked his research assistant, Dr. Yara Osei, to leave early and
worked alone. Lobby cameras show him entering at 21:40; an unidentified man
enters roughly two and a half minutes behind him, without signing the
visitor log. The Level 3 corridor camera — the only feed covering the lab
itself — drops signal less than two minutes later.

What's left in the lab tells its own story: an overturned chair, a shattered
beaker that tested positive for a lethal concentration of RX-7 residue, and
a cleanly severed lanyard cord where Dr. Rask's personal USB drive should
have been. The drive — which Yara says held the only copy of his research —
is missing. An anonymous tip places an unmarked van in the building's
service lane around 22:00, corroborated independently by the night security
guard, who also confirms the corridor camera's outage lines up almost
exactly with the intruder's entry.

Nothing about the scene reads as a man walking out under his own power.
Everything about it reads as a targeted, planned extraction — of both the
scientist and his research.

---

## 3. Timeline (Night of June 28th)

| Time  | Event | Source |
|-------|-------|--------|
| 19:00 | Dr. Osei leaves the building for the evening. | conv-001 |
| 21:15 | A witness (Marcus Webb) notices an unmarked van idling in the service lane. | conv-003 |
| 21:40 | Dr. Rask enters the building via the lobby. Badge logged. | camera-01, ev-005 |
| ~21:42–21:43 | An unidentified man enters the lobby ~2m35s later, without signing the visitor log. | camera-01, ev-005 |
| ~21:44 | The Level 3 corridor camera — the only feed covering the lab — loses signal. | camera-02 |
| ~21:45–22:00 (est.) | Struggle in the private laboratory: chair overturned, beaker of RX-7 shattered, lanyard cord cut, USB drive taken. | ev-002, ev-004, ev-006 |
| ~22:00 | Unmarked van seen leaving the service lane. | mail-004, conv-003 |
| June 29, 08:00 | Dr. Osei arrives, finds the lab empty and Dr. Rask's coat still on the chair. Reports him missing. | conv-001 |

No exit badge scan for Dr. Rask exists at any point after 21:40.

---

## 4. Characters

**Dr. Emil Rask** — *Victim.* 54, senior research scientist, 22 years at
Valcourt BioLabs. Secretive, obsessive about his work, carried the only
known copy of his RX-7 research on a personal USB drive worn on a lanyard.

**Dr. Yara Osei** — *Witness.* 29, Rask's research assistant for three
years. Sent home early the night he disappeared. Genuinely distressed;
provides the first thread connecting the missing USB drive to the motive.

**Marcus Webb** — *Witness.* 47, night security guard. Monitored the lobby
and corridor feeds. Initially cagey about the corridor camera outage out of
fear of professional blame; once reassured, corroborates the timing of the
intruder's entry and independently confirms the van sighting from the
anonymous tip.

**Dr. Lena Marsh** — *Forensic Analyst.* 41, City Forensics Laboratory.
Processes fingerprint, DNA, toxicology, and trace evidence for the case;
the player's primary channel for lab results.

**Unidentified Male ("Person of Interest")** — Entered the building ~2.5
minutes behind Dr. Rask without signing in. Partial fingerprint (9 of 12
required points) and a full mitochondrial DNA profile were recovered, but
neither matches any record on file. Description: dark jacket, medium
build, ~180cm.

---

## 5. Evidence Dependency Map

```
ev-001 Case Brief ─────────────┐
                                ├─▶ establishes case, links to ev-002
ev-002 Scene Photographs ──────┤
    │                          ├─▶ shows overturned chair + beaker,
    ├─▶ ev-004 Beaker           │   links to ev-004, ev-006
    └─▶ ev-006 Lanyard Cord ────┘

ev-003 Fingerprint Report ─────▶ analysis-002 (DNA) ─▶ result-002
                                   (unidentified profile, person-003)

ev-004 Shattered Beaker ───────▶ analysis-001 (Fingerprint) ─▶ result-001
                                   (partial print, no match)
                            └──▶ analysis-003 (Toxicology) ─▶ result-003
                                   (RX-7 sedative — reframes case as
                                    abduction, not voluntary absence)

ev-005 Access Log ─────────────▶ confirms entry, no exit — corroborated
                                   by camera-01 and conv-003 (Marcus Webb)

ev-006 Lanyard Cord ────────────▶ analysis-004 (Trace) ─▶ result-004
                                   (clean cut, not torn — the missing USB
                                    drive was a deliberate target, not an
                                    incidental loss)
```

Each forensic result either **reframes** the previous theory (toxicology:
accident → deliberate incapacitation) or **closes a false lead** (trace on
the lanyard: struggle-related damage → premeditated removal). No single
piece of evidence is sufficient on its own — the sedative alone could
suggest an accident in the lab; the cleanly cut cord alone could be
unrelated custodial damage. Together, they support one conclusion.

---

## 6. False Leads (by design)

1. **"He just wandered off distracted."** Early testimony from Dr. Osei
   describes Rask as agitated and secretive that evening — inviting a
   voluntary-disappearance read. The toxicology result on the beaker
   (RX-7 present at incapacitating concentration) closes this off.
2. **"The camera just glitched, nothing to see here."** Marcus Webb's
   reluctance and the vague CCTV note ("feed corrupted") could read as
   ordinary equipment failure. His full messenger interview reveals the
   outage's timing lines up exactly with the intruder's entry — too
   precise to be coincidence, without the game ever stating that outright.
3. **"The beaker just fell in the chaos."** The shattered glass could be
   read as incidental damage from a struggle. The toxicology report
   reframes it as the actual weapon used to incapacitate Dr. Rask.
4. **"The lanyard cord just got caught and snapped."** Plausible until the
   trace analysis (result-004) shows a clean single-blade cut — establishing
   the USB drive, and Rask's research, was the actual target of the
   intrusion.

---

## 7. Application Usage

| Application | Role in this case |
|---|---|
| **Police Mail** | Delivers the case assignment, forensic result summaries, the anonymous tip, and the nudge toward interviewing Marcus Webb. Paces the investigation. |
| **Messenger** | Branching interviews with Dr. Osei (motive/USB drive/witness sighting) and Marcus Webb (CCTV gap, van sighting), plus lab status updates from Dr. Marsh. |
| **Evidence Database** | Six catalogued items spanning documents, photographs, physical evidence, fingerprints, and digital logs. |
| **Forensics Lab** | Four analyses (fingerprint, DNA, toxicology, trace) with authored results and confidence ratings. |
| **CCTV Viewer** | Three camera feeds; the lobby camera and the corrupted corridor feed are the spine of the timing evidence. |
| **City Map** | Five locations (crime scene, HQ, forensics lab, victim's residence, suspect's unconfirmed address) with cross-linked evidence/witness references. |
| **Criminal Database** | All five people in the case, organized by role (Victim, Witness ×2, Officer, Person of Interest), with relationship graphs. |
| **Investigation Board** | Player-assembled — evidence, people, and locations can be pulled in and connected freely; the dependency map above is the intended "solve path" but isn't currently scored by the engine. |

---

## 8. Solution Logic (design intent)

The unidentified male is a hired operative, not personally connected to Dr.
Rask — which is why no relationship, motive, or database match surfaces no
matter how thoroughly the player investigates him directly. The real
throughline is the **RX-7 research itself**: a corporate or state actor
wanted the compound and was willing to incapacitate its inventor to get it.
This is deliberately left unconfirmed within the current data — Mission 22
is expected to introduce the next chapter (identifying who commissioned the
extraction) rather than closing it out in Case 001. Per the design brief,
at least two readings (accident vs. abduction) should remain plausible
until the toxicology and trace results are both in hand.

---

## 9. JSON Organization

```
data/cases/case-001.json          — case card (list/menu metadata)
data/cases/case-001/
    people/        person-001..005 + index.json
    evidence/      ev-001..006 + index.json
    forensics/     analysis-001..004 + results/result-001..004 + index.json
    cctv/          camera-01..03 + index.json
    messenger/     conv-001..003 + index.json
    map/           locations.json
data/mail/         mail-001..007 + index.json   (global inbox, filtered by caseId)
```

All content is pure JSON, consumed by the existing managers
(`EvidenceManager`, `ForensicsManager`, `PeopleManager`, `CctvManager`,
`MessengerManager`, `MailManager`, `MapManager`). No investigation-specific
code was added anywhere in `/apps` or `/managers` — the engine remains
fully case-agnostic, per `CASE_FORMAT.md`.

---

## 10. Known Limitations / Next Steps

- **No resolution/verdict flow yet.** Mission 17 (Case Resolution Engine)
  and Mission 16 (Objective Engine) are still marked "Planned" in the
  roadmap. This case is fully explorable but cannot currently be formally
  "solved" or scored in-app — the Investigation Board's own solve panel
  says as much ("Case resolution will be evaluated in a future mission").
- **Suspect roster is intentionally thin.** Per the original CASE_FORMAT
  spec, a flagship case would carry ~3 suspects; this case currently has
  one unresolved person of interest and no named suspect pool. That's
  consistent with the story (the real antagonist is off-page), but a
  larger future case should introduce a proper suspect line-up once the
  resolution engine exists to score it.
- **Case cover art.** `data/cases/case-001.json` declares a `thumbnail`
  field, but no current UI renders case cover art — the Case Management
  app uses emoji/text cards. Cover art is optional polish, not a
  functional gap.
