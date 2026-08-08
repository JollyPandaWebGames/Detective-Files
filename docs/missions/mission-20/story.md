# Story — Operation Zero
## Detective Files — Mission 20

- **Case Title:** Operation Zero
- **Case ID:** `case-000`

---

## Setting

Downtown, present day. **Third & Main Pawn & Loan**, a small pawn shop at
12 Main Street, is where Danny Cole works the evening shift most
weeknights. The city is otherwise unremarkable — this is a small, local
crime, not a conspiracy.

## Incident

Danny Cole owed Marcus Reed, a debt collector, money from a personal
loan. Reed had visited the shop twice before over the debt, each time
asking the other clerk, Elena Cruz, when Danny would be in. On the night
of July 13th, Reed came in near closing while Elena was already gone for
the evening. A tense exchange at the counter escalated once the shop was
empty — Danny knocked over a stockroom stool backing away from Reed, who
restrained him with a zip tie he'd brought and cut off once Danny
stopped resisting. Reed walked Danny out through the back door and down
the alley, caught on the shop's one rear-facing camera. Danny has not
been seen since.

## Victim

**Danny Cole**, 24, stockroom clerk. Not deeply connected to anything
sinister — just a young guy in over his head with a debt he couldn't pay
back fast enough.

## Initial Report

Danny's car was found still parked outside the shop the next morning,
keys in the ignition. He never came home. Responding officers found the
shop's back room disturbed and logged what they found before Captain
Morgan assigned the case.

## Important Characters

**Marcus Reed**, 38 — debt collector, the suspect. No prior criminal
record, but two unrelated anonymous complaints on file describe him
showing up at people's workplaces over unpaid debts. Danny owed him
money; that debt is the entire motive.

**Captain Morgan** — Chief of Detectives. Assigns the case and provides
the player's in-fiction guidance throughout, via Police Mail.

**Officer Reyes** — processed the scene, logged the physical evidence,
and sends a short follow-up mail pointing the player toward the City Map
and Messenger.

## Witnesses

**Elena Cruz**, 27 — Danny's coworker at the pawn shop. Left about twenty
minutes before Danny usually closed up, so she didn't see what happened,
but she remembers the tense exchange at the counter earlier that
evening and that a man had been asking after Danny for weeks. Reached via
Messenger (`conv-000-1`).

## Initial Evidence

- **Case Brief** (`ev-000-1`) — the official write-up of the
  disappearance.
- **Overturned Stool** (`ev-000-2`) — knocked over during the
  struggle; the first physical sign something went wrong.
- **Cut Zip Tie** (`ev-000-3`) — the restraint Reed used, deliberately
  cut rather than snapped; the key forensic item.
- **Torn Pawn Ticket** (`ev-000-4`) — half a ticket stub with Danny's
  own handwriting on the back naming Marcus Reed and a Friday deadline.
- **Danny's Phone** (`ev-000-5`) — dropped near the back door; the last
  outgoing text corroborates that Reed was there that night.

## Hidden Information

The player does not know Marcus Reed's identity until the forensic
report on the zip tie comes back. Until then, he exists only as "a man"
in Elena's account and an unsigned name on a torn ticket. His Criminal
Database profile (`person-000-2`) is mechanically gated behind that
forensic result (see `unlocks.json`), so the player cannot skip ahead of
the story even by exploring the Criminal Database early.

## Investigation Timeline

| Time | Event | Source |
|---|---|---|
| Prior weeks | Reed visits the shop at least twice asking after Danny. | conv-000-1 |
| ~20:40 | Elena Cruz leaves for the evening; Danny is left closing alone, as usual. | conv-000-1 |
| ~21:00–21:45 | Reed confronts Danny at the counter over the debt. | ev-000-4 |
| ~21:00–21:45 | Struggle in the back room — the stool is knocked over. | ev-000-2 |
| ~21:00–21:45 | Reed restrains Danny with a zip tie, then cuts it free. | ev-000-3, analysis-000-1 |
| ~21:00–21:45 | Danny's phone is dropped near the back door. | ev-000-5 |
| ~21:00–21:45 | Danny is walked out through the back alley. | camera-000-1 |
| Next morning | Danny's car is found still parked outside; he never came home. | Case Brief |

The exact window (21:00–21:45) is deliberately the finest resolution the
case supports — precise-to-the-minute timing isn't the point of a
tutorial case, and the Resolution Wizard's fixed timeline options don't
require finer granularity than this.

## Truth

Marcus Reed restrained and removed Danny Cole from Third & Main Pawn &
Loan on the night of July 13th over an unpaid personal debt. This is
recorded as the authoritative solution in `solution.json`:

- **Victim:** `person-000-1` (Danny Cole)
- **Suspect:** `person-000-2` (Marcus Reed)
- **Weapon/instrument:** `ev-000-3` (Cut Zip Tie)
- **Location:** `loc-000-1` (Third & Main Pawn & Loan)
- **Motive:** Financial
- **Timeline:** 21:00–21:45

## Resolution

Once the player submits a resolution matching the Truth above, Captain
Morgan confirms the conclusion holds up and the case closes as solved.
Operation Zero is intentionally a clean, single-suspect case with no red
herrings — its job is to teach the resolution *process*, not to
challenge the player's reasoning. That challenge starts with Case 001.
