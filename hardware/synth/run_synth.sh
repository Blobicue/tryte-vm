#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${ROOT_DIR}"

echo "================================================================"
echo "RUNNING YOSYS FPGA SYNTHESIS VERIFICATION"
echo "Target: Lattice iCE40 UltraPlus / HX Architecture"
echo "================================================================"

yosys -s hardware/synth/synth_ice40.ys

echo ""
echo "================================================================"
echo "RUNNING YOSYS GENERIC SYNTHESIS & LINT AUDIT"
echo "Target: Generic Standard Cell Gates"
echo "================================================================"

yosys -s hardware/synth/synth_generic.ys

echo ""
echo "================================================================"
echo "SYNTHESIS AND HARDWARE LINTING COMPLETE: ZERO ERRORS"
echo "================================================================"
