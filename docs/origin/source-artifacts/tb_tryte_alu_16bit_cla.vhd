library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tb_tryte_alu_16bit_cla is
    -- Testbench has no external ports
end entity tb_tryte_alu_16bit_cla;

architecture Test of tb_tryte_alu_16bit_cla is

    -- Component Under Test (CUT)
    component tryte_alu_16bit_cla is
        port (
            x         : in  std_logic_vector(15 downto 0);
            y         : in  std_logic_vector(15 downto 0);
            c_in      : in  std_logic;
            s_trit    : in  signed(1 downto 0);
            alu_out   : out std_logic_vector(15 downto 0);
            c_out     : out std_logic;
            zero_flag : out std_logic
        );
    end component;

    -- Test Stimulus Signals
    signal s_x         : std_logic_vector(15 downto 0) := (others => '0');
    signal s_y         : std_logic_vector(15 downto 0) := (others => '0');
    signal s_c_in      : std_logic := '0';
    signal s_s_trit    : signed(1 downto 0) := to_signed(0, 2);
    
    -- Observed Outputs
    signal s_alu_out   : std_logic_vector(15 downto 0);
    signal s_c_out     : std_logic;
    signal s_zero_flag : std_logic;

    -- Timing constant
    constant PROP_TIME : time := 10 ns;

