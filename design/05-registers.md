<!-- kind: subsystem -->
# 05 — Registers and the write discipline

## Requirement

Hold six trits. Write all six atomically under one enable. Read them without
disturbing them. The machine needs three: the accumulator `A`, the gate/table
control `C`, and the program counter `PC` — plus whatever sequencing turns out to
need ([`09-sequencing.md`](09-sequencing.md)).

Checkably: write a tryte, hold it across an arbitrary number of solves, read it
back; and while enable is low, prove that changing the write data moves nothing.

## What the axioms force

- **The write enable must reach every cell.** Because writes open the feedback
  loop rather than overpowering it ([`02-forbidden.md`](02-forbidden.md)), each
  cell needs its hold signal, and a six-trit register needs that signal fanned out
  six ways. Fan-out is free in this model and is not free in silicon, so every
  register cost here is optimistic by an amount the model cannot express.
  `DERIVED`
- **Reads are free and unlimited.** A stored node can gate any number of devices
  without degrading, by `D5` — the gate is read, never driven through. So a
  register file needs no read ports in the usual sense, which is a large and
  slightly suspicious saving. `MEASURED` for the axiom, `PROPOSED` for the
  conclusion.
- **Nothing yet establishes that a cell's output can drive a selector *terminal***
  rather than a gate. Everything built so far feeds gates. If a register value has
  to pass *through* a selector as data, that is a pass-network read and it has not
  been tested. `PROPOSED`

## Options

| # | register | mechanism | switches (6 trits) | status |
|---|---|---|---|---|
| **R0** | six independent S0 cells, one shared enable | the obvious one | **114** on primary inputs, **66** in place | MEASURED (`J2`) |
| **R1** | six cells, enable **decoded** once and distributed | one detector shared across the register instead of per cell — the same trick that beat the selector tree | ~66 + one decoder | PROPOSED |
| **R2** | six S3 dynamic cells | needs `M1` | **~12** | PROPOSED |
| **R3** | no register circuit — the tryte lives in the solve's seed | `S7` at register scale | **0** | PROPOSED |
| **R4** | master–slave, for a register that can be read and written in the same step | needs `S4` | ~228 | PROPOSED |
| **R5** | shift register — write serially, one trit per step | trades area for steps; a real historical design | ~66 + shift wiring | PROPOSED |

**R1 is worth attention** because it is the same structural move that produced
this project's best circuit: pay for a decode once per *signal* rather than once
per *consumer*. Whether it applies here depends on whether the hold gating can be
driven from a decoded node, which is untested.

**R4 is REQUIRED, and this file predicted the opposite.** The question was whether
a register read in the same solve as its write sees the old value or the new one.
Predicted here: the old one, because the seed is fixed for the whole solve. It sees
the **new** value, on every case tried (`J4`).

The mechanism is exact and obvious in hindsight. While `we` is asserted the
feedback loop is held *open* — that is the whole trick that makes the write
possible at all — so the cell is driven straight from its input and the seeded
value has nothing holding it. **`S0` is a transparent latch, not a flip-flop**, and
a transparent latch is see-through by definition.

Which is why master-slave pairs exist, and it means the register file is **double**
what the rest of this file budgets for it. `MEASURED`

## Interactions

- **[`04-storage.md`](04-storage.md)** decides the per-cell cost; this file just
  multiplies by six and adds enable distribution.
- **[`06-interconnect.md`](06-interconnect.md)**: three registers plus memory
  means values must move between them, and that is where contention lives.
- **[`09-sequencing.md`](09-sequencing.md)**: whether R4 is needed depends
  entirely on what a "step" means, which that file has not settled.
- **[`01-currencies.md`](01-currencies.md)**: enable fan-out is the first cost in
  this project that the model structurally cannot charge for.

## What a measurement phase would register

1. **A six-trit register from six S0 cells**, written and held over all 729 tryte
   values, exhaustively. That is cheap and it is the first sequential thing this
   repository would have measured.
2. **The no-disturb property**: with enable low, sweep the write data over all 729
   values and confirm the held value never moves. This is the check most likely to
   catch a write path that leaks.
3. ~~**Read-while-write**: predicted to see the old value.~~ **Answered, and the
   prediction was wrong** — it sees the new one, every time. `S0` is transparent
   while being written. `R4` master-slave is required and the register file
   doubles. `MEASURED` (`J4`)
4. **R1's decoded enable**, against R0, on switches — predicted to win only when
   the register is wider than the decoder is expensive, which for six trits it may
   not be.

## What is missing from this list

Registers with byte-enables — or trit-enables — where part of a register is
written and part held. Registers that are also counters, which `PC` wants to be
and which would fold an adder into the register rather than beside it. And any
scheme where the register file and the memory are the same structure, which is how
some real machines avoid the distinction entirely.
