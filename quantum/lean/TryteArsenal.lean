/-
  =============================================================================
  TryteArsenal.lean — Formal Lean 4 Verification Kernel for Tryte-QOS Arsenal
  =============================================================================

  Machine-checked formalization of balanced ternary arithmetic, the Z_3 Abelian
  group, distributive lattice operations, and the 9-entry TOP truth-table instruction.

  Strictly machine-checked in Lean 4 without any axioms or admissions (`sorry`).
-/

-- ===========================================================================
-- Section 1: The Balanced Ternary Trit Domain
-- ===========================================================================

/-- Balanced ternary trit with values -1 (neg), 0 (zero), +1 (pos) -/
inductive Trit : Type
  | neg  : Trit
  | zero : Trit
  | pos  : Trit
  deriving Repr, DecidableEq, Inhabited

namespace Trit

/-- Convert Trit to integer in {-1, 0, +1} -/
def toInt : Trit → Int
  | .neg  => -1
  | .zero => 0
  | .pos  => 1

/-- Convert integer to Trit with modulo 3 balance -/
def fromInt (n : Int) : Trit :=
  let r := (n % 3 + 3) % 3
  if r == 0 then .zero
  else if r == 1 then .pos
  else .neg

/-- Trit negation: flips every trit (-1 -> +1, 0 -> 0, +1 -> -1) -/
def negT : Trit → Trit
  | .neg  => .pos
  | .zero => .zero
  | .pos  => .neg

/-- Modular addition over Z_3 in balanced representation -/
def addT : Trit → Trit → Trit
  | .neg,  .neg  => .pos
  | .neg,  .zero => .neg
  | .neg,  .pos  => .zero
  | .zero, y     => y
  | .pos,  .neg  => .zero
  | .pos,  .zero => .pos
  | .pos,  .pos  => .neg

/-- Modular subtraction over Z_3 -/
def subT (x y : Trit) : Trit :=
  addT x (negT y)

/-- Cyclic increment (+1 mod 3): -1 -> 0, 0 -> 1, 1 -> -1 -/
def cycleT : Trit → Trit
  | .neg  => .zero
  | .zero => .pos
  | .pos  => .neg

/-- Tritwise minimum (AND-like lattice operation) -/
def minT : Trit → Trit → Trit
  | .neg,  _     => .neg
  | _,     .neg  => .neg
  | .zero, .zero => .zero
  | .zero, .pos  => .zero
  | .pos,  .zero => .zero
  | .pos,  .pos  => .pos

/-- Tritwise maximum (OR-like lattice operation) -/
def maxT : Trit → Trit → Trit
  | .pos,  _     => .pos
  | _,     .pos  => .pos
  | .zero, .zero => .zero
  | .zero, .neg  => .zero
  | .neg,  .zero => .zero
  | .neg,  .neg  => .neg

/-- Clamped ternary sum without wrap (clamped to [-1, 1]) -/
def csumT : Trit → Trit → Trit
  | .neg,  .neg  => .neg
  | .neg,  .zero => .neg
  | .neg,  .pos  => .zero
  | .zero, y     => y
  | .pos,  .neg  => .zero
  | .pos,  .zero => .pos
  | .pos,  .pos  => .pos

-- ===========================================================================
-- Section 2: Algebraic Proofs (Abelian Group Z_3 & Lattice)
-- ===========================================================================

/-- Negation is an involution: neg (neg x) = x -/
theorem neg_involution (x : Trit) : negT (negT x) = x := by
  cases x <;> rfl

/-- Addition is commutative -/
theorem add_comm (x y : Trit) : addT x y = addT y x := by
  cases x <;> cases y <;> rfl

/-- Zero is right identity for addition -/
theorem add_zero (x : Trit) : addT x .zero = x := by
  cases x <;> rfl

/-- Zero is left identity for addition -/
theorem zero_add (x : Trit) : addT .zero x = x := by
  cases x <;> rfl

/-- Addition is associative -/
theorem add_assoc (x y z : Trit) : addT (addT x y) z = addT x (addT y z) := by
  cases x <;> cases y <;> cases z <;> rfl

