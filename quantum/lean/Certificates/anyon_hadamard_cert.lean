/-
  =============================================================================
  anyon_hadamard_cert.lean — Machine-Checked Lean 4 Certificate for anyon_hadamard
  =============================================================================
  Formally proves deterministic 9-element truth table specification for anyon_hadamard.
-/

import TryteArsenal

open Trit

namespace Certificate.AnyonHadamard

/-- The 9-entry truth table for anyon_hadamard -/
def anyon_hadamard_table : Table9 :=
  ⟨#[.zero, .pos, .neg, .pos, .neg, .zero, .neg, .zero, .pos]⟩

/-- Formally verified deterministic specification for anyon_hadamard table -/
theorem anyon_hadamard_certified_topological (x y : Trit) :
    evalTOP anyon_hadamard_table x y =
      match x, y with
      | .neg,  .neg  => .zero
      | .neg,  .zero => .pos
      | .neg,  .pos  => .neg
      | .zero, .neg  => .pos
      | .zero, .zero => .neg
      | .zero, .pos  => .zero
      | .pos,  .neg  => .neg
      | .pos,  .zero => .zero
      | .pos,  .pos  => .pos := by
  cases x <;> cases y <;> rfl

end Certificate.AnyonHadamard
