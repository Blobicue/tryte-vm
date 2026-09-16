# Before the mini-PC pilot

Review date: 2026-09-15. **Readiness verdict: GO for reversible two-node hardware
bring-up and local bench tests, not fleet installation or a network service.**
This review concerns permission to wire and bench-test two machines. It does not
qualify a twelve-node service, approve unattended jobs, or claim a useful learned
model. The user accepted this staged meaning of readiness, permitted scoped local
experiment commits without pushing, and stated that the mini PCs' Windows 10 data
need not be preserved. No disk has been wiped or remote system changed here.

## Goal and the useful next question

Build an exact, reproducible execution substrate which can eventually run useful
ternary inference and independently check candidate circuits. Training may share
its forward operators while retaining explicit update state. Grokking belongs in
the candidate-discovery lane, not in the authority deciding whether a result is
correct. The next hardware question is **which exact workload gains on one 5825U,
then whether independent jobs gain on two of them after all overhead is paid**.

A custom kernel, custom cryptography, general CPU emulation, synchronized training
and a twelve-node rollout are not prerequisites for that question. A minimal Linux
appliance remains a downstream option after the workload earns deployment.

## What logic settles before expensive experiments

1. **The old tryte is not a neural accumulator.** It wraps modulo the VM's fixed
   range. `test-ternary.cjs` checks a witness where repeated positive additions
   wrap negative. For n strict ternary products the exact sum lies in [-n,n]; bias
   shifts both bounds. Choose a wide accumulator, then apply a threshold once.
   Per-term saturation is generally nonassociative; the test carries a witness.
2. **Packed multiplication is exact algebra, not learned approximation.** Dual
   rails compute positive and negative product masks. Nonzero/sign masks compute
   `popcount(active) - 2*popcount(opposite)`. Valid encodings, cleared tails and
   adequate accumulation bounds are premises. Exhausting the local product table
   plus position independence establishes the formula; finite implementation
   checks and mutations examine whether the code obeys it.
3. **Whole-circuit exhaustive enumeration is not the only route.** Prove each
   operator, preserve types/wiring, and induct over a supported finite DAG. This
   proves lowering preserves that circuit, NOT that a learned circuit equals its
   intended target. Candidate equivalence still needs its own exact evidence.
4. **Representation chooses a parallel axis.** Here bits represent features of
   one dot product, followed by a reduction. Independent-example bit slicing has
   different accumulation, transpose and batching costs; these probes do not
   implement or qualify it. A packed word is not a wordful of finished neurons.
5. **Training and inference can share a contract, not their whole cost.** Use
   `predict(state,input)` and `update(state,input,feedback)`. Inventory parameters,
   accumulators, optimizer/counters, RNG and recurrent state. A deterministic
   one-trit update which does not move on one fixed input cannot accumulate that
   identical input without additional state or a changed update rule. This is not
   an impossibility result for discrete learning. No learner is built here.
6. **Communication and checking cannot be wished away.** In a non-overlapped job,
   useful fraction is C/(C+H), with H including transfer, dispatch and verification.
   Target fraction eta needs C >= eta*H/(1-eta). Full controller recomputation caps
   accepted throughput at that controller's checking rate. A content hash or
   signature is not evidence that the computation was done correctly.
7. **Packing is an amortization question.** Preparation P, native repeat cost b,
   packed repeat cost p and reuse R produce a win iff R*(b-p)>P. If p>=b, reuse
   does not rescue the kernel. Nothing here entails lower physical dissipation,
   reversible CMOS, universal speedup or a new learning law.

## What is implemented and what is only a probe

| Artifact | Checks | Does not establish |
|---|---|---|
| `ternary.cjs`, `test-ternary.cjs` | Independent BigInt oracle, scalar and two packed encodings, biased dense sums/thresholds, finite exhaustive and boundary cases, isolated mutations | Native SIMD, learning quality, speed |
| `jobs.cjs`, `test-jobs.cjs` | Bounded typed jobs; content/attempt binding; independent recomputation; commit-once in a controller process; real child crash/timeout/retry; token-scoped cancellation | LAN transport, peer authentication, persistent controller recovery, scalable proof |
| `native.cpp`, `test-native.cjs` | Native integer baseline and feature-packed kernels, exact sums/outputs, actual timed-result check, compiled subject mutations | A deployable worker, optimized-library best performance, all input domains exhausted |
| `audit.cjs` | Frozen profiling contract, same-code timing controls, raw samples, source/compiler/host provenance, no overwrite of receipts | Mini-PC results or statistical independence across repetitions |

