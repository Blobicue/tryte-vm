/-
  =============================================================================
  qutrit_h3_cert.lean — Machine-Checked Lean 4 Certificate for qutrit_h3
  =============================================================================
  Formally proves deterministic 9-element truth table specification for qutrit_h3.
-/

import TryteArsenal

open Trit

namespace Certificate.QutritH3

/-- The 9-entry truth table for qutrit_h3 -/
def qutrit_h3_table : Table9 :=
  ⟨#[.pos, .zero, .neg, .zero, .neg, .pos, .neg, .pos, .zero]⟩

/-- Formally verified deterministic specification for qutrit_h3 table -/
theorem qutrit_h3_certified_topological (x y : Trit) :
    evalTOP qutrit_h3_table x y =
      match x, y with
      | .neg,  .neg  => .pos
      | .neg,  .zero => .zero
      | .neg,  .pos  => .neg
      | .zero, .neg  => .zero
      | .zero, .zero => .neg
      | .zero, .pos  => .pos
      | .pos,  .neg  => .neg
      | .pos,  .zero => .pos
      | .pos,  .pos  => .zero := by
  cases x <;> cases y <;> rfl

end Certificate.QutritH3
