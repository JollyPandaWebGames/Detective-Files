You are continuing development of Detective Files.

The game's operating system is called CID OS.

Before implementing anything, read and strictly follow:

\- ARCHITECTURE_2.md

\- ARCHITECTURE.md

\- PROJECT_SPEC.md

\- ROADMAP.md

\- UI_GUIDELINES.md

\- CODING_STYLE.md

\- APP_SDK.md

\- CASE_FORMAT.md

These documents are the project's single source of truth.

Only implement Mission 21.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 21

Case 001 — The First Murder

--------------------------------------------------

GOAL

Create the first real investigation after the tutorial.

This case establishes the quality standard for every future
investigation.

The investigation must feel like an authentic detective experience
rather than a tutorial.

Everything remains fully data-driven.

No investigation-specific JavaScript.

--------------------------------------------------

CASE OVERVIEW

--------------------------------------------------

Case ID

case001

Case Name

The First Murder

Difficulty

Easy

Estimated Play Time

30–45 minutes

Victim

One victim

Suspects

3

Witnesses

3–5

Crime Scene

1 main location

Evidence

15–20 pieces

Emails

6–10

Messenger conversations

10–15

CCTV clips

3–5

Forensic reports

2–3

Objectives

20–30

--------------------------------------------------

DESIGN GOALS

--------------------------------------------------

Teach investigation thinking.

Introduce uncertainty.

Allow exploration.

Reward observation.

Require deduction.

Avoid obvious solutions.

--------------------------------------------------

CASE STRUCTURE

--------------------------------------------------

Phase 1

Assignment

Receive HQ briefing.

Review initial evidence.

--------------------------------------------------

Phase 2

Crime Scene

Inspect evidence.

Review CCTV.

Visit location.

--------------------------------------------------

Phase 3

Witnesses

Interview witnesses.

Compare testimonies.

Discover contradictions.

--------------------------------------------------

Phase 4

Laboratory

Request analyses.

Wait for reports.

Interpret forensic results.

--------------------------------------------------

Phase 5

Deduction

Connect evidence.

Identify inconsistencies.

Build theories.

--------------------------------------------------

Phase 6

Resolution

Submit investigation.

Receive Headquarters evaluation.

--------------------------------------------------

INVESTIGATION DESIGN

--------------------------------------------------

Every clue should answer one question while creating another.

Avoid linear storytelling.

Allow players to investigate in different orders.

No random guessing.

Every conclusion must be supported by evidence.

--------------------------------------------------

FALSE LEADS

--------------------------------------------------

Include believable but fair misleading information.

Examples

Witness mistake

Old evidence

Incomplete CCTV angle

Suspicious but innocent behavior

Players should eliminate these through investigation.

--------------------------------------------------

EVIDENCE QUALITY

--------------------------------------------------

Every evidence item must have a purpose.

No filler evidence.

Each item should:

Reveal information

Support another clue

Contradict testimony

Unlock new content

Confirm a theory

--------------------------------------------------

APPLICATION USAGE

--------------------------------------------------

Every CID OS application should contribute meaningfully.

Case Management

Police Mail

Messenger

Evidence Database

City Map

CCTV Viewer

Criminal Database

Forensics Lab

Investigation Board

--------------------------------------------------

BOARD REQUIREMENTS

--------------------------------------------------

The player must connect:

People

Locations

Evidence

Timeline events

Before resolving the investigation.

--------------------------------------------------

SOLUTION

--------------------------------------------------

The solution must not become obvious too early.

At least two suspects should remain plausible until late in the
investigation.

--------------------------------------------------

HEADQUARTERS

--------------------------------------------------

Use Police Mail to guide pacing.

HQ should:

Request updates.

Deliver new evidence.

Approve laboratory requests.

Comment on investigation progress.

--------------------------------------------------

CASE DATA

--------------------------------------------------

All content must remain external.

Suggested structure:

/cases/case001/

case.json

objectives.json

states.json

solution.json

unlocks.json

emails.json

messages.json

evidence.json

locations.json

people.json

cctv.json

forensics.json

timeline.json

board.json

--------------------------------------------------

CASE DOCUMENTATION

--------------------------------------------------

Generate:

CASE001_DESIGN.md

Include:

Story summary

Timeline

Character profiles

Evidence relationships

Investigation phases

Solution logic

Dependency graph

--------------------------------------------------

GAMEPLAY REQUIREMENTS

--------------------------------------------------

The investigation must be completable without hints.

Every required conclusion must be obtainable from available evidence.

Players should never need outside knowledge.

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Tablet

Phone

Entire investigation must function correctly on all supported devices.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

No XP.

No rewards.

No achievements.

No profile progression.

No daily systems.

No online features.

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 21:

Detective Files contains its first complete murder investigation.

The case demonstrates every core gameplay system built in previous
missions.

Case 001 becomes the reference implementation for every future
investigation.

Generate:

CASE001_DESIGN.md

Explain:

\- Case architecture

\- Narrative structure

\- Investigation flow

\- Evidence dependency

\- Solution validation

\- JSON organization

\- How Mission 22 will build upon this foundation by introducing higher
difficulty, multiple investigation paths, and more complex deduction.

Do not continue to Mission 22.
