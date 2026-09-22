'use strict';
/* ---------------------------------------------------------------------------
 * kernel.js — Tryte-QOS Microkernel Controller & Telemetry
 * ---------------------------------------------------------------------------
 * Boots and monitors the native Tryte-QOS balanced ternary microkernel:
 *   - Manages process scheduling and TCB inspections
 *   - Monitors system calls (Yield, Out, Exit, QEXEC)
 *   - Provides telemetry on CPU cycles, memory, and quantum co-processor
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');
const { TryteVM } = require('./vm.js');
const { loadInto } = require('./assembler.js');

const KERNEL_SRC_PATH = path.resolve(__dirname, '../programs/microkernel.tasm');

class TryteKernel {
  constructor(opts = {}) {
    this.srcPath = opts.srcPath || KERNEL_SRC_PATH;
    this.deterministicQuantum = opts.deterministicQuantum !== undefined ? opts.deterministicQuantum : true;
    this.vm = null;
  }

  boot() {
    const src = fs.readFileSync(this.srcPath, 'utf8');
    this.vm = new TryteVM({
      deterministicQuantum: this.deterministicQuantum,
      trace: true,
    });

    loadInto(this.vm, src);
    let runError = null;
    try {
      this.vm.run();
    } catch (err) {
      runError = err.message;
    }

    const decodeStatus = (statusCode) => {
      if (statusCode === -1) return 'TERMINATED';
      if (statusCode === 1) return 'READY';
      if (statusCode === 0) return 'SUSPENDED';
      if (statusCode === -364) return 'CRASHED';
      return `UNKNOWN(${statusCode})`;
    };

    const p1Raw = this.vm.labels && 'p1_status' in this.vm.labels ? this.vm.read(this.vm.labels['p1_status']) : -1;
    const p2Raw = this.vm.labels && 'p2_status' in this.vm.labels ? this.vm.read(this.vm.labels['p2_status']) : -1;

    let kernelStatus = 'RUNNING';
    if (this.vm.halted) {
      kernelStatus = 'SHUTDOWN_CLEAN';
    } else if (runError) {
      kernelStatus = runError.includes('step limit') ? 'TIMEOUT_PREEMPTION_REQUIRED' : `ERROR: ${runError}`;
    }

    return {
      status: kernelStatus,
      steps: this.vm.steps,
      output: this.vm.output,
      error: runError,
      processes: [
        { pid: 1, name: 'Classical Counter', status: decodeStatus(p1Raw), statusCode: p1Raw },
        { pid: 2, name: 'Quantum Anyon Braid Task', status: decodeStatus(p2Raw), statusCode: p2Raw },
      ],
    };
  }
}

function bootKernel(opts = {}) {
  const kernel = new TryteKernel(opts);
  return kernel.boot();
}

module.exports = {
  TryteKernel,
  bootKernel,
};
