/-
  =============================================================================
  nor_ternary_cert.lean — Machine-Checked Lean 4 Certificate for nor_ternary
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.NorTernary

def nor_ternary_table : Table9 :=
  ⟨#[.pos, .zero, .neg, .zero, .zero, .neg, .neg, .neg, .neg]⟩

/-- Formally verified deterministic specification for nor_ternary -/
theorem nor_ternary_certified (x y : Trit) :
    evalTOP nor_ternary_table x y =
      match x, y with
      | .neg,  .neg  => .pos
      | .neg,  .zero => .zero
      | .neg,  .pos  => .neg
      | .zero, .neg  => .zero
      | .zero, .zero => .zero
      | .zero, .pos  => .neg
      | .pos,  .neg  => .neg
      | .pos,  .zero => .neg
      | .pos,  .pos  => .neg := by
  cases x <;> cases y <;> rfl

/-- Proves equivalence with ternary NOR operator -/
theorem nor_ternary_certified_nor (x y : Trit) :
    evalTOP nor_ternary_table x y = norT x y := by
  cases x <;> cases y <;> rfl

end Certificate.NorTernary
