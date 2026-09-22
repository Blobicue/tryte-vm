<!-- kind: results-topic -->
# Compute preflight: representation lifetime matters

**Owned sets:** `AV` `AW`

## What is established

On the recorded controller workload, resident nonzero/sign feature packing beat
the native int8 dense-layer baseline: median speed ratio **3.7953** (`AV1`, held).
Repacking both inputs and weights for every batch reversed that result: native
time divided by packed-path time was **0.36066** (`AV2`, failed), approximately
**2.77 times slower**. The failed prediction is retained.

These are measured workload/host-specific results. The useful interpretation is
that data residency and conversion cost belong in the design, not that the
arithmetic format alone determines speed. A resident-weight/new-input workload
was not measured and must not be inferred from either endpoint.

The preregistered replay on one Ryzen 7 5825U worker reproduced both directions,
with both ratios farther from parity. Resident sign-packed execution was **5.9582 times
faster** than the native int8 baseline (`AW1`, held): **46.3795 us** native versus
**7.78417 us** packed. When both operands were repacked, native time divided by
packed-path time was **0.31784** (`AW2`, held): **46.5825 us** native versus
**146.5601 us** packed, making the packed path approximately **3.146 times
slower**. This is a one-node replication of the cost-boundary direction, not an
estimate of the cluster or of every 5825U.

## How it was established

The [registration and runner](../research/compute-preflight/audit.cjs) froze the
comparisons and validity gate before any timing. The
[raw receipt](../research/compute-preflight/controller-20260915.json) binds source,
registration, compiler, host, output checks and every timing sample. The
[recording test](../test/test-compute-preflight.js) recomputes grading from that
receipt without rerunning performance measurements; `FINDINGS.json` owns outcomes
and the exact registration/results commit references.

The [worker registration and runner](../research/compute-preflight/worker-audit.cjs)
froze `node-ecd2b9`, Linux/x64, the Ryzen 7 5825U identity, compiler flags,
capabilities, workload and same-code control band before timing. Its
[raw receipt](../research/compute-preflight/worker-node-ecd2b9-20260921.json)
records the exact registered source hashes, host, compiler, all samples, clean
pre/postflight state and unchanged governor observations. The same recording
test replays its scorer from retained samples only; CI does not rerun timing.

Both variants perform the same biased integer dense layer and symmetric ternary
thresholds on fixed-seed synthetic balanced-trit data, not a trained model or a
representative application dataset. The independent oracle checks intermediate sums and outputs. The
native integer loop is compiled normally with optimization; packed kernels use
feature masks and scalar population counts. Same-code native-control medians
remained within the registered validity band for both confirmatory stages.
The order is deterministic, not randomized or fully position-balanced.

## What it does not show

The worker result measures exactly one mini PC in one short, single-threaded
process. Neither result measures independent-example AVX2 bit slicing,
multi-core or SMT scaling, distributed execution, task accuracy, training,
inference quality or grokking. The benchmark packs **features within one dense
dot product** into bits; it does not place independent examples in bit lanes.
Consequently it is evidence about a low-level arithmetic kernel and conversion
boundary, not evidence that a useful ternary neural network trains or infers
faster. The baseline is not the best possible tuned library. Same-process
repetitions do not supply a population confidence interval or sustained
thermal/energy evidence.
The stage called end_to_end repacks both operands into preallocated storage but
excludes allocation, validation, model loading, launching and network costs.
Correctness fixtures do not exhaust all full-size inputs; symbolic algebra and
finite implementation checks have distinct scope.

The [pilot review](../research/compute-preflight/README.md) gives the next gates,
including why local IPC crash recovery is not a qualified network service.

## Owned sets

| set | scope |
|---|---|
| `AV` | Native controller dense-layer profiling, with a retained conversion-cost failure |
| `AW` | One-node Ryzen 7 5825U replay of the same feature-packing boundaries; both registered directions held |
