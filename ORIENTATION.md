# Where this repository stands

An orientation for whoever arrives after a gap — human or agent. Written 2026-09-22.

This file **narrates and points**. It owns no numbers: every measured figure it
mentions lives in `FINDINGS.json` under the set id cited beside it, and every branch
and commit is named so the claim can be checked with `git log`. If this file and the
manifest disagree, the manifest is right and this file is stale.

It describes branches that are **not on `main`**. That is deliberate — the point is
the map, and the map is currently wider than any one branch.

---

## Three lines, at three altitudes

Several routes have been taken since the project's last shared commit, `a7b452f`.
They are not competing answers to one question. They are answers to different
questions, pursued at different scales.

| line | where | the question it asks | standing |
|---|---|---|---|
| **The instrument** | `main` | can this machine be *measured* affordably and honestly? | merged; one set parked |
| **The compute horizon** | `codex/ternary-compute-horizon` | can ternary be a useful training/inference engine on real hardware? | `PROPOSED`, active |
| **Phinary** | `main`, commit `1506225` | a different base altogether — golden-ratio, Z[φ] | landed, unaudited here |

### The instrument — `main`

This line began as a request for **a ternary compute environment in a browser, on
WebAssembly**, and that request is met. `docs/tryte-lab.html` runs switch-level
sweeps in a browser on a solver the page emits for itself — no committed binary, no
base64 blob, no toolchain. It was opened in a real browser and a full exhaustive
sweep reproduced `Y1` and `Y2`. The older VM page, `docs/tryte-vm.html`, predates all
of it and is plain JavaScript.

The instrument work that grew from it is recorded as prediction sets:

- **`AV`** — a packed-representation solver and a WebAssembly one, held against the
  untouched oracle `src/device.js`. Registered in tension; the two in tension failed
  together, on the premise they shared.
- **`AW`** — the decoded adder's pass-count rule at non-zero carry-in, crossing a
  scope line `F` had written about its own blind spot. All four failed, and the rule
  needed no amendment.
- **`AX`** — where a solver pass actually goes, across conduction, the reachability
  walk and the update loop. All four held.
- **`AY`** — what giving up the walk for frontier relaxation costs, measured at one
  lane before any lane is added. **Complete but not merged**: branch
  `ay-relaxation`, tip `d5bd7b3`. It is the number any bitsliced solver has to beat,
  and it found that relaxation is priced by a network's *depth*, not its edge count.

`design/13-instrument.md` is this line's plan, with each step marked done.

### The compute horizon — `codex/ternary-compute-horizon`

This is where the ambition went after the browser page shipped. The conversation had
moved from *Rust on the ternary VM*, to *bitslicing*, to *getting ternary's
advantages out of binary hardware*. Rust on the VM was shown to be out of reach at
the machine's address width; this line takes the remaining ambition to physical
hardware instead of to a page.

Its plan, `design/13-compute-horizon.md`, describes a training/inference worker
appliance across a physical fleet, with native ternary dense layers and a bounded
two-node preflight under `research/compute-preflight/`. **Its standing is
`PROPOSED`, and its own first paragraph says it is not evidence that the engine,
speedups, learning rules or fleet work yet.** Physical constraints live in
`research/compute-horizon/physical-context.md`.

It was forked from `a7b452f` — **before** any of the instrument sets existed.

### Phinary — `main`

Commit `1506225` adds a phinary memory subsystem, Z[φ] arithmetic, 2D lattice
addressing and a WebAssembly engine, with three test suites. It is not ternary, it
was written by a separate writer, and no prediction set covers it.

---

## The collision, which blocks merging these lines

**Both the instrument line and the compute-horizon line registered sets `AV` and
`AW`, for unrelated subjects.** `design/13-instrument.md` and
`design/13-compute-horizon.md` collide the same way.

**Nobody broke the protocol.** At `a7b452f` the manifest ended at `AU`, so the
scaffold — which derives the next id from the manifest — correctly told *both* lines
they were `AV`. The tooling has no way to see a sibling branch. It is a fork-timing
accident.

It matters because this repository's protocol keys on set id: `registered_at`,
`results_at`, the `at_risk` binding, and the drift check in `test-findings.js`, which
recovers registration text with `git show <registered_at>:<tool>`. Two sets called
`AV` make that lookup ambiguous by construction. And renumbering a set after it is
registered is the one move the protocol exists to forbid.

**Nothing is published.** `origin/main` is still `a7b452f` and neither line's tip is
on any remote branch. The cheap window to decide this is open, and it closes on the
first push — after that, `AGENTS.md`'s rule against rewriting another writer's
commits applies.

---

## Decisions that are open

None of these belong to whoever writes this file.

1. **Which line is canonical** — or whether the two are separate projects that should
   not share one manifest at all. This resolves the collision, and it should be
   decided before either line is pushed.
2. **Whether `AY` merges.** It is complete and its suites pass individually, but
   `main` moved under it: `1506225` touches `build/bundle.js` and
   `docs/tryte-lab.html`, which `AY`'s line also touched. Its full-suite run was
   repeatedly killed by the environment, so its aggregate check count is unconfirmed.
3. **Whether the browser thread continues.** It is finished as asked. Small open
   items remain: `dRippleAdder` ignores its `restore` option, so three rows of the lab
   page's cost table are one design under three labels; and `solver-audit.js --quick`
   can print a verdict that contradicts the manifest.

---

## What carries across the split

Two things from the instrument line are relevant to the compute horizon regardless of
which is canonical:

- **`AY`'s result.** If bitslicing is on the compute horizon's roadmap, the cost of
  replacing a worklist traversal with a sliceable one has already been measured, with
  a mechanism attached.
- **The registration lessons.** The instrument line's sets failed repeatedly on
  predictions that shared one premise, and on constructions specified in prose while
  the predictions beside them were specified adversarially. The notes on `AV`, `AW`,
  `AX` and `AY` in `FINDINGS.json`, and the entries in `results/07-negative.md`,
  record those failures. They are cheaper to read than to repeat.
