<!-- kind: results-topic -->
# Compute preflight: representation lifetime matters

**Owned sets:** `AV`

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

## How it was established

The [registration and runner](../research/compute-preflight/audit.cjs) froze the
comparisons and validity gate before any timing. The
[raw receipt](../research/compute-preflight/controller-20260915.json) binds source,
registration, compiler, host, output checks and every timing sample. The
[recording test](../test/test-compute-preflight.js) recomputes grading from that
receipt without rerunning performance measurements; `FINDINGS.json` owns outcomes
and the exact registration/results commit references.

Both variants perform the same biased integer dense layer and symmetric ternary
thresholds on fixed-seed synthetic balanced-trit data, not a trained model or a
representative application dataset. The independent oracle checks intermediate sums and outputs. The
native integer loop is compiled normally with optimization; packed kernels use
feature masks and scalar population counts. Same-code native-control medians
remained within the registered validity band for both confirmatory stages.
The order is deterministic, not randomized or fully position-balanced.

## What it does not show

No result here measures the mini PCs, independent-example AVX2 bit slicing,
distributed execution, task accuracy, training or grokking. The baseline is not
the best possible tuned library. Same-process repetitions do not supply a
population confidence interval or sustained thermal/energy evidence.
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
