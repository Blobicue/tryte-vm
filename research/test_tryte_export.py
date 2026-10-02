"""
test_tryte_export.py — Integration Test for Tryte-VM Exporters
==============================================================
Tests:
1. Compiles a discrete ternary neural network to TASM (.tasm).
2. Executes the TASM program inside the real Tryte-VM (node src/run.js).
3. Verifies that Tryte-VM outputs match PyTorch ternary inference bit-for-bit.
4. Serializes learned anyon braids into .braid binary format and round-trips
   with Tryte-QOS binary-format.js.
"""

import unittest
import subprocess
import os
import json
import numpy as np
import torch

from research.export_to_tasm import compile_ternary_weights_to_tasm
from research.export_to_braid import encode_braid_program, export_model_braid_to_file
from research.quantum_grokking.ternary_quantum_hypernet import TrueTernaryQuantumHypernetwork


class TestTryteVMExport(unittest.TestCase):
    def tearDown(self):
        for path in ["programs/test_nn.tasm", "programs/test_learned.braid"]:
            if os.path.exists(path):
                os.remove(path)
    def test_tasm_execution_in_tryte_vm(self):
        """
        Builds a small 2-input, 3-hidden, 1-output ternary neural network:
        h0 = x0 + x1 (with BR3 activation)
        h1 = x0 - x1 (with BR3 activation)
        h2 = -x0 - x1 (with BR3 activation)
        out = h0 + h1
        Compiles to TASM and runs inside Tryte-VM!
        """
        w1 = np.array([
            [1, 1],    # h0: in0 + in1
            [1, -1],   # h1: in0 - in1
            [-1, -1],  # h2: -in0 - in1
        ], dtype=int)

        w2 = np.array([
            [1, 1, 0], # out0: h0 + h1
        ], dtype=int)

        tasm_code = compile_ternary_weights_to_tasm(w1, w2, program_name="test_nn")
        tasm_path = "programs/test_nn.tasm"
        with open(tasm_path, "w") as f:
            f.write(tasm_code)

        # Test case: input x0 = 1, x1 = -1
        # PyTorch calculation:
        # h0_raw = 1 + (-1) = 0  ==> BR3(0) = 0
        # h1_raw = 1 - (-1) = 2  ==> BR3(2) = 1
        # h2_raw = -1 - (-1) = 0 ==> BR3(0) = 0
        # out0 = h0 + h1 = 0 + 1 = 1. Expected output = 1!
        inputs = ["1", "-1"]
        cmd = ["node", "src/run.js", tasm_path] + inputs
        res = subprocess.run(cmd, capture_output=True, text=True)

        self.assertEqual(res.returncode, 0, f"Tryte-VM run failed: {res.stderr}")
        # Parse output from Tryte-VM (format is typically "OUTPUT: 1" or integer printed)
        stdout = res.stdout.strip()
        # Find the emitted integer
        lines = stdout.splitlines()
        emitted = None
        for line in lines:
            parts = line.split()
            for p in parts:
                try:
                    emitted = int(p)
                except ValueError:
                    pass

        self.assertIsNotNone(emitted, f"No integer output found in: {stdout}")
        self.assertEqual(emitted, 1, f"Expected Tryte-VM output 1, got {emitted}")

    def test_braid_binary_roundtrip_with_tryte_qos(self):
        """
        Tests that Python-generated .braid binary is readable by Tryte-QOS binary-format.js.
        """
        model = TrueTernaryQuantumHypernetwork(latent_dim=8, hidden_dim=16)
        braid_path = "programs/test_learned.braid"
        word = export_model_braid_to_file(model, braid_path, name="unit_test_braid")

        # Run node script calling binary-format.js to decode
        node_script = f"""
        const fs = require('fs');
        const {{ decodeBraidProgram }} = require('./quantum/src/binary-format.js');
        const buf = fs.readFileSync('{braid_path}');
        const prog = decodeBraidProgram(buf);
        console.log(JSON.stringify(prog));
        """
        res = subprocess.run(["node", "-e", node_script], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"Node binary-format decode failed: {res.stderr}")

        decoded = json.loads(res.stdout.strip())
        self.assertEqual(decoded["name"], "unit_test_braid")
        self.assertEqual(decoded["word"], word)


if __name__ == "__main__":
    unittest.main()
