/-
  =============================================================================
  t_cycle_cert.lean — Machine-Checked Lean 4 Certificate for t_cycle
  =============================================================================
  Formally proves that t_cycle forms an exact cyclic permutation of order 3.
-/

import TryteArsenal

open Trit

namespace Certificate.TCycle

def t_cycle_table : Table9 :=
  ⟨#[.zero, .zero, .zero, .pos, .pos, .pos, .neg, .neg, .neg]⟩

theorem t_cycle_certified (x y : Trit) : evalTOP t_cycle_table x y = cycleT x := by
  cases x <;> cases y <;> rfl

theorem t_cycle_order_three (x : Trit) : cycleT (cycleT (cycleT x)) = x := by
  cases x <;> rfl

end Certificate.TCycle