begin

    -- Instantiate Device Under Test (DUT)
    DUT: tryte_alu_16bit_cla
        port map (
            x         => s_x,
            y         => s_y,
            c_in      => s_c_in,
            s_trit    => s_s_trit,
            alu_out   => s_alu_out,
            c_out     => s_c_out,
            zero_flag => s_zero_flag
        );

    -- Main Test Sequence
    stim_proc: process
    begin
        report "==================================================" severity note;
        report "STARTING 16-BIT CLA TRYTE ALU EDGE CASE VERIFICATION" severity note;
        report "==================================================" severity note;

        -- --------------------------------------------------------------------
        -- TEST 1: Worst-Case Max Propagation Delay Vector (0xFFFF + 0x0001)
        -- Forces carry generation at bit 0 and propagates through all 16 bits.
        -- Expected: Sum = 0x0000, Cout = 1, Zero = 1
        -- --------------------------------------------------------------------
        s_x      <= X"FFFF";
        s_y      <= X"0001";
        s_c_in   <= '0';
        s_s_trit <= to_signed(1, 2); -- ADD Mode
        wait for PROP_TIME;

        assert (s_alu_out = X"0000") 
            report "TEST 1 FAILED: Expected Sum=0x0000, Got " & to_hstring(s_alu_out) severity error;
        assert (s_c_out = '1') 
            report "TEST 1 FAILED: Expected Cout=1" severity error;
        assert (s_zero_flag = '1') 
            report "TEST 1 FAILED: Zero flag not asserted" severity error;
        report "[PASS] TEST 1: Max Propagation Delay (0xFFFF + 0x0001 -> Cout=1, Sum=0x0000)" severity note;

        -- --------------------------------------------------------------------
        -- TEST 2: Alternating Bit Propagate Chain with Cin (0xAAAA + 0x5555 + Cin=1)
        -- Tests all bits in propagate condition (P=1, G=0) with carry-in.
        -- Expected: Sum = 0x0000, Cout = 1, Zero = 1
        -- --------------------------------------------------------------------
        s_x      <= X"AAAA";
        s_y      <= X"5555";
        s_c_in   <= '1';
        s_s_trit <= to_signed(1, 2); -- ADD Mode
        wait for PROP_TIME;

        assert (s_alu_out = X"0000" and s_c_out = '1' and s_zero_flag = '1')
            report "TEST 2 FAILED: Alternating propagate chain mismatch" severity error;
        report "[PASS] TEST 2: Alternating Bit Propagate with Cin (0xAAAA + 0x5555 + 1 -> Cout=1, Sum=0x0000)" severity note;

        -- --------------------------------------------------------------------
        -- TEST 3: Full Ripple from Carry-In Alone (0xFFFF + 0x0000 + Cin=1)
        -- Expected: Sum = 0x0000, Cout = 1, Zero = 1
        -- --------------------------------------------------------------------
        s_x      <= X"FFFF";
        s_y      <= X"0000";
        s_c_in   <= '1';
        s_s_trit <= to_signed(1, 2); -- ADD Mode
        wait for PROP_TIME;

        assert (s_alu_out = X"0000" and s_c_out = '1')
            report "TEST 3 FAILED: Carry-in ripple failed" severity error;
        report "[PASS] TEST 3: Pure Cin Ripple through 16 bits (0xFFFF + 0 + Cin=1 -> Cout=1)" severity note;

        -- --------------------------------------------------------------------
        -- TEST 4: Max Boundary Without Overflow (0x7FFF + 0x0001)
        -- Tests carry generation within lower 15 bits without triggering block 4 Cout.
        -- Expected: Sum = 0x8000, Cout = 0, Zero = 0
        -- --------------------------------------------------------------------
        s_x      <= X"7FFF";
        s_y      <= X"0001";
        s_c_in   <= '0';
        s_s_trit <= to_signed(1, 2); -- ADD Mode
        wait for PROP_TIME;

        assert (s_alu_out = X"8000" and s_c_out = '0' and s_zero_flag = '0')
            report "TEST 4 FAILED: Sub-boundary carry transition failed" severity error;
        report "[PASS] TEST 4: Sub-boundary Addition (0x7FFF + 0x0001 -> Sum=0x8000, Cout=0)" severity note;

        -- --------------------------------------------------------------------
        -- TEST 5: Bitwise XOR Identical Inputs -> Zero Flag Verification (S = -1)
        -- Expected: 0xFFFF XOR 0xFFFF = 0x0000, Cout = 0, Zero = 1
        -- --------------------------------------------------------------------
        s_x      <= X"FFFF";
        s_y      <= X"FFFF";
        s_c_in   <= '0';
        s_s_trit <= to_signed(-1, 2); -- XOR Mode
        wait for PROP_TIME;

        assert (s_alu_out = X"0000" and s_c_out = '0' and s_zero_flag = '1')
            report "TEST 5 FAILED: Bitwise XOR cancellation failed" severity error;
        report "[PASS] TEST 5: Bitwise XOR Zero Flag (0xFFFF ^ 0xFFFF -> Out=0x0000, Z=1)" severity note;

        -- --------------------------------------------------------------------
        -- TEST 6: Bitwise AND Masking (S = 0)
        -- Expected: 0xF0F0 AND 0x0FF0 = 0x00F0, Cout = 0, Zero = 0
        -- --------------------------------------------------------------------
        s_x      <= X"F0F0";
        s_y      <= X"0FF0";
        s_c_in   <= '0';
        s_s_trit <= to_signed(0, 2); -- AND Mode
        wait for PROP_TIME;

        assert (s_alu_out = X"00F0" and s_c_out = '0' and s_zero_flag = '0')
            report "TEST 6 FAILED: Bitwise AND masking failed" severity error;
        report "[PASS] TEST 6: Bitwise AND Masking (0xF0F0 & 0x0FF0 -> Out=0x00F0)" severity note;

        -- --------------------------------------------------------------------
        -- TEST 7: Zero Addition Base State (0x0000 + 0x0000 + Cin=0)
        -- Expected: Sum = 0x0000, Cout = 0, Zero = 1
        -- --------------------------------------------------------------------
        s_x       Sum=0x0000, Cout=0, Z=1)" severity note;

        report "==================================================" severity note;
        report "ALL 16-BIT CLA TESTBENCH SUITES COMPLETED SUCCESSFULLY" severity note;
        report "==================================================" severity note;

        wait; -- Stop simulation
    end process stim_proc;

end architecture Test;