The timeout review found and repaired a missing transition: killing a worker did
not revoke its attempt. Cancellation now revokes that exact token before killing,
and cannot cancel a newer retry. Its mutation control reinstates the original
defect. The native review also repaired a check that recomputed outputs before
checking the timed result; a compiled mutation now removes the actual-result
guard and must fail. These are testable corrections, not prediction wins.
An independent scorer-test review also caught a false mutation kill: the healthy
subject failed in its isolated loader because cloned arrays crossed JavaScript
realms. Realm-local fixtures and a healthy control through that identical loader
now prevent this harness fault from masquerading as a caught subject defect.
Ledger integration exposed one more scope bug: a historical criterion census
counted later registrations as members of its original sample. Its check now
projects the exact historical corpus, preserves its annotations and outcomes,
and accepts the real AV extension without classifying it in that older audit.
Subject mutation and historical-edit controls catch the original domain drift.

Run from the repository root:

```text
node research/compute-preflight/test-ternary.cjs
node research/compute-preflight/test-jobs.cjs
node research/compute-preflight/test-native.cjs
node research/compute-preflight/audit.cjs --self-test
node research/compute-preflight/test-audit.cjs
node tools/compute-horizon.js --self-test
node tools/compute-horizon.js --check
```

The native check needs g++ supporting C++17 and `-march=znver3`. This is deliberately
a target-specific binary, not a generic CPU-dispatch library. The existing VM is
unchanged. New preflight commands are explicit and are not silently included in
`npm test`; the recording test will validate the stored profiling receipt without
rerunning timings. Do not mistake the old suite's pass for the new probes running.

## Your switch and the physical layout

