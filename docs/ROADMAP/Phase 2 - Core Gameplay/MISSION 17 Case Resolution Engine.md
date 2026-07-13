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

Only implement Mission 17.

Do NOT continue to future missions.

--------------------------------------------------

MISSION 17

Case Resolution Engine

--------------------------------------------------

GOAL

Implement the complete case resolution workflow.

The detective should not simply choose a suspect.

The detective must prove the case using collected evidence,
investigation progress, and logical deductions.

Mission 17 introduces the Deduction Engine.

--------------------------------------------------

CORE IDEA

--------------------------------------------------

A case is solved by submitting a complete investigation report.

The report is evaluated against the case definition.

The result determines whether the investigation succeeds.

--------------------------------------------------

SOLVE INVESTIGATION

--------------------------------------------------

The Investigation Board contains a button:

Solve Investigation

Selecting it opens the Resolution Wizard.

--------------------------------------------------

RESOLUTION WIZARD

--------------------------------------------------

Multi-step workflow.

Step 1

Choose Primary Suspect.

Step 2

Choose Motive.

Step 3

Choose Murder Weapon.

Step 4

Choose Crime Location.

Step 5

Choose Timeline.

Step 6

Choose Supporting Evidence.

Step 7

Submit Investigation.

--------------------------------------------------

SUPPORTING EVIDENCE

--------------------------------------------------

The player must select evidence items that support the accusation.

Examples:

Fingerprint

DNA

Weapon

Witness Statement

Camera Footage

Phone Record

Financial Report

Every selected item must already exist in the investigation.

--------------------------------------------------

PLAYER THEORIES

--------------------------------------------------

Theory cards created on the Investigation Board should appear
automatically.

The detective may include one or more theories as supporting arguments.

--------------------------------------------------

CASE DEFINITION

--------------------------------------------------

Each case contains its own solution file.

Example:

/data/cases/{caseId}/solution.json

--------------------------------------------------

SOLUTION FORMAT

--------------------------------------------------

Example

{

"suspect":"person-005",

"weapon":"ev-021",

"location":"loc-004",

"motive":"financial",

"requiredEvidence":\[

"ev-011",

"ev-018",

"ev-021"

\],

"optionalEvidence":\[

"ev-030"

\]

}

--------------------------------------------------

VALIDATION

--------------------------------------------------

Validate:

Correct suspect

Correct weapon

Correct location

Correct motive

Required evidence submitted

Required objectives completed

Required forensic reports collected

Required investigation phase reached

--------------------------------------------------

RESULTS

--------------------------------------------------

Possible outcomes:

Perfect Investigation

Successful Investigation

Incomplete Investigation

Incorrect Investigation

Investigation Failed

--------------------------------------------------

SCORING

--------------------------------------------------

Calculate:

Completion %

Correct Evidence %

Optional Objectives %

Unused Evidence

Time Taken

The score is stored for future profile integration.

Do not implement XP yet.

--------------------------------------------------

MISSING INFORMATION

--------------------------------------------------

If required information is missing:

Display recommendations.

Examples

DNA report missing.

Witness not interviewed.

Evidence not examined.

The player may return to the investigation.

--------------------------------------------------

REOPEN INVESTIGATION

--------------------------------------------------

The investigation remains active.

Nothing becomes permanently locked.

Players may continue gathering information before trying again.

--------------------------------------------------

CASE SUMMARY

--------------------------------------------------

Generate a final investigation report.

Include:

Case Name

Suspect

Victim

Weapon

Timeline

Collected Evidence

Forensic Results

Player Theories

Final Verdict

Investigation Score

Completion Time

--------------------------------------------------

APPLICATION INTEGRATION

--------------------------------------------------

Investigation Board

Launches Resolution Wizard.

--------------------------------------------------

Objective Engine

Verifies required objectives.

--------------------------------------------------

Evidence Database

Provides available evidence.

--------------------------------------------------

Criminal Database

Provides suspects.

--------------------------------------------------

Messenger

Provides witness conversations.

--------------------------------------------------

Forensics Lab

Verifies completed analyses.

--------------------------------------------------

Police Mail

Receives Headquarters response after submission.

--------------------------------------------------

HEADQUARTERS RESPONSE

--------------------------------------------------

Generate a local HQ email.

Examples

Excellent work, Detective.

Further evidence is required.

The suspect cannot yet be charged.

The investigation has been closed.

--------------------------------------------------

EVENTS

--------------------------------------------------

Emit:

investigation:submitted

investigation:validated

investigation:completed

investigation:reopened

resolution:generated

--------------------------------------------------

SAVE SYSTEM

--------------------------------------------------

Persist:

Resolution attempts

Best score

Last submission

Generated report

Final outcome

--------------------------------------------------

RESPONSIVE

--------------------------------------------------

Desktop

Full Resolution Wizard.

Tablet

Optimized layout.

Phone

Single-column workflow.

--------------------------------------------------

OUT OF SCOPE

--------------------------------------------------

Do NOT implement:

XP

Rewards

Achievements

Player Rank

Online Leaderboards

Cloud Save

Procedural evaluation

AI-generated reports

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

After Mission 17:

Players can complete an investigation from beginning to end.

The game validates their conclusions.

Cases may succeed, fail, or remain incomplete.

The detective receives a complete investigation report.

Headquarters responds through Police Mail.

Investigation data is persisted for future profile integration.

Explain:

\- Deduction Engine architecture

\- Validation workflow

\- Resolution report generation

\- Scoring model

\- Save format

\- Event flow

\- How Mission 18 (Investigation State Machine) expands investigations
with branching paths, dynamic states, and replay support.

Do not continue to Mission 18.
