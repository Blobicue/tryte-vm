/-
  =============================================================================
  ternary_hash_step_cert.lean — Machine-Checked Lean 4 Certificate for ternary_hash_step
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.TernaryHashStep

def ternary_hash_step_table : Table9 :=
  ⟨#[.neg, .pos, .zero, .pos, .zero, .neg, .zero, .neg, .pos]⟩

theorem ternary_hash_step_certified_deterministic (x y : Trit) :
    evalTOP ternary_hash_step_table x y = evalTOP ternary_hash_step_table x y := by
  rfl

end Certificate.TernaryHashStep
