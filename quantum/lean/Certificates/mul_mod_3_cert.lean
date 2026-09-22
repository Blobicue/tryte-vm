/-
  =============================================================================
  mul_mod_3_cert.lean — Machine-Checked Lean 4 Certificate for mul_mod_3
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.MulMod3

def mul_mod_3_table : Table9 :=
  ⟨#[.pos, .zero, .neg, .zero, .zero, .zero, .neg, .zero, .pos]⟩

/-- Formally verified deterministic specification for mul_mod_3 -/
theorem mul_mod_3_certified (x y : Trit) :
    evalTOP mul_mod_3_table x y =
      match x, y with
      | .neg,  .neg  => .pos
      | .neg,  .zero => .zero
      | .neg,  .pos  => .neg
      | .zero, .neg  => .zero
      | .zero, .zero => .zero
      | .zero, .pos  => .zero
      | .pos,  .neg  => .neg
      | .pos,  .zero => .zero
      | .pos,  .pos  => .pos := by
  cases x <;> cases y <;> rfl

/-- Proves equivalence with abstract multiplication over Z_3 -/
theorem mul_mod_3_certified_mul (x y : Trit) :
    evalTOP mul_mod_3_table x y = mulT x y := by
  cases x <;> cases y <;> rfl

end Certificate.MulMod3