/-- Inverse property: x + (-x) = 0 -/
theorem add_neg_inverse (x : Trit) : addT x (negT x) = .zero := by
  cases x <;> rfl

/-- Subtraction of self is zero -/
theorem sub_self (x : Trit) : subT x x = .zero := by
  cases x <;> rfl

/-- Cyclic permutation has order 3: cycle^3 = id -/
theorem cycle_three (x : Trit) : cycleT (cycleT (cycleT x)) = x := by
  cases x <;> rfl

/-- Min is commutative -/
theorem min_comm (x y : Trit) : minT x y = minT y x := by
  cases x <;> cases y <;> rfl

/-- Max is commutative -/
theorem max_comm (x y : Trit) : maxT x y = maxT y x := by
  cases x <;> cases y <;> rfl

/-- De Morgan duality for ternary lattice -/
theorem demorgan_min_max (x y : Trit) : negT (minT x y) = maxT (negT x) (negT y) := by
  cases x <;> cases y <;> rfl

end Trit

-- ===========================================================================
-- Section 3: The 9-Entry TOP Instruction Formalization
-- ===========================================================================

open Trit

/-- A 9-entry truth table for two-trit operations -/
structure Table9 where
  entries : Array Trit
  deriving Repr

/-- Evaluate a 9-entry truth table at (x, y) matching Tryte-VM TOP hardware semantics -/
def evalTOP (tbl : Table9) (x y : Trit) : Trit :=
  let idx := match x, y with
    | .neg,  .neg  => 0
    | .neg,  .zero => 1
    | .neg,  .pos  => 2
    | .zero, .neg  => 3
    | .zero, .zero => 4
    | .zero, .pos  => 5
    | .pos,  .neg  => 6
    | .pos,  .zero => 7
    | .pos,  .pos  => 8
  tbl.entries.getD idx .zero

-- ===========================================================================
-- Section 4: Verified Truth Tables for Arsenal Core
-- ===========================================================================

/-- add_mod_3: Z_3 x Z_3 -> Z_3 table -/
def add_mod_3_table : Table9 :=
  ⟨#[.pos, .neg, .zero, .neg, .zero, .pos, .zero, .pos, .neg]⟩

/-- t_neg: Reversible Trit Negation table -/
def t_neg_table : Table9 :=
  ⟨#[.pos, .pos, .pos, .zero, .zero, .zero, .neg, .neg, .neg]⟩

/-- t_cycle: Reversible Trit Cycle table -/
def t_cycle_table : Table9 :=
  ⟨#[.zero, .zero, .zero, .pos, .pos, .pos, .neg, .neg, .neg]⟩

/-- min_table: Tritwise minimum table -/
def min_table : Table9 :=
  ⟨#[.neg, .neg, .neg, .neg, .zero, .zero, .neg, .zero, .pos]⟩

/-- max_table: Tritwise maximum table -/
def max_table : Table9 :=
  ⟨#[.neg, .zero, .pos, .zero, .zero, .pos, .pos, .pos, .pos]⟩

/-- csum_table: Clamped sum table -/
def csum_table : Table9 :=
  ⟨#[.neg, .neg, .zero, .neg, .zero, .pos, .zero, .pos, .pos]⟩

-- ===========================================================================
-- Section 5: Machine-Checked Equivalence Theorems
-- ===========================================================================

theorem add_mod_3_table_is_addT (x y : Trit) : evalTOP add_mod_3_table x y = addT x y := by
  cases x <;> cases y <;> rfl

theorem t_neg_table_is_negT (x y : Trit) : evalTOP t_neg_table x y = negT x := by
  cases x <;> cases y <;> rfl

theorem t_cycle_table_is_cycleT (x y : Trit) : evalTOP t_cycle_table x y = cycleT x := by
  cases x <;> cases y <;> rfl

theorem min_table_is_minT (x y : Trit) : evalTOP min_table x y = minT x y := by
  cases x <;> cases y <;> rfl

theorem max_table_is_maxT (x y : Trit) : evalTOP max_table x y = maxT x y := by
  cases x <;> cases y <;> rfl

