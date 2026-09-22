/-
  =============================================================================
  t_neg_cert.lean — Machine-Checked Lean 4 Certificate for t_neg
  =============================================================================
  Formally proves that the reversible negation circuit is an involution.
-/

import TryteArsenal

open Trit

namespace Certificate.TNeg

def t_neg_table : Table9 :=
  ⟨#[.pos, .pos, .pos, .zero, .zero, .zero, .neg, .neg, .neg]⟩

theorem t_neg_certified (x y : Trit) : evalTOP t_neg_table x y = negT x := by
  cases x <;> cases y <;> rfl

theorem t_neg_involution (x : Trit) : negT (negT x) = x := by
  cases x <;> rfl

end Certificate.TNeg
