'use strict';
/* ---------------------------------------------------------------------------
 * test-microkernel.js — Tests for Native Tryte-QOS Microkernel & Scheduler
 * ---------------------------------------------------------------------------
 * Verifies:
 *   1. Assembly of programs/microkernel.tasm
 *   2. TCB process table initialization and status transitions
 *   3. Round-robin context switching between classical and quantum processes
 *   4. System call dispatch (Yield, Out, Exit, QEXEC)
 *   5. Clean kernel shutdown after all processes terminate
 *   6. tsh CLI execution via boot command
 * ------------------------------------------------------------------------- */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { TryteKernel, bootKernel } = require('../src/kernel.js');
const { TryteVM } = require('../src/vm.js');
const { loadInto } = require('../src/assembler.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('Running Tryte-QOS Native Microkernel Test Suite...\n');

// 1. Assembly & Loading
test('programs/microkernel.tasm assembles and loads into TryteVM memory', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../programs/microkernel.tasm'), 'utf8');
  const vm = new TryteVM();
  loadInto(vm, src);
  assert.strictEqual(vm.PC, 0);
  assert.ok(vm.read(0) !== 0, 'Entry point must contain valid instruction');
});

// 2. Complete Microkernel Execution & Interleaved Output
test('Microkernel schedules Process 1 and Process 2 cooperatively to clean shutdown', () => {
  const res = bootKernel({ deterministicQuantum: true });

  assert.strictEqual(res.status, 'SHUTDOWN_CLEAN');
  assert.strictEqual(res.processes.length, 2);
  assert.strictEqual(res.processes[0].status, 'TERMINATED');
  assert.strictEqual(res.processes[1].status, 'TERMINATED');

  // Interleaved output: [2, 0, 1]
  // 2: P1 initial count
  // 0: P2 quantum co-processor measurement
  // 1: P1 decremented count
  assert.deepStrictEqual(res.output, [2, 0, 1]);
  assert.ok(res.steps > 50 && res.steps < 300, `Unexpected cycle count: ${res.steps}`);
});

// 3. System Call Handling Integrity
test('Microkernel handles Yield and Exit system calls without runaway execution', () => {
  const kernel = new TryteKernel({ deterministicQuantum: true });
  const res = kernel.boot();
  assert.strictEqual(kernel.vm.halted, true);
  assert.strictEqual(kernel.vm.read(kernel.vm.PC - 2), 0); // HALT opcode
});

// 4. Shell CLI Integration
test('tsh CLI boots microkernel via boot command', () => {
  const out = execSync('node quantum/cli/tsh.js -c boot', { encoding: 'utf8' });
  assert.ok(out.includes('Booting Native Tryte-QOS Microkernel'));
  assert.ok(out.includes('Kernel Status      : SHUTDOWN_CLEAN ✓'));
  assert.ok(out.includes('Process Outputs    : [2, 0, 1]'));
  assert.ok(out.includes('PID 1 (Classical Counter'));
  assert.ok(out.includes('PID 2 (Quantum Anyon Braid Task'));
});

// 5. Illegal Syscall Trapping
test('Microkernel traps invalid syscall IDs and flags faulting process as CRASHED', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../programs/microkernel.tasm'), 'utf8');
  // Inject illegal syscall ID 5 into Process 1
  const modifiedSrc = src.replace('LOADI 1\n        JMP   syscall_trap', 'LOADI 5\n        JMP   syscall_trap');

  const tmpPath = path.resolve(__dirname, '../programs/microkernel_fault_test.tasm');
  fs.writeFileSync(tmpPath, modifiedSrc, 'utf8');
  try {
    const res = bootKernel({ srcPath: tmpPath, deterministicQuantum: true });
    assert.strictEqual(res.processes[0].status, 'CRASHED');
    assert.strictEqual(res.processes[0].statusCode, -364);
    // Process 2 should still run and terminate normally
    assert.strictEqual(res.processes[1].status, 'TERMINATED');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

// 6. Preemption & Timeout Handling
test('Microkernel controller handles runaway processes gracefully with TIMEOUT_PREEMPTION_REQUIRED', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../programs/microkernel.tasm'), 'utf8');
  // Replace P1 body with infinite loop without yielding
  const modifiedSrc = src.replace('p1_body:\n        LOAD  p1_count', 'p1_body:\n        JMP   p1_body\n        LOAD  p1_count');

  const tmpPath = path.resolve(__dirname, '../programs/microkernel_loop_test.tasm');
  fs.writeFileSync(tmpPath, modifiedSrc, 'utf8');
  try {
    const kernel = new TryteKernel({ srcPath: tmpPath, deterministicQuantum: true });
    const res = kernel.boot();
    assert.strictEqual(res.status, 'TIMEOUT_PREEMPTION_REQUIRED');
    assert.ok(res.error.includes('step limit exceeded'));
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

console.log(`\nMicrokernel Tests Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
