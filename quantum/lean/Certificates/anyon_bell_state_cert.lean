/-
  =============================================================================
  anyon_bell_state_cert.lean — Machine-Checked Lean 4 Certificate for anyon_bell_state
  =============================================================================
  Formally proves deterministic 9-element truth table specification for anyon_bell_state.
-/

import TryteArsenal

open Trit

namespace Certificate.AnyonBellState

/-- The 9-entry truth table for anyon_bell_state -/
def anyon_bell_state_table : Table9 :=
  ⟨#[.neg, .zero, .pos, .zero, .pos, .neg, .pos, .neg, .zero]⟩

/-- Formally verified deterministic specification for anyon_bell_state table -/
theorem anyon_bell_state_certified_topological (x y : Trit) :
    evalTOP anyon_bell_state_table x y =
      match x, y with
      | .neg,  .neg  => .neg
      | .neg,  .zero => .zero
      | .neg,  .pos  => .pos
      | .zero, .neg  => .zero
      | .zero, .zero => .pos
      | .zero, .pos  => .neg
      | .pos,  .neg  => .pos
      | .pos,  .zero => .neg
      | .pos,  .pos  => .zero := by
  cases x <;> cases y <;> rfl

end Certificate.AnyonBellState
