---
name: self-hosting
description: The machine emulates itself in its own assembly. Two interpreters, three and four levels deep, and a bug of order k that hides at k layers.
type: reference
last_updated: 2026-08-25
---

# Self-hosting

The VM runs an interpreter for itself, written in its own assembly, running inside
itself. Owner: `src/selfhost.js`, `programs/interp.tasm`, `programs/interp-core.tasm`.

## What is established

- **Two interpreters.** The full one is **358 cells**, supports all 25 opcodes and
  nests **3** levels. The core one is **224 cells** with **16** opcode handlers and
  nests **4** - a smaller interpreter buys a deeper stack.
- **Closure under self-interpretation**: the opcode set an interpreter supports is
  derived from its own jump table rather than asserted, so an unsupported opcode
  cannot silently pass.
- **A bug of order *k* is invisible at layer counts divisible by *k*.**
  (`F-ORDER-K-MASKING`.) A defect that inverts something twice disappears at two
  levels and reappears at three. The most unsettling result in the project, and it
  generalises well beyond ternary.
- **Folding buys a depth level**, not merely instructions (`F-FOLD-BUYS-DEPTH`).

## Sub-topics (the rabbit hole)

- Relocatable interpreters: per-level origin and base
- Window fit: why depth is bounded by cells rather than by cleverness
- What the smallest interpreter that still nests would look like
- Whether order-*k* masking has a general detection strategy

## Open questions

- Is depth 4 a hard ceiling for the core interpreter, or only for this one?
- Order-*k* masking was tripped over. Is there a systematic way to **test** for it?
- Nothing has run a program on a switch-level machine. Once
  [09-unbuilt-machine.md](09-unbuilt-machine.md) exists, self-hosting on it is the
  obvious end-to-end check.

## Related pillars

- [01-instruction-set.md](01-instruction-set.md) - the indirect opcodes exist for this
- [11-failure-catalogue.md](11-failure-catalogue.md) - order-*k* masking is a detection problem

## Depth status

**Seeded** (2026-08-25). Behaviour is exhaustively checked in
`test/test-selfhost.js`; the theory of where depth bounds come from is not.
