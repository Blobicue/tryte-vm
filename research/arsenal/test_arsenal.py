"""
test_arsenal.py — Python Integration Tests for Arsenal Manager
"""

import os
import tempfile
import pytest
from research.arsenal.arsenal_manager import (
    list_circuits,
    get_circuit,
    export_circuit,
)
from research.export_to_braid import decode_braid_file


def test_list_circuits():
    circuits = list_circuits()
    assert len(circuits) >= 8
    signatures = [c["signature"] for c in circuits]
    assert "add_mod_3" in signatures
    assert "qutrit_h3" in signatures
    assert "learned_qutrit_add" in signatures


def test_get_circuit():
    c = get_circuit("add_mod_3")
    assert c is not None
    assert c["signature"] == "add_mod_3"
    assert c["verified"] is True
    assert "truth_table" in c or "tasm" in c


def test_export_tasm():
    with tempfile.NamedTemporaryFile(suffix=".tasm", delete=False) as tmp:
        path = tmp.name

    try:
        export_circuit("add_mod_3", path, fmt="tasm")
        assert os.path.exists(path)
        with open(path, "r") as f:
            content = f.read()
        assert "TOP" in content or "HALT" in content
    finally:
        if os.path.exists(path):
            os.remove(path)


def test_export_braid():
    with tempfile.NamedTemporaryFile(suffix=".braid", delete=False) as tmp:
        path = tmp.name

    try:
        export_circuit("qutrit_h3", path, fmt="braid")
        assert os.path.exists(path)
        prog = decode_braid_file(path)
        assert prog["name"] == "qutrit_h3"
        assert prog["word"] == [2, 1, -2, 1, -2]
    finally:
        if os.path.exists(path):
            os.remove(path)


if __name__ == "__main__":
    pytest.main([__file__])
