#!/usr/bin/env bash
# ==============================================================================
# TryteVM Push-Button External Audit Verification Script
# ==============================================================================
# Runs the full verification pipeline across Native Rust, JavaScript VM,
# TRIL Compiler, Standard Library, SIMD Engine, Fuzzing, and Lean 4 Proofs.
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
NC="\033[0m"

echo -e "${BOLD}${BLUE}================================================================${NC}"
echo -e "${BOLD}${BLUE}       TRYTE-VM COMPLETE EXTERNAL AUDIT VERIFICATION            ${NC}"
echo -e "${BOLD}${BLUE}================================================================${NC}"
echo -e "Starting push-button full-stack verification..."
echo ""

FAILED_STAGES=()

run_stage() {
    local STAGE_NAME="$1"
    local CMD="$2"
    echo -e "${BOLD}${CYAN}>>> [STAGE] ${STAGE_NAME}...${NC}"
    if eval "$CMD"; then
        echo -e "${GREEN}✓ [PASS] ${STAGE_NAME}${NC}\n"
    else
        echo -e "${RED}✗ [FAIL] ${STAGE_NAME}${NC}\n"
        FAILED_STAGES+=("${STAGE_NAME}")
    fi
}

# 1. Native Rust Tests
run_stage "Native Rust SIMD & Lattice Crypto (cargo test)" \
    "cargo test --manifest-path native/Cargo.toml"

# 2. Complete JS Test Suite
run_stage "JavaScript VM & Audits (npm test, 59 suites)" \
    "npm test"

# 3. TRIL Compiler Pipeline
run_stage "Self-Hosting TRIL Compiler (npm run tril:test)" \
    "npm run tril:test"

# 4. TRIL Standard Library
run_stage "TRIL Standard Library Suite (npm run stdlib:test)" \
    "npm run stdlib:test"

# 5. Native SIMD Parity & Benchmarks
run_stage "Native SIMD Parity & Throughput (npm run simd:test)" \
    "npm run simd:test"

# 6. Adversarial Fuzzing & Multi-Precision Sweep
run_stage "Adversarial Fuzzing (50k BigInt + 1.59M carry combinations)" \
    "npm run fuzz"

# 7. Formal Lean 4 Soundness Audit
run_stage "Lean 4 Formal Soundness Audit (21 modules, 0 sorry, 0 custom axioms)" \
    "python3 quantum/lean/audit_soundness.py"

echo -e "${BOLD}${BLUE}================================================================${NC}"
echo -e "${BOLD}${BLUE}                   AUDIT VERIFICATION SUMMARY                   ${NC}"
echo -e "${BOLD}${BLUE}================================================================${NC}"

if [ ${#FAILED_STAGES[@]} -eq 0 ]; then
    echo -e "${BOLD}${GREEN}ALL 7 HARNESS STAGES PASSED (exit code 0)${NC}"
    echo -e "${GREEN}All test suites, differential checks, fuzzers, and formal proof audits completed without errors.${NC}"
    echo -e "${BOLD}${BLUE}================================================================${NC}"
    exit 0
else
    echo -e "${BOLD}${RED}THE FOLLOWING STAGES FAILED AUDIT VERIFICATION:${NC}"
    for stage in "${FAILED_STAGES[@]}"; do
        echo -e "${RED}  - ${stage}${NC}"
    done
    echo -e "${BOLD}${BLUE}================================================================${NC}"
    exit 1
fi
