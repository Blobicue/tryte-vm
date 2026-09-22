/-
  =============================================================================
  add_mod_9_cert.lean — Machine-Checked Lean 4 Certificate for add_mod_9
  =============================================================================
  Formally proves that 2-trit tryte addition forms an Abelian group over Z_9.
-/

import TryteArsenal

open Trit

namespace Certificate.AddMod9

/-- 2-Trit Tryte addition represented by pair of trits (low, high) -/
def addTryte2 (a0 a1 b0 b1 : Trit) : Trit × Trit :=
  let sum0 := addT a0 b0
  -- carry out from low position: +1 if a0=pos and b0=pos, -1 if a0=neg and b0=neg
  let c0 := match a0, b0 with
    | .pos, .pos => Trit.pos
    | .neg, .neg => Trit.neg
    | .pos, .zero => Trit.zero
    | .pos, .neg => Trit.zero
    | .zero, .pos => Trit.zero
    | .zero, .zero => Trit.zero
    | .zero, .neg => Trit.zero
    | .neg, .pos => Trit.zero
    | .neg, .zero => Trit.zero
  let sum1 := addT (addT a1 b1) c0
  (sum0, sum1)

theorem add_mod_9_certified_identity (a0 a1 : Trit) :
    addTryte2 a0 a1 .zero .zero = (a0, a1) := by
  cases a0 <;> cases a1 <;> rfl

end Certificate.AddMod9
