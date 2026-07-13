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

Only implement Mission 20.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 20

Tutorial Investigation — Operation Zero

--------------------------------------------------

GOAL

Create the first fully playable investigation.

This is both:

\- the game's interactive tutorial

\- the first detective case

The player must naturally learn every major mechanic while solving the
investigation.

No external tutorial screens.

No long explanations.

The investigation itself teaches the player.

--------------------------------------------------

CASE OVERVIEW

--------------------------------------------------

Case Name

Operation Zero

Difficulty

Very Easy

Estimated Play Time

15–20 minutes

Purpose

Teach the player how Detective Files works.

--------------------------------------------------

LEARNING PRINCIPLES

--------------------------------------------------

Teach by doing.

Every mechanic is introduced only when needed.

Players should never feel they are reading documentation.

--------------------------------------------------

MECHANICS TO TEACH

--------------------------------------------------

Starting an Investigation

Case Management

Reading Police Mail

Reading Messenger conversations

Viewing Evidence

Inspecting Evidence

Using the City Map

Watching CCTV footage

Requesting a forensic analysis

Waiting for timed reports

Viewing Criminal Database

Connecting evidence on the Investigation Board

Creating a Theory

Reviewing Objectives

Tracking Progress

Submitting a Resolution

Reading Headquarters feedback

--------------------------------------------------

APPLICATION ORDER

--------------------------------------------------

The investigation should naturally guide the player.

Example

Case Management

↓

Police Mail

↓

Evidence Database

↓

Messenger

↓

City Map

↓

CCTV Viewer

↓

Forensics Lab

↓

Criminal Database

↓

Investigation Board

↓

Solve Investigation

--------------------------------------------------

INVESTIGATION DESIGN

--------------------------------------------------

Simple missing-person case.

No complex twists.

One suspect.

One victim.

One crime scene.

One witness.

One CCTV clip.

One forensic report.

Small evidence set.

--------------------------------------------------

OBJECTIVES

--------------------------------------------------

Approximately 10–15 objectives.

Every objective introduces one new mechanic.

--------------------------------------------------

GUIDANCE

--------------------------------------------------

The game should provide subtle guidance.

Examples

Highlight desktop icon.

Highlight new email.

Highlight evidence.

Highlight objective.

Highlight button.

Never interrupt gameplay with modal tutorial windows.

--------------------------------------------------

TOOLTIPS

--------------------------------------------------

Small contextual tips.

Appear once.

Automatically disappear.

Can be disabled in Settings.

--------------------------------------------------

ERROR TOLERANCE

--------------------------------------------------

Players should not become stuck.

If no progress is made for a while:

Highlight the next objective.

Generate a Headquarters reminder email.

--------------------------------------------------

ACTIVE INVESTIGATION WIDGET

--------------------------------------------------

The widget should clearly display:

Current objective

Progress

Current phase

Suggested next action

--------------------------------------------------

POLICE MAIL

--------------------------------------------------

Headquarters should communicate naturally.

Examples

Welcome Detective.

Please review the evidence.

Forensics report is ready.

Excellent work.

Investigation completed.

--------------------------------------------------

MESSENGER

--------------------------------------------------

Witness conversations teach dialogue mechanics.

--------------------------------------------------

FORENSICS

--------------------------------------------------

Use one timed laboratory report.

Completion should trigger:

Notification

Email

Objective update

--------------------------------------------------

INVESTIGATION BOARD

--------------------------------------------------

Require at least:

Three evidence cards

One suspect

One theory

Before allowing case submission.

--------------------------------------------------

CASE RESOLUTION

--------------------------------------------------

The player submits the investigation.

The Resolution Engine validates it.

Generate a Headquarters response.

--------------------------------------------------

ACCESSIBILITY

--------------------------------------------------

Players may restart the tutorial investigation at any time.

--------------------------------------------------

DATA

--------------------------------------------------

Everything must remain JSON-driven.

No tutorial logic hardcoded into applications.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

No achievements.

No XP.

No rewards.

No player profile.

No daily cases.

No branching endings.

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 20:

A completely new player can understand how Detective Files works without
external instructions.

Every major CID OS application is introduced naturally.

The investigation demonstrates the complete gameplay loop from beginning
to end.

Explain:

\- Tutorial structure

\- Learning progression

\- Objective flow

\- Application sequence

\- How player guidance works

\- JSON structure used for the tutorial investigation

Do not continue to Mission 21.
