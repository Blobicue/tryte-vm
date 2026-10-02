"""
test_certifier.py — Python pytest Suite for Arsenal Lean 4 Certifier
"""

import os
import pytest
from research.arsenal.arsenal_certifier import (
    certify_circuit,
    certify_all,
)
from research.arsenal.arsenal_manager import get_circuit


def test_certify_add_mod_3():
    res = certify_circuit("add_mod_3")
    assert res["verified"] is True
    assert "add_mod_3_certified" in res["theorem"]
    assert os.path.exists(res["certificate_file"])


def test_certify_t_neg():
    res = certify_circuit("t_neg")
    assert res["verified"] is True
    assert "t_neg_certified" in res["theorem"]


def test_certify_t_cycle():
    res = certify_circuit("t_cycle")
    assert res["verified"] is True
    assert "t_cycle_certified" in res["theorem"]


def test_certify_all():
    results = certify_all()
    assert len(results) >= 8
    for r in results:
        assert r["verified"] is True


if __name__ == "__main__":
    pytest.main([__file__])
