import TryteArsenal

namespace Certificate.TernaryHashStep

/-- Table definition for ternary_hash_step -/
def table : Table9 := ⟨#[.neg, .pos, .zero, .pos, .zero, .neg, .zero, .neg, .pos]⟩

/-- Formally verified deterministic specification for ternary_hash_step -/
theorem ternary_hash_step_certified (x y : Trit) :
    evalTOP table x y =
      match x, y with
      | .neg,  .neg  => .neg
      | .neg,  .zero => .pos
      | .neg,  .pos  => .zero
      | .zero, .neg  => .pos
      | .zero, .zero => .zero
      | .zero, .pos  => .neg
      | .pos,  .neg  => .zero
      | .pos,  .zero => .neg
      | .pos,  .pos  => .pos := by
  cases x <;> cases y <;> rfl

end Certificate.TernaryHashStep
