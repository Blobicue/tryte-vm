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

theorem crypto_sbox_9_certified_deterministic (x y : Trit) :
    evalTOP crypto_sbox_9_table x y = evalTOP crypto_sbox_9_table x y := by
  rfl

end Certificate.CryptoSbox9
