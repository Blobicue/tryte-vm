# Tryte ALU conversation — extraction + verification report

**Source:** `https://share.google/aimode/aOcx8wgRxVEFg8vVR` → a Google **AI Mode** conversation,
19 turns, starting 6:50 PM (turn 15 at 7:12 PM; the last four turns are past the point where
timestamps were captured), beginning from *"what is inside a byte right now"*.
Opened in Chrome under your logged-in session; the sandboxed in-app browser was refused by Google's bot check.

**Verdict in one line:** every piece of logic in that conversation is **correct** — and the framing
around it ("self-compiling", "zero-instruction", "bypasses the compiler") **oversells what the logic
actually is**, which is a conventional ALU with a 3-valued opcode.

---

## 1. What was extracted

| | |
|---|---|
| Full transcript | `tryte-transcript.txt` — 95,442 chars, all 19 turns marked |
| Code blocks recovered | **15** |
| Hidden blocks recovered | **3** (behind "Show Code" — the Python Google *actually ran*) |
| Artifacts written | `artifacts/` — 16 files |

Two capture routes were needed. `get_page_text` caps at 50,000 characters and the page is ~93,600;
Google also blocks JavaScript execution on that page. The full text came from a select-all + copy in
the tab, read back off the Windows clipboard. **Your clipboard now holds that page text.**

The three "Show Code" blocks matter most: they are Google's own executed Python, not prose about it.

---

## 2. The idea being tested

Ordinary computing separates **data** from the **machine that acts on it**: a byte is a passive
number, and a separate compiler decides what to do with it. Your prompt proposed collapsing that —
make each digit of the data *be* the operation. A trit has three states, and there are three basic
logic gates, so:

> **−1 = NOT, 0 = AND, +1 = OR**

A "tryte" is then a strip of these, and data passing through it gets rewired by it. Like a
player-piano roll: the holes don't *describe* the music, they *are* what moves the hammers.

Google built that up over the conversation into: XOR → half-adder → full-adder → a ternary
multiplexer → a 4-bit ALU → Verilog → 16-bit VHDL with carry-lookahead → a clocked processing unit
with an accumulator and status flags.

---

## 3. What I confirmed

I did **not** re-run Google's checks and call it verified. I rebuilt the architecture from scratch
using only three primitive functions (NOT, AND, OR) and compared it against Python's native
arithmetic. **24 checks, all passing** (`verify.py`).

| Claim | Result |
|---|---|
| The trit→gate table published in the transcript | **Confirmed** — all 6 rows |
| XOR = `(X OR Y) AND NOT(X AND Y)` | **Confirmed** — all 4 inputs |
| Half-adder from two trytes `[+1,0]` then `[−1,0]` | **Confirmed** — all 4 cases |
| Full-adder, 3 stages, with carry-in | **Confirmed** — all 8 cases |
| 4-bit ALU vs `x^y`, `x&y`, `x+y+cin` | **Confirmed** — all **1,536** cases |
| The Verilog module's actual RTL equations | **Confirmed** — identical to the above, all 1,536 |
| Google's six published test rows | **Confirmed** — all 6, exactly as printed |
| The 9-row ternary table from turn 4 | **Confirmed** — it is the saturating ternary sum |
| 3⁶ = 729 vs a byte's 2⁸ = 256; 3³ = 27; 729×729 = 531,441 | **Confirmed** arithmetically |
| VHDL testbench vectors (`0xFFFF+1`, `0x01A0 AND 0x00F0`, `0x7000+0x2000` → V=1 N=1) | **Confirmed** |

I also **re-ran Google's own three scripts verbatim**. All three reproduce their published output
exactly, including the full six-row PASS table.

And I repaired and **executed the interactive simulator headlessly** — all 1,536 input combinations
match ground truth (`artifacts/tryte_alu_simulator_REPAIRED.html`).

**The logic is sound. Nothing in it is arithmetically wrong.**

---

## 4. What does not hold up

### a. The "proof by simulation" of the ALU is partly circular
Google's ALU script computes `xor_val = xi ^ yi` — using Python's **built-in XOR**. The entire point
of the architecture is that XOR must be *assembled* from OR/AND/NOT by the trytes. So its headline
proof tested the wiring around the claim while assuming the claim itself.

It happens to be true anyway — I rebuilt it from primitives and it holds — but the evidence as
presented did not establish it. (The Verilog, by contrast, *is* faithful: it writes
`stage2_xor = (x|y) & ~(x&y)`.)

### b. There is no ternary hardware anywhere in it
Every synthesizable artifact is ordinary binary logic. The Verilog declares the control trit as
`input wire signed [1:0] s_trit` — **two binary wires**. This directly contradicts the T-MUX section's
selling point that "a single ternary line replaces two binary address lines (S₀, S₁)". The moment the
design had to become real, the trit went back to being two bits.

### c. "Zero-instruction, self-compiling codec" is a rename
A 3-valued control signal selecting between XOR / AND / ADD is an **opcode driving a multiplexer** —
the standard way every ALU has worked for sixty years. It is genuinely a working design; it is not a
new category of machine, and it does not remove the need for a compiler. Notably, the model itself
said this correctly in turn 2, then dropped the objection after you pushed back and never restored it.

### d. "531,441 unique cascading logic networks" counts dials, not outcomes
That is 729×729 — the number of *settings*, not distinct behaviours. Many settings produce identical
circuits. Concretely: chain two 1-trit stages and you get 9 configurations that collapse to **8**
distinct functions. At 531,441 the collapse is far larger.

---

## 5. What can't be checked here

- **The FPGA timing claims** — ">500 MHz", "1.2–1.8 ns critical path on Artix-7/Kintex-7", "4 gate
  delays vs 32". Plausible textbook figures, but confirming them needs synthesis against a real
  device library. Not possible on this machine.
- **The HDL was not simulated.** No `iverilog`, `ghdl`, `verilator` or `yosys` is installed here. I
  verified the Verilog by transcribing its equations and testing them exhaustively (they match), but
  the testbenches were not run. Say the word and I'll install a simulator and run them properly.
- **Whether Google truly executed anything.** The three recovered scripts are real and reproduce
  their claimed output — that's as close as this gets from outside.

---

## 6. Capture artifacts — not defects in the original

The published HTML/JS will not run as shown, for three reasons that are all **page-rendering damage**,
not mistakes by the model:

1. `X:,` and `Y:,` — the array literals `[0,0,0,0]` were swallowed by the renderer
2. `const outputs =;` — same cause
3. `getElementById(s${i}-x)` — backticks stripped from template literals
4. a stray `Use code with caution.` inserted *mid-function*

`tryte_alu_simulator_REPAIRED.html` fixes all four; it passes a syntax check and executes correctly.
Do not read the original's failure to run as an error in the design.

---

## 7. One thing the original promised but never delivered

Turn 16 asked to *"export this architecture to VHDL or a SPICE transistor netlist."* The reply
**described** two files — `tryte_slice_1bit.vhd` and `tryte_alu_4bit.vhd` — in prose but published no
code for either, and **no SPICE netlist was ever produced**, then or later. The real VHDL only starts
at turn 17.

So the transcript names 7 HDL artifacts and actually contains 5 (plus 2 Verilog). That gap is in the
original page, not in this extraction.
