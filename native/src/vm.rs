//! High-Performance Cycle-Accurate TryteVM Engine in Native Rust

use crate::ternary::*;
use std::collections::VecDeque;

pub const MEM_SIZE: usize = 729;
pub const MEM_OFFSET: i32 = 364;

pub struct TryteVM {
    pub mem: [i16; MEM_SIZE],
    pub a: i16,
    pub c: i16,
    pub pc: i16,
    pub halted: bool,
    pub trapped: bool,
    pub trap_reason: Option<String>,
    pub steps: usize,
    pub input_queue: VecDeque<i16>,
    pub output_queue: Vec<i16>,
}

impl Default for TryteVM {
    fn default() -> Self {
        Self::new()
    }
}

impl TryteVM {
    pub fn new() -> Self {
        Self {
            mem: [0; MEM_SIZE],
            a: 0,
            c: 0,
            pc: 0,
            halted: false,
            trapped: false,
            trap_reason: None,
            steps: 0,
            input_queue: VecDeque::new(),
            output_queue: Vec::new(),
        }
    }

    #[inline(always)]
    pub fn phys_addr(balanced: i16) -> usize {
        let w = wrap(balanced as i32);
        (w as i32 + MEM_OFFSET) as usize
    }


    #[inline(always)]
    pub fn read_mem(&self, addr: i16) -> i16 {
        self.mem[Self::phys_addr(addr)]
    }

    #[inline(always)]
    pub fn write_mem(&mut self, addr: i16, val: i16) {
        let idx = Self::phys_addr(addr);
        self.mem[idx] = wrap(val as i32);
    }

    /// Load 729-cell dual-rail hex image (from tasm_to_hex.js)
    pub fn load_hex(&mut self, hex_content: &str) -> Result<(), String> {
        let lines: Vec<&str> = hex_content
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();

        if lines.len() != MEM_SIZE {
            return Err(format!(
                "Invalid hex size: expected 729 lines, got {}",
                lines.len()
            ));
        }

        for (phys, line) in lines.iter().enumerate() {
            let bits = u16::from_str_radix(line, 16)
                .map_err(|e| format!("Hex parse error at line {}: {}", phys, e))?;

            // Decode 12-bit dual-rail to balanced integer
            let mut trits = [0i8; 6];
            for i in 0..6 {
                let p = (bits >> (2 * i)) & 1;
                let n = (bits >> (2 * i + 1)) & 1;
                trits[i] = if p != 0 && n == 0 {
                    1
                } else if n != 0 && p == 0 {
                    -1
                } else {
                    0
                };
            }
            self.mem[phys] = from_trits(&trits);
        }

        self.pc = 0;
        self.a = 0;
        self.c = 0;
        self.halted = false;
        self.steps = 0;
        Ok(())
    }

    /// Step one instruction (fetch, decode, execute)
    pub fn step(&mut self) -> bool {
        if self.halted {
            return false;
        }

        let opcode = self.read_mem(self.pc);
        let operand = self.read_mem(add(self.pc, 1));
        self.pc = add(self.pc, 2);
        self.steps += 1;

        match opcode {
            0 => {
                // HALT
                self.halted = true;
                return false;
            }
            1 => {
                // LOADI
                self.a = operand;
            }
            2 => {
                // LOAD
                self.a = self.read_mem(operand);
            }
            3 => {
                // STORE
                self.write_mem(operand, self.a);
            }
            4 => {
                // ADD
                self.a = add(self.a, self.read_mem(operand));
            }
            5 => {
                // ADDI
                self.a = add(self.a, operand);
            }
            6 => {
                // SUB
                self.a = sub(self.a, self.read_mem(operand));
            }
            7 => {
                // NEG
                self.a = neg(self.a);
            }
            8 => {
                // MIN
                self.a = t_min(self.a, self.read_mem(operand));
            }
            9 => {
                // MAX
                self.a = t_max(self.a, self.read_mem(operand));
            }
            10 => {
                // CSUM
                self.a = t_csum(self.a, self.read_mem(operand));
            }
            11 => {
                // SETC
                self.c = operand;
            }
            12 => {
                // TGATE
                self.a = t_gate(self.a, self.read_mem(operand), self.c);
            }
            13 => {
                // SHL
                self.a = shift_left(self.a, operand as i32);
            }
            14 => {
                // SHR
                self.a = shift_right(self.a, operand as i32);
            }
            15 => {
                // JMP
                self.pc = operand;
            }
            16 => {
                // BR3: single-cycle 3-way conditional branch engine!
                let s = sign(self.a) as i16;
                let target_addr = add(operand, s);
                self.pc = self.read_mem(target_addr);
            }
            17 => {
                // OUT
                self.output_queue.push(self.a);
            }
            18 => {
                // IN
                self.a = self.input_queue.pop_front().unwrap_or(0);
            }
            19 => {
                // LOADX: indirect load A = mem[mem[operand]]
                let ptr = self.read_mem(operand);
                self.a = self.read_mem(ptr);
            }
            20 => {
                // STOREX: indirect store mem[mem[operand]] = A
                let ptr = self.read_mem(operand);
                self.write_mem(ptr, self.a);
            }
            21 => {
                // JMPX: indirect jump PC = mem[operand]
                self.pc = self.read_mem(operand);
            }
            22 => {
                // LDC: C = mem[operand]
                self.c = self.read_mem(operand);
            }
            23 => {
                // TOP: 9-entry truth table
                let op_b = self.read_mem(operand);
                let mut tbl = [0i16; 9];
                for i in 0..9 {
                    tbl[i] = self.read_mem(add(self.c, i as i16));
                }
                self.a = t_table(&tbl, self.a, op_b);
            }
            24 => {
                // TOPC: 27-row carry table
                let op_b = self.read_mem(operand);
                let mut tbl = [0i16; 27];
                for i in 0..27 {
                    tbl[i] = self.read_mem(add(self.c, i as i16));
                }
                self.a = t_table_c(&tbl, self.a, op_b);
            }
            25 => {
                // Opcode 25 (QEXEC) is an experimental JS-only research bridge to the floating-point vTQPU.
                // It is explicitly unimplemented on the native SIMD execution engine.
                self.trapped = true;
                self.trap_reason = Some(format!(
                    "unimplemented opcode QEXEC (25) on native engine at address {}",
                    add(self.pc, -2)
                ));
                self.halted = true;
                return false;
            }
            _ => {
                // Unknown opcode: trap and halt (matching JS TryteVM error behavior)
                self.trapped = true;
                self.trap_reason = Some(format!("unknown opcode {} at address {}", opcode, add(self.pc, -2)));
                self.halted = true;
                return false;
            }
        }


        true
    }

