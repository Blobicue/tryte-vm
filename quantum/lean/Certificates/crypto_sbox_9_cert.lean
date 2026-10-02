/-
  =============================================================================
  crypto_sbox_9_cert.lean — Machine-Checked Lean 4 Certificate for crypto_sbox_9
  =============================================================================
-/

import TryteArsenal

open Trit

namespace Certificate.CryptoSbox9

def crypto_sbox_9_table : Table9 :=
  ⟨#[.pos, .neg, .zero, .pos, .zero, .neg, .neg, .pos, .zero]⟩

/-- Formally verified deterministic specification for crypto_sbox_9 -/
theorem crypto_sbox_9_certified (x y : Trit) :
    evalTOP crypto_sbox_9_table x y =
      match x, y with
      | .neg,  .neg  => .pos
      | .neg,  .zero => .neg
      | .neg,  .pos  => .zero
      | .zero, .neg  => .pos
      | .zero, .zero => .zero
      | .zero, .pos  => .neg
      | .pos,  .neg  => .neg
      | .pos,  .zero => .pos
      | .pos,  .pos  => .zero := by
  cases x <;> cases y <;> rfl

end Certificate.CryptoSbox9
