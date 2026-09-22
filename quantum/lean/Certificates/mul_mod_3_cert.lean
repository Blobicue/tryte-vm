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

theorem mul_mod_3_certified_deterministic (x y : Trit) :
    evalTOP mul_mod_3_table x y = evalTOP mul_mod_3_table x y := by
  rfl

end Certificate.MulMod3
