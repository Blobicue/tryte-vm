"""qutrit-enumerate.py -- score every braid word the ternary quantum hypernetwork can emit.

Not a suite. test/test-quantum-line.js runs this when Python with torch is present and
compares its output against its own Node re-implementation of the same circuit, so the
Node version is never an uncompared second implementation. Prints one JSON object:
{"words": [[t1..t6], ...], "scores": [n, ...]} in itertools.product order over
(-1, 0, +1)^6, each score being how many of the 9 inputs of (a+b) mod 3 the circuit's
argmax gets right.

The circuit file is loaded on its own: the research.quantum_grokking package imports a
native library through research.grokking that is not built in any clone, and the circuit
does not need it.
"""
import importlib.util
import itertools
import json
import os
import sys

import torch

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
spec = importlib.util.spec_from_file_location(
    'tqc', os.path.join(ROOT, 'research', 'quantum_grokking', 'ternary_qutrit_circuit.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

circuit = mod.TopologicalQutritCircuit()
a = torch.tensor([i for i in range(3) for j in range(3)])
b = torch.tensor([j for i in range(3) for j in range(3)])
y = (a + b) % 3
words, scores = [], []
with torch.no_grad():
    for w in itertools.product([-1.0, 0.0, 1.0], repeat=6):
        lp = circuit(a, b, torch.tensor(w[:3]), torch.tensor(w[3:]))
        words.append([int(t) for t in w])
        scores.append(int((lp.argmax(-1) == y).sum()))
json.dump({'words': words, 'scores': scores}, sys.stdout)
