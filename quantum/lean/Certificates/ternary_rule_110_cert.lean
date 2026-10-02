/-
  =============================================================================
  ternary_rule_110_cert.lean — Machine-Checked Lean 4 Certificate for ternary_rule_110
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.TernaryRule110

/-- Table definition for ternary_rule_110 (27 entries) -/
def ternary_rule_110_table : RuleTable27 :=
  ⟨#[.zero, .pos, .neg, .pos, .neg, .zero, .neg, .zero, .pos, .pos, .neg, .zero, .neg, .zero, .pos, .zero, .pos, .neg, .neg, .zero, .pos, .zero, .pos, .neg, .pos, .neg, .zero]⟩

/-- Formally verified deterministic specification for ternary_rule_110 across all 27 ternary neighborhood states -/
theorem ternary_rule_110_certified (l c r : Trit) :
    evalRule27 ternary_rule_110_table l c r =
      match l, c, r with
      | .neg,  .neg,  .neg  => .zero
      | .neg,  .neg,  .zero  => .pos
      | .neg,  .neg,  .pos  => .neg
      | .neg,  .zero,  .neg  => .pos
      | .neg,  .zero,  .zero  => .neg
      | .neg,  .zero,  .pos  => .zero
      | .neg,  .pos,  .neg  => .neg
      | .neg,  .pos,  .zero  => .zero
      | .neg,  .pos,  .pos  => .pos
      | .zero,  .neg,  .neg  => .pos
      | .zero,  .neg,  .zero  => .neg
      | .zero,  .neg,  .pos  => .zero
      | .zero,  .zero,  .neg  => .neg
      | .zero,  .zero,  .zero  => .zero
      | .zero,  .zero,  .pos  => .pos
      | .zero,  .pos,  .neg  => .zero
      | .zero,  .pos,  .zero  => .pos
      | .zero,  .pos,  .pos  => .neg
      | .pos,  .neg,  .neg  => .neg
      | .pos,  .neg,  .zero  => .zero
      | .pos,  .neg,  .pos  => .pos
      | .pos,  .zero,  .neg  => .zero
      | .pos,  .zero,  .zero  => .pos
      | .pos,  .zero,  .pos  => .neg
      | .pos,  .pos,  .neg  => .pos
      | .pos,  .pos,  .zero  => .neg
      | .pos,  .pos,  .pos  => .zero := by
  cases l <;> cases c <;> cases r <;> rfl

end Certificate.TernaryRule110
