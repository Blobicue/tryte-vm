/-
  =============================================================================
  learned_qutrit_add_cert.lean — Machine-Checked Lean 4 Certificate for learned_qutrit_add
  =============================================================================
  Formally proves that learned_qutrit_add executes exact modular addition over Z_3.
-/

import TryteArsenal

open Trit

namespace Certificate.LearnedQutritAdd

/-- The grokked 9-entry truth table for learned_qutrit_add -/
def learned_qutrit_add_table : Table9 :=
  ⟨#[.pos, .neg, .zero, .neg, .zero, .pos, .zero, .pos, .neg]⟩

/-- Formally verified deterministic specification for learned_qutrit_add table -/
theorem learned_qutrit_add_certified_topological (x y : Trit) :
    evalTOP learned_qutrit_add_table x y = addT x y := by
  cases x <;> cases y <;> rfl

end Certificate.LearnedQutritAdd
