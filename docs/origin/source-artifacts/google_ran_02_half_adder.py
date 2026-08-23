def simulate_half_adder(x, y):
    # Tryte 1: Vector = [1, 0] -> Trit 1: OR, Trit 2: AND
    t1_trit1_out = x | y       # OR
    t1_trit2_out = x & y       # AND (This is also our Carry!)
    
    # Tryte 2: Vector = [-1, 0] -> Trit 1: NOT, Trit 2: AND
    # Trit 1 takes the AND output from Tryte 1 and inverts it
    t2_trit1_out = 1 if (t1_trit2_out == 0) else 0 # NOT
    
    # Trit 2 takes the OR output from Tryte 1 and the NOT output from Tryte 2
    t2_trit2_out = t1_trit1_out & t2_trit1_out    # AND (This is our Sum!)
    
    return t2_trit2_out, t1_trit2_out

# Test all binary combinations
inputs = [(0,0), (0,1), (1,0), (1,1)]
results = []
for x, y in inputs:
    sum_out, carry_out = simulate_half_adder(x, y)
    results.append(f"Input: ({x},{y}) -> Sum (XOR): {sum_out}, Carry (AND): {carry_out}")

print("\n".join(results))