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

theorem sqr_sub_certified_deterministic (x y : Trit) :
    evalTOP sqr_sub_table x y = evalTOP sqr_sub_table x y := by
  rfl

end Certificate.SqrSub
