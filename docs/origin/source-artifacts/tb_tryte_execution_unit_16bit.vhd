library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tb_tryte_execution_unit_16bit is
end entity tb_tryte_execution_unit_16bit;

architecture Test of tb_tryte_execution_unit_16bit is

    component tryte_execution_unit_16bit is
        port (
            clk           : in  std_logic;
            rst_n         : in  std_logic;
            s_trit_in     : in  signed(1 downto 0);
            c_in_raw      : in  std_logic;
            acc_load      : in  std_logic;
            acc_en_feed   : in  std_logic;
            bus_x         : in  std_logic_vector(15 downto 0);
            bus_y         : in  std_logic_vector(15 downto 0);
            acc_data_out  : out std_logic_vector(15 downto 0);
            flag_c        : out std_logic;
            flag_z        : out std_logic;
            flag_v        : out std_logic;
            flag_n        : out std_logic
        );
    end component;

    -- Clock & Control Signals
    signal s_clk         : std_logic := '0';
    signal s_rst_n       : std_logic := '0';
    signal s_trit_in     : signed(1 downto 0) := to_signed(0, 2);
    signal s_c_in_raw    : std_logic := '0';
    signal s_acc_load    : std_logic := '0';
    signal s_acc_en_feed : std_logic := '0';

    -- Data Buses
    signal s_bus_x       : std_logic_vector(15 downto 0) := (others => '0');
    signal s_bus_y       : std_logic_vector(15 downto 0) := (others => '0');
    signal s_acc_data_out: std_logic_vector(15 downto 0);

    -- Status Flags
    signal s_flag_c      : std_logic;
    signal s_flag_z      : std_logic;
    signal s_flag_v      : std_logic;
    signal s_flag_n      : std_logic;

    -- 100MHz Clock (10ns Period)
    constant CLK_PERIOD  : time := 10 ns;

begin

    -- Instantiate Synchronous Unit
    DUT: tryte_execution_unit_16bit
        port map (
            clk          => s_clk,
            rst_n        => s_rst_n,
            s_trit_in    => s_trit_in,
            c_in_raw     => s_c_in_raw,
            acc_load     => s_acc_load,
            acc_en_feed  => s_acc_en_feed,
            bus_x        => s_bus_x,
            bus_y        => s_bus_y,
            acc_data_out => s_acc_data_out,
            flag_c       => s_flag_c,
            flag_z       => s_flag_z,
            flag_v       => s_flag_v,
            flag_n       => s_flag_n
        );

    -- Clock Generation
    clk_process: process
    begin
        s_clk <= '0';
        wait for CLK_PERIOD / 2;
        s_clk <= '1';
        wait for CLK_PERIOD / 2;
    end process;

    -- Stimulus Sequence
    stim_proc: process
    begin
        report "==================================================" severity note;
        report "STARTING SYNCHRONOUS TPU / ACCUMULATOR VERIFICATION" severity note;
        report "==================================================" severity note;

        -- 1. Initialize System via Reset
        s_rst_n       <= '0';
        s_acc_load    <= '1';
        s_acc_en_feed <= '0';
        wait for CLK_PERIOD * 2;
        s_rst_n       <= '1';
        wait for CLK_PERIOD;

        assert (s_acc_data_out = X"0000" and s_flag_z = '1')
            report "RESET FAILED: ACC not cleared to 0" severity error;
        report "[PASS] Reset sequence verified. ACC = 0x0000, Zero Flag = 1" severity note;

        -- --------------------------------------------------------------------
        -- CYCLE 1: Seed ACC with initial addition (ACC <= 0x0100 + 0x0050 = 0x0150)
        -- --------------------------------------------------------------------
        s_bus_x       <= X"0100";
        s_bus_y       <= X"0050";
        s_c_in_raw    <= '0';
        s_trit_in     <= to_signed(1, 2); -- ADD
        s_acc_en_feed <= '0';              -- Read from bus_x
        s_acc_load    <= '1';
        wait for CLK_PERIOD;               -- Pipeline: Stage 1 Latched
        wait for CLK_PERIOD;               -- Pipeline: Stage 2 Evaluated & Latch into ACC

        assert (s_acc_data_out = X"0150")
            report "CYCLE 1 FAILED: Expected ACC=0x0150, got " & to_hstring(s_acc_data_out) severity error;
        report "[PASS] Cycle 1: Seeded ACC with initial sum (ACC = 0x0150)" severity note;

        -- --------------------------------------------------------------------
        -- CYCLE 2: Compound Accumulation via Loopback (ACC <= ACC + 0x0050 = 0x01A0)
        -- --------------------------------------------------------------------
        s_acc_en_feed <= '1';              -- Switch input X to internal ACC loop
        s_bus_y       <= X"0050";
        s_trit_in     <= to_signed(1, 2); -- ADD
        wait for CLK_PERIOD;
        wait for CLK_PERIOD;

        assert (s_acc_data_out = X"01A0")
            report "CYCLE 2 FAILED: Feedback accumulation failed. Expected 0x01A0, got " & to_hstring(s_acc_data_out) severity error;
        report "[PASS] Cycle 2: Compound ACC Loopback verified (0x0150 + 0x0050 = 0x01A0)" severity note;

        -- --------------------------------------------------------------------
        -- CYCLE 3: In-Place Bitwise Masking (ACC <= ACC AND 0x00F0 = 0x00A0)
        -- --------------------------------------------------------------------
        s_acc_en_feed <= '1';              -- Retain ACC feedback
        s_bus_y       <= X"00F0";
        s_trit_in     <= to_signed(0, 2); -- Bitwise AND Mode
        wait for CLK_PERIOD;
        wait for CLK_PERIOD;

        assert (s_acc_data_out = X"00A0")
            report "CYCLE 3 FAILED: Masking failed. Expected 0x00A0, got " & to_hstring(s_acc_data_out) severity error;
        report "[PASS] Cycle 3: In-Place Bitwise Masking verified (0x01A0 AND 0x00F0 = 0x00A0)" severity note;

        -- --------------------------------------------------------------------
        -- CYCLE 4: Overflow Check (0x7000 + 0x2000 = 0x9000, V=1, N=1)
        -- --------------------------------------------------------------------
        s_acc_en_feed <= '0';
        s_bus_x       <= X"7000";
        s_bus_y       <= X"2000";
        s_trit_in     <= to_signed(1, 2); -- ADD Mode
        wait for CLK_PERIOD;
        wait for CLK_PERIOD;

        assert (s_acc_data_out = X"9000" and s_flag_v = '1' and s_flag_n = '1')
            report "CYCLE 4 FAILED: Overflow/Sign detection failed" severity error;
        report "[PASS] Cycle 4: Signed 2's Complement Overflow asserted (V=1, N=1, ACC=0x9000)" severity note;

        report "==================================================" severity note;
        report "ALL SYNCHRONOUS TPU TESTS COMPLETED SUCCESSFULLY" severity note;
        report "==================================================" severity note;

        wait;
    end process stim_proc;

end architecture Test;