/-
  =============================================================================
  sqr_sub_cert.lean — Machine-Checked Lean 4 Certificate for sqr_sub
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.SqrSub

def sqr_sub_table : Table9 :=
  ⟨#[.neg, .pos, .zero, .pos, .zero, .neg, .neg, .pos, .zero]⟩

/-- Formally verified deterministic specification for sqr_sub -/
theorem sqr_sub_certified (x y : Trit) :
    evalTOP sqr_sub_table x y =
      match x, y with
      | .neg,  .neg  => .neg
      | .neg,  .zero => .pos
      | .neg,  .pos  => .zero
      | .zero, .neg  => .pos
      | .zero, .zero => .zero
      | .zero, .pos  => .neg
      | .pos,  .neg  => .neg
      | .pos,  .zero => .pos
      | .pos,  .pos  => .zero := by
  cases x <;> cases y <;> rfl

end Certificate.SqrSub
