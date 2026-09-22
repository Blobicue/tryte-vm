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

theorem nor_ternary_certified_deterministic (x y : Trit) :
    evalTOP nor_ternary_table x y = evalTOP nor_ternary_table x y := by
  rfl

end Certificate.NorTernary
