---
name: tryte-vm-research-topics
description: Intake queue for questions that cut across pillars or are not yet shaped enough to be one. Topics graduate into pillar updates, prediction sets, or design documents.
type: queue
last_updated: 2026-08-25
---

# tryte-vm research topics

Questions land here when they cut across pillars or are not yet shaped enough to
become a registered prediction. A session picking up work reads `_overview.md`,
then this queue.

## Active topics

| Topic | Cuts across | Why it is not yet a phase | Priority |
|---|---|---|---|
| **Can a 50,000-device network be solved?** | 4, 9 | needs a profiling harness that does not exist; the answer decides whether the machine is buildable at all | **highest** |
| **Charge retention: blast radius** | 4, 9 | one patched solver and a full suite run would answer it; moves the machine by 5x | **highest** |
| **Is the MID detector minimal at 4 switches?** | 6, 7 | the `X5` search machinery already exists; this is minutes of work and is paid 18 times over | high |
| **A switch-level multiplier** | 7 | no design phase exists for it; multiplication exists only as a program | medium |
| **Are the 13 failure classes really one?** | 11 | needs defects from a project that is not this one | medium |
| **Carry-in +-1 pass-count walk** | 7 | a scoping gap left open when the carry-in-0 derivation was registered | low |
| **Do any source claims remain unchecked?** | 12 | needs a systematic read of `docs/origin/` against `FINDINGS.json` | low |

## Graduation rule

A topic leaves this queue when it becomes one of three things: a **registered
prediction set** with a tool of its own, a **design document** in `design/`, or a
**pillar update** here. Anything that graduates should say in its commit which
queue entry it closes, and this file should lose the row.

A topic that has sat here through three phases without moving is evidence about
priority, not about difficulty. Say so rather than leaving it.

## Intake

New topics come from the **Open questions** section of any pillar. When an open
question is sharp enough that someone could start on it tomorrow, it belongs here
instead.
