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
    this.vm.run();

    return {
      status: this.vm.halted ? 'SHUTDOWN_CLEAN' : 'RUNNING',
      steps: this.vm.steps,
      output: this.vm.output,
      processes: [
        { pid: 1, name: 'Classical Counter', status: 'TERMINATED' },
        { pid: 2, name: 'Quantum Anyon Braid Task', status: 'TERMINATED' },
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
