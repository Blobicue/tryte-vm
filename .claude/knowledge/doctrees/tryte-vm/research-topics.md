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
| **Which sweepable machine is worth building?** | 8, 9 | new, and it replaced the two topics the H set closed: a full machine can be run but not exhaustively swept, so scope is now a method question rather than a feasibility one | **highest** |
| **Is the MID detector minimal at 4 switches?** | 6, 7 | the `X5` search machinery already exists; this is minutes of work and is paid 18 times over | high |
| **A switch-level multiplier** | 7 | no design phase exists for it; multiplication exists only as a program | medium |
| **Are the 13 failure classes really one?** | 11 | needs defects from a project that is not this one | medium |
| **Carry-in +-1 pass-count walk** | 7 | a scoping gap left open when the carry-in-0 derivation was registered | low |
| **Do any source claims remain unchecked?** | 12 | needs a systematic read of `docs/origin/` against `FINDINGS.json` | low |

## Closed

| Topic | Closed by | Outcome |
|---|---|---|
| Can a 50,000-device network be solved? | `H2`, 2026-08-25 | Yes - the solver is linear, 50,000 devices solve in ~70ms. But a full 531,441-pair sweep fits in an hour only to ~4,800 devices, so the machine can be run and not swept. |
| Charge retention: blast radius | `H3`, `H4`, 2026-08-25 | Zero differences across every gate, every input and the adder swept. A trit cell becomes **one switch**; the 729-word memory drops 48,114 to 4,374 - eleven times, against the five estimated. |

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
