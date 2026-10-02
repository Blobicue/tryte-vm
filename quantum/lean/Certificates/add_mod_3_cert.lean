/-
  =============================================================================
  add_mod_3_cert.lean — Machine-Checked Lean 4 Certificate for add_mod_3
  =============================================================================
  Formally proves that the grokked 9-entry TOP table executes exact modular
  addition over Z_3 in balanced ternary representation.
-/

import TryteArsenal

open Trit

namespace Certificate.AddMod3

/-- The grokked 9-entry TOP truth table for add_mod_3 -/
def add_mod_3_table : Table9 :=
  ⟨#[.pos, .neg, .zero, .neg, .zero, .pos, .zero, .pos, .neg]⟩

/--
  Theorem: The add_mod_3 table is bit-exact equivalent to modular addition over Z_3.
  Proved exhaustively across all 9 states in Trit x Trit with zero admissions.
-/
theorem add_mod_3_certified (x y : Trit) : evalTOP add_mod_3_table x y = addT x y := by
  cases x <;> cases y <;> rfl

end Certificate.AddMod3