theorem csum_table_is_csumT (x y : Trit) : evalTOP csum_table x y = csumT x y := by
  cases x <;> cases y <;> rfl

-- ===========================================================================
-- Section 6: Monoid Composition & Table Folding Theory
-- ===========================================================================

/--
  Fold two 9-entry truth tables into ONE 9-entry table equivalent to their composition:
  T_fold[a][b] = T2[ T1[a][b] ][b]
-/
def foldTable (t1 t2 : Table9) : Table9 :=
  ⟨#[
    evalTOP t2 (evalTOP t1 .neg  .neg)  .neg,
    evalTOP t2 (evalTOP t1 .neg  .zero) .zero,
    evalTOP t2 (evalTOP t1 .neg  .pos)  .pos,
    evalTOP t2 (evalTOP t1 .zero .neg)  .neg,
    evalTOP t2 (evalTOP t1 .zero .zero) .zero,
    evalTOP t2 (evalTOP t1 .zero .pos)  .pos,
    evalTOP t2 (evalTOP t1 .pos  .neg)  .neg,
    evalTOP t2 (evalTOP t1 .pos  .zero) .zero,
    evalTOP t2 (evalTOP t1 .pos  .pos)  .pos
  ]⟩

/--
  Soundness of Table Folding:
  Evaluating the folded table is identically equal to evaluating t1 followed by t2.
-/
theorem fold_soundness (t1 t2 : Table9) (x y : Trit) :
    evalTOP (foldTable t1 t2) x y = evalTOP t2 (evalTOP t1 x y) y := by
  cases x <;> cases y <;> rfl

/--
  Associativity of Table Folding under Evaluation:
  evalTOP (fold (fold t1 t2) t3) = evalTOP (fold t1 (fold t2 t3))
-/
theorem fold_eval_assoc (t1 t2 t3 : Table9) (x y : Trit) :
    evalTOP (foldTable (foldTable t1 t2) t3) x y = evalTOP (foldTable t1 (foldTable t2 t3)) x y := by
  repeat rw [fold_soundness]

-- ===========================================================================
-- Section 7: 27-Entry Carry Table (TOPC) & Multi-Precision Carry Theory
-- ===========================================================================

/-- Full 1-trit adder with carry-in and carry-out: (sum, cout) -/
def fullAddTrit (x y c : Trit) : Trit × Trit :=
  match x, y, c with
  | .neg,  .neg,  .neg  => (.zero, .neg)
  | .neg,  .neg,  .zero => (.pos,  .neg)
  | .neg,  .neg,  .pos  => (.neg,  .zero)
  | .neg,  .zero, .neg  => (.pos,  .neg)
  | .neg,  .zero, .zero => (.neg,  .zero)
  | .neg,  .zero, .pos  => (.zero, .zero)
  | .neg,  .pos,  .neg  => (.neg,  .zero)
  | .neg,  .pos,  .zero => (.zero, .zero)
  | .neg,  .pos,  .pos  => (.pos,  .zero)

  | .zero, .neg,  .neg  => (.pos,  .neg)
  | .zero, .neg,  .zero => (.neg,  .zero)
  | .zero, .neg,  .pos  => (.zero, .zero)
  | .zero, .zero, .neg  => (.neg,  .zero)
  | .zero, .zero, .zero => (.zero, .zero)
  | .zero, .zero, .pos  => (.pos,  .zero)
  | .zero, .pos,  .neg  => (.zero, .zero)
  | .zero, .pos,  .zero => (.pos,  .zero)
  | .zero, .pos,  .pos  => (.neg,  .pos)

  | .pos,  .neg,  .neg  => (.neg,  .zero)
  | .pos,  .neg,  .zero => (.zero, .zero)
  | .pos,  .neg,  .pos  => (.pos,  .zero)
  | .pos,  .zero, .neg  => (.zero, .zero)
  | .pos,  .zero, .zero => (.pos,  .zero)
  | .pos,  .zero, .pos  => (.neg,  .pos)
  | .pos,  .pos,  .neg  => (.pos,  .zero)
  | .pos,  .pos,  .zero => (.neg,  .pos)
  | .pos,  .pos,  .pos  => (.zero, .pos)

