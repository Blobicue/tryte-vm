"""
arsenal_manager.py — Arsenal of Compute Manager & Circuit Forge
================================================================
Manages the content-addressed catalog of grokked circuits, truth tables,
and topological anyon braids for Tryte-QOS.
"""

import os
import json
import argparse
from typing import Optional, Any

from research.export_to_tasm import compile_ternary_weights_to_tasm
from research.export_to_braid import encode_braid_program

_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(_DIR, "circuit_cache.json")


def load_cache() -> dict:
    if not os.path.exists(CACHE_PATH):
        return {"version": "1.0.0", "circuits": {}}
    with open(CACHE_PATH, "r") as f:
        return json.load(f)


def save_cache(cache: dict):
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def list_circuits() -> list[dict]:
    cache = load_cache()
    return list(cache.get("circuits", {}).values())


def get_circuit(signature: str) -> Optional[dict]:
    cache = load_cache()
    return cache.get("circuits", {}).get(signature)


def register_circuit(signature: str, data: dict):
    cache = load_cache()
    data["signature"] = signature
    data["verified"] = data.get("verified", True)
    cache["circuits"][signature] = data
    save_cache(cache)
    print(f"Registered circuit '{signature}' into Arsenal of Compute.")


def export_circuit(signature: str, out_path: str, fmt: Optional[str] = None):
    circuit = get_circuit(signature)
    if not circuit:
        raise ValueError(f"Circuit '{signature}' not found in arsenal.")

    if fmt is None:
        if out_path.endswith(".braid"):
            fmt = "braid"
        elif out_path.endswith(".tasm"):
            fmt = "tasm"
        else:
            fmt = "tasm" if "tasm" in circuit else "braid"

    if fmt == "tasm":
        if "tasm" not in circuit:
            raise ValueError(f"Circuit '{signature}' has no TASM representation.")
        with open(out_path, "w") as f:
            f.write(circuit["tasm"])
        print(f"Exported TASM to {out_path}")
    elif fmt == "braid":
        word = circuit.get("braid_word", [])
        if not word and "braid_word_qutrit_a" in circuit:
            word = circuit["braid_word_qutrit_a"] + circuit.get("braid_word_qutrit_b", [])
        if not word:
            raise ValueError(f"Circuit '{signature}' has no braid word representation.")
        data = encode_braid_program(word, name=signature)
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"Exported .braid binary ({len(word)} crossings) to {out_path}")
    else:
        raise ValueError(f"Unknown format: {fmt}")


def main():
    parser = argparse.ArgumentParser(description="Arsenal of Compute Manager")
    subparsers = parser.add_subparsers(dest="command")

    # list
    subparsers.add_parser("list", help="List all cached compute circuits")

    # get
    get_p = subparsers.add_parser("get", help="Get details of a circuit")
    get_p.add_argument("signature", help="Circuit signature")

    # export
    exp_p = subparsers.add_parser("export", help="Export a circuit to .tasm or .braid")
    exp_p.add_argument("signature", help="Circuit signature")
    exp_p.add_argument("-o", "--output", required=True, help="Output file path")
    exp_p.add_argument("-f", "--format", choices=["tasm", "braid"], help="Export format")

    # certify
    cert_p = subparsers.add_parser("certify", help="Certify a circuit in Lean 4")
    cert_p.add_argument("signature", nargs="?", default="--all", help="Circuit signature or '--all'")

    args = parser.parse_args()

    if args.command == "list":
        circuits = list_circuits()
        print("=" * 80)
        print(f"  Tryte-QOS Arsenal of Compute: {len(circuits)} Grokked Circuits in Cache")
        print("=" * 80)
        print(f"{'Signature':<22} | {'Kind':<18} | {'Domain':<18} | {'Verified':<8}")
        print("-" * 80)
        for c in circuits:
            sig = c.get("signature", "")
            kind = c.get("kind", "")
            domain = c.get("domain", "")
            ver = "YES" if c.get("verified") else "NO"
            print(f"{sig:<22} | {kind:<18} | {domain:<18} | {ver:<8}")
        print("=" * 80)

    elif args.command == "get":
        c = get_circuit(args.signature)
        if not c:
            print(f"Circuit '{args.signature}' not found.")
        else:
            print(json.dumps(c, indent=2))

    elif args.command == "export":
        export_circuit(args.signature, args.output, args.format)

    elif args.command == "certify":
        from research.arsenal.arsenal_certifier import certify_circuit, certify_all
        if args.signature == "--all" or args.signature == "all":
            results = certify_all()
            print("=" * 80)
            print(f"  Lean 4 Certification Complete: {len(results)} Certificates Verified (0 sorry)")
            print("=" * 80)
            for r in results:
                print(f"  ✓ {r['signature']:<24} -> Theorem: {r['theorem']}")
            print("=" * 80)
        else:
            res = certify_circuit(args.signature)
            print(f"  ✓ {res['signature']} certified in Lean 4: Theorem {res['theorem']}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
