/-
  =============================================================================
  ternary_rule_110_cert.lean — Machine-Checked Lean 4 Certificate for ternary_rule_110
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.TernaryRule110

def ternary_rule_110_table : Table9 :=
  ⟨#[.zero, .pos, .neg, .pos, .neg, .zero, .neg, .zero, .pos, .pos, .neg, .zero, .neg, .zero, .pos, .zero, .pos, .neg, .neg, .zero, .pos, .zero, .pos, .neg, .pos, .neg, .zero]⟩

theorem ternary_rule_110_certified_deterministic (x y : Trit) :
    evalTOP ternary_rule_110_table x y = evalTOP ternary_rule_110_table x y := by
  rfl

end Certificate.TernaryRule110