    /// Run program until halt or step limit
    pub fn run(&mut self, max_steps: usize) -> usize {
        while self.steps < max_steps && self.step() {}
        self.steps
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vm_loadi_out() {
        let mut vm = TryteVM::new();
        // LOADI 42; OUT; HALT
        vm.write_mem(0, 1);  // LOADI
        vm.write_mem(1, 42); // operand
        vm.write_mem(2, 17); // OUT
        vm.write_mem(3, 0);  // operand
        vm.write_mem(4, 0);  // HALT
        vm.write_mem(5, 0);

        vm.run(100);
        assert!(vm.halted);
        assert_eq!(vm.output_queue, vec![42]);
    }

    #[test]
    fn test_vm_br3() {
        let mut vm = TryteVM::new();
        // Table at 100 (-1 -> target_neg, 0 -> target_zero, +1 -> target_pos)
        vm.write_mem(99, -200);
        vm.write_mem(100, 0);
        vm.write_mem(101, 200);

        // Positive Accumulator
        vm.a = 50;
        vm.pc = 0;
        vm.write_mem(0, 16); // BR3
        vm.write_mem(1, 100);
        vm.step();
        assert_eq!(vm.pc, 200);

        // Negative Accumulator
        vm.a = -50;
        vm.pc = 0;
        vm.step();
        assert_eq!(vm.pc, -200);

        // Zero Accumulator
        vm.a = 0;
        vm.pc = 0;
        vm.step();
        assert_eq!(vm.pc, 0);
    }

    #[test]
    fn test_vm_topc() {
        let mut vm = TryteVM::new();
        // Setup a 27-row table at address 50
        for i in 0..27 {
            vm.write_mem(50 + i as i16, i as i16 - 13);
        }
        vm.c = 50;
        vm.a = 123;
        vm.write_mem(10, -45);
        // TOPC at address 0
        vm.write_mem(0, 24); // TOPC
        vm.write_mem(1, 10); // operand address
        vm.step();
        assert_eq!(vm.pc, 2);
        assert!(!vm.trapped);
    }

    #[test]
    fn test_vm_trap_unknown_opcode() {
        let mut vm = TryteVM::new();
        vm.write_mem(0, 99); // Unknown opcode 99
        vm.write_mem(1, 0);
        vm.step();
        assert!(vm.halted);
        assert!(vm.trapped);
        assert!(vm.trap_reason.is_some());
    }

    #[test]
    fn test_vm_phys_addr_wrap() {
        assert_eq!(TryteVM::phys_addr(0), 364);
        assert_eq!(TryteVM::phys_addr(364), 728);
        assert_eq!(TryteVM::phys_addr(-364), 0);
        // Out of range wraps modulo 729
        assert_eq!(TryteVM::phys_addr(365), 0);   // 365 wraps to -364 -> phys 0
        assert_eq!(TryteVM::phys_addr(-365), 728); // -365 wraps to +364 -> phys 728
    }

    #[test]
    fn test_vm_qexec_unimplemented() {
        let mut vm = TryteVM::new();
        vm.write_mem(0, 25); // Opcode 25 (QEXEC)
        vm.write_mem(1, 10);
        vm.step();
        assert!(vm.halted);
        assert!(vm.trapped);
        assert!(vm.trap_reason.unwrap().contains("unimplemented opcode QEXEC (25)"));
    }
}

