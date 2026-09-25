"""
audit_soundness.py — Exhaustive Meta-Theoretical Audit of Lean 4 Codebase
========================================================================
Scans every .lean file in quantum/lean/ and verifies:
1. Every theorem has 0 sorry admissions (outside comments).
2. Every theorem depends on 0 custom axioms (permitting only standard Lean 4 kernel foundations: propext, Quot.sound, Classical.choice).
3. No theorem statement is a vacuous reflexivity tautology (f(x) = f(x) or True).
"""

import os
import glob
import subprocess
import re

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
LEAN_DIR = os.path.join(ROOT_DIR, "quantum", "lean")

DEFECTS = []

def strip_lean_comments(text):
    # Remove block comments /- ... -/
    text = re.sub(r"/-\*(.*?)\*-/", "", text, flags=re.DOTALL)
    text = re.sub(r"/-(.*?)-/", "", text, flags=re.DOTALL)
    # Remove single line comments -- ...
    lines = [re.sub(r"--.*$", "", line) for line in text.splitlines()]
    return "\n".join(lines)
STANDARD_AXIOMS = {"propext", "Quot.sound", "Classical.choice"}

def audit_file(filepath):
    relpath = os.path.relpath(filepath, ROOT_DIR)
    raw_content = open(filepath, "r", encoding="utf-8").read()
    code_only = strip_lean_comments(raw_content)

    # 1. Check for 'sorry' in actual code
    if re.search(r"\bsorry\b", code_only) or re.search(r"\badmit\b", code_only):
        DEFECTS.append((relpath, "CRITICAL", "Admission 'sorry' or 'admit' found in active code"))

    # 2. Extract definitions and theorems with accurate namespace tracking
    theorems = []
    defs = {}
    ns_stack = []
    lines = raw_content.splitlines()
    for i, line in enumerate(lines):
        line_s = line.strip()
        if line_s.startswith("namespace "):
            ns_stack.append(line_s.split()[1])
        elif line_s.startswith("end"):
            parts = line_s.split()
            if len(parts) > 1 and ns_stack and parts[1] == ns_stack[-1]:
                ns_stack.pop()
            elif len(parts) == 1 and ns_stack:
                ns_stack.pop()
        elif line_s.startswith("def "):
            m_def = re.match(r"def\s+([A-Za-z0-9_]+)\s*(?::\s*[^:=]+)?\s*:=\s*(.+)", line_s)
            if m_def:
                defs[m_def.group(1)] = m_def.group(2).strip()
        elif line_s.startswith("theorem "):
            match = re.match(r"theorem\s+([A-Za-z0-9_]+)", line_s)
            if match:
                th_name = match.group(1)
                full_name = ".".join(ns_stack + [th_name]) if ns_stack else th_name
                # Grab statement up to :=
                full_stmt = line_s
                j = i + 1
                while ":=" not in full_stmt and j < len(lines):
                    full_stmt += " " + lines[j].strip()
                    j += 1
                theorems.append((th_name, full_name, full_stmt))

    # 3. Check for vacuous tautologies in theorem statements
    for th_name, full_name, stmt_line in theorems:
        eq_match = re.search(r":\s*(.+?)\s*:=\s*(?:by)?", stmt_line)
        if eq_match:
            stmt = eq_match.group(1).strip()
            if stmt == "True":
                DEFECTS.append((relpath, "HIGH", f"Tautological theorem {full_name}: statement is trivial True"))
            elif " = " in stmt:
                lhs, rhs = [s.strip() for s in stmt.split(" = ", 1)]
                if lhs == rhs:
                    DEFECTS.append((relpath, "HIGH", f"Tautological theorem {full_name}: {lhs} = {rhs}"))
                elif lhs in defs and defs[lhs] == rhs:
                    DEFECTS.append((relpath, "HIGH", f"Tautological definitional theorem {full_name}: {lhs} (defined as {defs[lhs]}) = {rhs}"))

    # 4. Check axioms via Lean compiler
    env = os.environ.copy()
    env["LEAN_PATH"] = LEAN_DIR
    check_code = raw_content + "\n\n"
    for th_name, full_name, _ in theorems:
        check_code += f"#print axioms {full_name}\n"

    tmp_file = f"/tmp/audit_{os.path.basename(filepath)}"
    with open(tmp_file, "w", encoding="utf-8") as f:
        f.write(check_code)

    res = subprocess.run(["lean", tmp_file], capture_output=True, text=True, env=env)
    if res.returncode != 0:
        err_msg = (res.stdout + "\n" + res.stderr).strip()
        DEFECTS.append((relpath, "HIGH", f"Lean compiler error during axiom extraction for {relpath}:\n{err_msg}"))
    else:
        for line in res.stdout.splitlines():
            if "depends on axioms:" in line:
                axioms_part = line.split("depends on axioms:")[1].strip().strip("[]")
                axioms = [a.strip() for a in axioms_part.split(",") if a.strip()]
                custom_axioms = [a for a in axioms if a not in STANDARD_AXIOMS]
                if custom_axioms:
                    DEFECTS.append((relpath, "HIGH", f"Custom axiom dependency detected in {relpath}: {custom_axioms} (line: {line})"))

def main():
    print("===============================================================")
    print("WAVE 3: EXHAUSTIVE LEAN 4 SOUNDNESS & AXIOM META-AUDIT")
    print("===============================================================\n")

    base_modules = [
        "TryteArsenal",
        "TryteSiliconCore",
        "TryteSimdEngine",
        "TryteCompilerSoundness",
        "FibonacciAnyon",
    ]
    env = os.environ.copy()
    env["LEAN_PATH"] = LEAN_DIR
    for m in base_modules:
        src = os.path.join(LEAN_DIR, f"{m}.lean")
        out = os.path.join(LEAN_DIR, f"{m}.olean")
        if not os.path.exists(out) or os.path.getmtime(src) > os.path.getmtime(out):
            print(f"Pre-compiling base module {m}.lean -> {m}.olean...")
            res = subprocess.run(["lean", "-o", out, src], capture_output=True, text=True, env=env)
            if res.returncode != 0:
                err_msg = (res.stdout + "\n" + res.stderr).strip()
                DEFECTS.append((f"quantum/lean/{m}.lean", "CRITICAL", f"Failed to pre-compile base module: {err_msg}"))

    files = glob.glob(os.path.join(LEAN_DIR, "*.lean")) + glob.glob(os.path.join(LEAN_DIR, "Certificates", "*.lean"))
    print(f"Auditing {len(files)} Lean 4 files...")

    for f in sorted(files):
        bname = os.path.basename(f)
        audit_file(f)
        print(f"  [AUDIT] {bname} -> Completed")

    print("\n---------------------------------------------------------------")
    print(f"Axiom & Soundness Audit Complete: {len(DEFECTS)} defects discovered.")
    for d in DEFECTS:
        print(f"  [DEFECT] [{d[1]}] {d[0]}: {d[2]}")

    if DEFECTS:
        exit(1)
    else:
        print(">>> 100% SOUNDNESS CONFIRMED: 0 SORRY, 0 CUSTOM AXIOMS, 0 TAUTOLOGIES! <<<")
        print("    (Foundations strictly limited to standard Lean 4: propext, Quot.sound, Classical.choice)")

if __name__ == "__main__":
    main()
