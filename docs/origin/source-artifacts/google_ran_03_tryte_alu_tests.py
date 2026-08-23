def simulate_tryte_alu(x_bits, y_bits, cin, s_trit):
    """
    x_bits: list of 4 ints (0 or 1), [x3, x2, x1, x0] (MSB to LSB)
    y_bits: list of 4 ints (0 or 1), [y3, y2, y1, y0] (MSB to LSB)
    cin: int (0 or 1)
    s_trit: int (-1: XOR, 0: AND, 1: ADD)
    """
    current_carry = cin
    outputs = [0] * 4
    slice_traces = []

    # Iterate from LSB (index 3) up to MSB (index 0)
    for i in range(3, -1, -1):
        xi = x_bits[i]
        yi = y_bits[i]

        xor_val = xi ^ yi
        and_val = xi & yi
        sum_val = xor_val ^ current_carry
        cout_val = and_val | (xor_val & current_carry)

        if s_trit == -1:
            out_i = xor_val
        elif s_trit == 0:
            out_i = and_val
        elif s_trit == 1:
            out_i = sum_val
        else:
            raise ValueError("Invalid trit state")

        outputs[i] = out_i
        slice_traces.append({
            'slice': 3 - i,
            'xi': xi,
            'yi': yi,
            'cin': current_carry,
            'xor': xor_val,
            'and': and_val,
            'sum': sum_val,
            'cout': cout_val,
            'out': out_i
        })
        current_carry = cout_val

    final_cout = current_carry if s_trit == 1 else 0
    zero_flag = 1 if all(b == 0 for b in outputs) else 0

    return {
        'outputs': outputs,
        'final_cout': final_cout,
        'zero_flag': zero_flag,
        'slices': slice_traces[::-1] # return MSB to LSB
    }

# Test Cases:
test_cases = [
    # (Name, X, Y, Cin, S_trit, Expected Out, Expected Cout)
    ("Bitwise XOR (5 ^ 3)", [0,1,0,1], [0,0,1,1], 0, -1, [0,1,1,0], 0),
    ("Bitwise AND (5 & 3)", [0,1,0,1], [0,0,1,1], 0,  0, [0,0,0,1], 0),
    ("4-Bit Addition (5 + 3, Cin=0)", [0,1,0,1], [0,0,1,1], 0,  1, [1,0,0,0], 0),
    ("4-Bit Addition with Overflow (13 + 5, Cin=0 = 18 -> Out=2, Cout=1)", [1,1,0,1], [0,1,0,1], 0, 1, [0,0,1,0], 1),
    ("4-Bit Addition with Cin (7 + 8 + 1 = 16 -> Out=0, Cout=1)", [0,1,1,1], [1,0,0,0], 1, 1, [0,0,0,0], 1),
    ("Zero Flag Check (5 ^ 5 = 0)", [0,1,0,1], [0,1,0,1], 0, -1, [0,0,0,0], 0)
]

all_passed = True
results_summary = []

for name, x, y, cin, s, exp_out, exp_cout in test_cases:
    res = simulate_tryte_alu(x, y, cin, s)
    passed = (res['outputs'] == exp_out) and (res['final_cout'] == exp_cout)
    if not passed:
        all_passed = False
    results_summary.append((name, res['outputs'], res['final_cout'], res['zero_flag'], passed))

import tabulate
print(f"All Tests Passed: {all_passed}\n")
table_data = [[n, o, c, z, "PASS" if p else "FAIL"] for n, o, c, z, p in results_summary]
print(tabulate.tabulate(table_data, headers=["Test Case", "Output [3:0]", "C_out", "Zero Flag", "Status"]))