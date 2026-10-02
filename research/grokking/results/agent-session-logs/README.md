# Hypernetwork runs recovered from the agent session

These runs were printed to the console by the Antigravity agent session that wrote
research/grokking and research/quantum_grokking (brain dee1dd2e-19f8-49fa-822f-c998e0dc8898,
2026-09-22) and were never saved. results/sweep_summary.json contains only direct-MLP runs.
Copied verbatim from .gemini/antigravity/brain/<id>/.system_generated/steps/<n>/output.txt.

| file | what | status |
| --- | --- | --- |
| step1218 | ternary hypernet, (a+b) mod 23, hidden 64, wd 0.01, 800 ep | memorized @210, test plateau ~37-41% (chance 4.35%); one seed |
| step1216 | same run truncated at 300 epochs | same trajectory |
| step1284 | float quantum hypernet, mod 5, 12 train / 13 test | "grokking event" on a 13-example test set |
| step1338 | ternary quantum hypernet, mod 3 | crashed (backward through graph twice) |
| step1342 | same after the fix | loss 1.0727 at every epoch: no training occurred |

A seed sweep of the step1218 result, with controls, lives in the cluster repo
(experiments/hypernet-grok).