/-- 27-row truth table with packed (output, carry) entries -/
structure Table27 where
  entries : Array (Trit × Trit)
  deriving Repr

/-- Evaluate a 27-entry carry table at (x, y, c) matching Tryte-VM TOPC hardware semantics -/
def evalTOPC (tbl : Table27) (x y c : Trit) : Trit × Trit :=
  let idx := match x, y, c with
    | .neg,  .neg,  .neg  => 0
    | .neg,  .neg,  .zero => 1
    | .neg,  .neg,  .pos  => 2
    | .neg,  .zero, .neg  => 3
    | .neg,  .zero, .zero => 4
    | .neg,  .zero, .pos  => 5
    | .neg,  .pos,  .neg  => 6
    | .neg,  .pos,  .zero => 7
    | .neg,  .pos,  .pos  => 8
    | .zero, .neg,  .neg  => 9
    | .zero, .neg,  .zero => 10
    | .zero, .neg,  .pos  => 11
    | .zero, .zero, .neg  => 12
    | .zero, .zero, .zero => 13
    | .zero, .zero, .pos  => 14
    | .zero, .pos,  .neg  => 15
    | .zero, .pos,  .zero => 16
    | .zero, .pos,  .pos  => 17
    | .pos,  .neg,  .neg  => 18
    | .pos,  .neg,  .zero => 19
    | .pos,  .neg,  .pos  => 20
    | .pos,  .zero, .neg  => 21
    | .pos,  .zero, .zero => 22
    | .pos,  .zero, .pos  => 23
    | .pos,  .pos,  .neg  => 24
    | .pos,  .pos,  .zero => 25
    | .pos,  .pos,  .pos  => 26
  tbl.entries.getD idx (.zero, .zero)

/-- Canonical 27-entry carry table for balanced ternary addition -/
def addCarryTable27 : Table27 :=
  ⟨#[
    (.zero, .neg),  (.pos,  .neg),  (.neg,  .zero),
    (.pos,  .neg),  (.neg,  .zero), (.zero, .zero),
    (.neg,  .zero), (.zero, .zero), (.pos,  .zero),

    (.pos,  .neg),  (.neg,  .zero), (.zero, .zero),
    (.neg,  .zero), (.zero, .zero), (.pos,  .zero),
    (.zero, .zero), (.pos,  .zero), (.neg,  .pos),

    (.neg,  .zero), (.zero, .zero), (.pos,  .zero),
    (.zero, .zero), (.pos,  .zero), (.neg,  .pos),
    (.pos,  .zero), (.neg,  .pos),  (.zero, .pos)
  ]⟩

/-- Soundness of 27-row carry table: exactly computes full balanced ternary addition -/
theorem addCarry_soundness (x y c : Trit) :
    evalTOPC addCarryTable27 x y c = fullAddTrit x y c := by
  cases x <;> cases y <;> cases c <;> rfl

/-- Full addition symmetry: x + y + c = y + x + c -/
theorem fullAddTrit_comm (x y c : Trit) :
    fullAddTrit x y c = fullAddTrit y x c := by
  cases x <;> cases y <;> cases c <;> rfl

/-- Zero identity: x + 0 + 0 = (x, 0) -/
theorem fullAddTrit_zero (x : Trit) :
    fullAddTrit x .zero .zero = (x, .zero) := by
  cases x <;> rfl

/-- Integer value of a trit in {-1, 0, 1} -/
def tritVal (t : Trit) : Int :=
  match t with
  | .neg  => -1
  | .zero => 0
  | .pos  => 1

/-- Exact conservation of arithmetic value across the carry ripple -/
theorem fullAdd_arithmetic_value (x y c : Trit) :
    let (s, cout) := fullAddTrit x y c
    tritVal s + 3 * tritVal cout = tritVal x + tritVal y + tritVal c := by
  cases x <;> cases y <;> cases c <;> rfl