The supplied [Amazon listing](https://www.amazon.com/dp/B0CCDBTXPB) identifies a
MokerLink unmanaged switch with 24 Gigabit PoE+ ports, two Gigabit RJ45 uplinks and
two Gigabit SFP slots. The matching
[manufacturer page](https://www.mokerlink.com/index.php?manufacturer_id=24&product_id=525&route=product%2Fproduct)
names POE-G2404GS and supports non-PoE data devices. Its detailed page mixes in
contradictory faster-product specifications; do not treat those as qualification.
Check the unit's physical label and negotiated link speeds during setup. The
Amazon listing says Extend mode reduces ports 17-24 to 10 Mbps. Start with Extend
and any isolation/VLAN DIP modes off, checking the label/manual for the revision.

Use a **physical star**, with whole-job computation as the logical worker pool:

```text
Main PC, dedicated/temporarily repurposed Ethernet -> switch RJ45 uplink
Mini PC A, Ethernet -> switch port 1
Mini PC B, Ethernet -> switch port 2
Remaining mini PCs: disconnected from the pilot
Switch uplink to home router/Internet: none
```

Use ordinary Cat5e-or-better cables and each mini PC's original power adapter.
Do not assume PoE powers the mini PCs; ordinary non-PoE Ethernet uses the ports
for data. This is still a network, even without Internet. The switch is not a
router, DHCP server or security boundary. Start with static addresses, for example
controller 10.77.0.1/24 and workers 10.77.0.11/24, 10.77.0.12/24, **after checking
that subnet does not overlap existing controller/VPN routes**. No gateway or DNS
on the worker interface. Disable worker Wi-Fi; do not enable Internet sharing,
bridging or forwarding on the controller. A controller can retain separate Internet
access only with that separation maintained. Do not configure jumbo frames or
connect redundant switch links for this initial test.

A Gigabit link has a raw ceiling of 125 MB/s per direction; payload throughput is
lower. With one controller link, simultaneous worker transfers share it. The
switch's aggregate marketing bandwidth does not turn that uplink into a faster
one. Keep reusable models/data resident; send bounded jobs and compact outputs.
No extra switch purchase or SFP module is required by this pilot design.

## Sequence and stop gates on the actual hardware

**First: reversible hardware bring-up, not an installer fleet rollout.** Label
only two workers and record model, NIC and storage details. Boot an official
Ubuntu 24.04 LTS Desktop USB in **Try Ubuntu** mode to inspect NIC, thermal sensor
and storage support without formatting disks. The official
[live-USB workflow](https://ubuntu.com/desktop/docs/en/24.04/tutorial/install-ubuntu-desktop/)
offers try/install separately; do not choose install during this reversible step.
Ubuntu 24.04 has standard security maintenance through May 2029 according to its
[release notes](https://documentation.ubuntu.com/release-notes/24.04/).

Stage the exact repository revision, approved Node Linux x64 runtime and native
toolchain offline beforehand; pin versions and verify official download hashes
and signatures. Node documents
[signed checksum verification](https://github.com/nodejs/node#verifying-binaries).
Do not copy the Windows executable onto Linux or assume an offline package install
can fetch missing dependencies. No download, USB write or installation was done in
this review. A temporary Internet-enabled staging machine is separate from workers.

**Then: one actual node.** Repeat all correctness checks, inventory CPU flags and
physical-core/SMT topology, confirm a full-duplex Gigabit link, and run the same
bounded native comparison with a fresh preregistration/receipt for that host. Do
not pool controller and mini-PC timings. A later registered sustained test compares
one core, one worker per physical core, and SMT workers, with affinity and thermal
behavior recorded. The short controller run cannot answer those questions.

**Then: two nodes, independent jobs.** Start with local execution launched at each
console and output comparison. The current IPC prototype does not listen on the
LAN. Network-driven dispatch is a separate step requiring an authenticated,
bounded protocol and restart-persistent admission state. Do not expose this IPC
code as a network service. Ordinary established authenticated transport is an
acceptable pilot baseline; a custom SSH replacement earns its own review and
does not block numerical/hardware qualification.

**Only then decide installation and expansion.** A conventional Ubuntu Server
installation on the first two mini PCs is the reversible architectural choice;
disk erasure itself is not reversible. The user has authorized erasing mini-PC
data, but identify each physical target disk at installation and never select
controller/storage-backup disks. Keep the other ten unchanged until the two-node
gates below have actual receipts. Buildroot/read-only appliance work comes after
the workload/protocol proves useful, not before driver validation.

Expansion requires exact output agreement; actual process failure and persistent
controller restart behavior; no wrong/duplicate admission; measured transfer and
checking overhead; and a preregistered worthwhile throughput benefit on a chosen
useful task. Freeze numerical thresholds and budgets before those measurements.
Failure means stay at one/two nodes or change the workload, not loosen the gate.

## What remains open

- Useful trained model, data/task-quality gate, and real training state inventory.
- Independent-example SIMD, generated circuit lowering, and grokking discovery.
- Actual NIC revision, Linux drivers, sustained clocks, power/energy and cooling.
- Read-only controller inventory found an active Realtek 2.5 GbE Ethernet port
  and disconnected Wi-Fi. Subnet conflicts and physical availability still need
  checking during wiring. The existing port can be repurposed temporarily; if
  keeping Internet access matters, establish separate controller connectivity
  before unplugging its current link, without enabling sharing or bridging.
- Authenticated LAN dispatch, durable job log/checkpoints, restart deduplication,
  software-update/boot trust, and the eventual verification trust/performance tradeoff.
- Actual two-node benefit and subsequent fleet performance.

No horizon attempt is admitted from this preflight. In particular, the physical
bring-up permission does not bypass the stronger H14/H23/H24 qualification gates.
The review intentionally stops before hardware operations and long experiments.

## Local evidence and verdict

The native experiment is durably ordered:

- Registration: `abcfb635adb43439341013328d4e6c95daa75e5d`.
- Raw result: `62ccfaf2c9eaf9e1a74fccba37fcaf76f2a5f6d4`.
- [Original receipt](controller-20260915.json); the authoritative summary is
  [set AV](../../results/09-compute-preflight.md), replay-checked by
  `node test/test-compute-preflight.js` without re-running timings.

The resident-speed prediction held; the repack-both-operands prediction failed.
This supports testing persistent packed representations on the actual target,
not adopting packing for every call. All other shapes are descriptive, no new
winner was selected after timing, and no performance rerun occurred. The controller
is a Ryzen 7800X3D; compilation targeted Zen 3, but that does not make the machine
a 5825U. CPU microarchitecture, memory, power limits and OS still differ.

Arithmetic, actual local child failure/retry, native correctness, scorer mutation
checks and the horizon checker passed their explicit commands above, each with
exit code zero. Independent readers reviewed arithmetic/jobs and the native
instrument/document boundaries. Both final integrated commands, `npm run counts`
and `npm test`, exited zero with **2,164 checks across 60 suites**. Those totals
come from `test/run-all.js`; the separately listed prototype checks are additional,
not silently folded into that count. No performance rerun was used to obtain a
better outcome. `npm run build` was not needed because no `src/` or `programs/`
files changed.

**The next gate is physical evidence from the actual 5825U machines:** live-Linux
hardware/driver inventory, link checks and exact numerical agreement, starting
with one worker and then two. Only after that should target-host performance and
the qualified dispatch path decide installation and expansion. This verdict
authorizes no automatic erasure or network reconfiguration by a future agent.
