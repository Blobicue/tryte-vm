library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tryte_execution_unit_16bit is
    port (
        -- Clock & Synchronous Reset
        clk           : in  std_logic;                     -- Master System Clock
        rst_n         : in  std_logic;                     -- Active-Low Synchronous Reset
        
        -- Control & Execution Opcodes
        s_trit_in     : in  signed(1 downto 0);            -- Control Trit: -1 (XOR), 0 (AND), +1 (ADD)
        c_in_raw      : in  std_logic;                     -- Raw External Carry-In
        acc_load      : in  std_logic;                     -- Load Enable for Accumulator
        acc_en_feed   : in  std_logic;                     -- Feedback Select: '1' -> ACC as Operand X, '0' -> Ext Bus X
        
        -- Data Buses
        bus_x         : in  std_logic_vector(15 downto 0); -- External Input Bus X
        bus_y         : in  std_logic_vector(15 downto 0); -- External Input Bus Y
        
        -- Registered Outputs
        acc_data_out  : out std_logic_vector(15 downto 0); -- Accumulator Output Bus
        flag_c        : out std_logic;                     -- Latched Carry Flag
        flag_z        : out std_logic;                     -- Latched Zero Flag
        flag_v        : out std_logic;                     -- Latched Two's Complement Overflow Flag
        flag_n        : out std_logic                      -- Latched Negative/Sign Flag
    );
end entity tryte_execution_unit_16bit;

architecture RTL of tryte_execution_unit_16bit is

    -- Component Declaration: Combinatorial 16-bit CLA Tryte ALU Core
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

    -- Pipeline Stage 1: Operand and Control Registers
    signal reg_x      : std_logic_vector(15 downto 0);
    signal reg_y      : std_logic_vector(15 downto 0);
    signal reg_cin    : std_logic;
    signal reg_trit   : signed(1 downto 0);

    -- Intermediate Combinatorial ALU Core Signals
    signal alu_comb_out : std_logic_vector(15 downto 0);
    signal alu_comb_cout: std_logic;
    signal alu_comb_zero: std_logic;

    -- Pipeline Stage 2: Accumulator & Status Flag Registers
    signal acc_reg      : std_logic_vector(15 downto 0);
    signal reg_flag_c   : std_logic;
    signal reg_flag_z   : std_logic;
    signal reg_flag_v   : std_logic;
    signal reg_flag_n   : std_logic;

    -- Internal Multiplexed Input for Bus X
    signal selected_x   : std_logic_vector(15 downto 0);

begin

    -- ------------------------------------------------------------------------
    -- Accumulator Feedback MUX (Select External X or Internal ACC Loop)
    -- ------------------------------------------------------------------------
    selected_x <= acc_reg when (acc_en_feed = '1') else bus_x;

    -- ------------------------------------------------------------------------
    -- Pipeline Stage 1: Synchronous Input Latching
    -- ------------------------------------------------------------------------
    process(clk)
    begin
        if rising_edge(clk) then
            if rst_n = '0' then
                reg_x    <= (others => '0');
                reg_y    <= (others => '0');
                reg_cin  <= '0';
                reg_trit <= to_signed(0, 2);
            else
                reg_x    <= selected_x;
                reg_y    <= bus_y;
                reg_cin  <= c_in_raw;
                reg_trit <= s_trit_in;
            end if;
        end if;
    end process;

    -- ------------------------------------------------------------------------
    -- Combinatorial Core: 16-Bit CLA Tryte ALU
    -- ------------------------------------------------------------------------
    ALU_CORE: tryte_alu_16bit_cla
        port map (
            x         => reg_x,
            y         => reg_y,
            c_in      => reg_cin,
            s_trit    => reg_trit,
            alu_out   => alu_comb_out,
            c_out     => alu_comb_cout,
            zero_flag => alu_comb_zero
        );

    -- ------------------------------------------------------------------------
    -- Pipeline Stage 2: Accumulator Latch & Flag Generation Process
    -- ------------------------------------------------------------------------
    process(clk)
        variable v_overflow : std_logic;
    begin
        if rising_edge(clk) then
            if rst_n = '0' then
                acc_reg    <= (others => '0');
                reg_flag_c <= '0';
                reg_flag_z <= '1';
                reg_flag_v <= '0';
                reg_flag_n <= '0';
            elsif acc_load = '1' then
                -- Latch ALU Data to Accumulator
                acc_reg <= alu_comb_out;

                -- Latched Zero & Carry Flags
                reg_flag_z <= alu_comb_zero;
                reg_flag_c <= alu_comb_cout;

                -- Latched Sign Flag (MSB = 1 indicates negative in 2's complement)
                reg_flag_n <= alu_comb_out(15);

                -- Overflow Flag (V) for Addition (S_TRIT = +1)
                -- V = (RegX[15] == RegY[15]) AND (RegX[15] != Sum[15])
                if reg_trit = to_signed(1, 2) then
                    v_overflow := (reg_x(15) xnor reg_y(15)) and (reg_x(15) xor alu_comb_out(15));
                else
                    v_overflow := '0';
                end if;
                reg_flag_v <= v_overflow;
            end if;
        end if;
    end process;

    -- ------------------------------------------------------------------------
    -- Registered Outputs
    -- ------------------------------------------------------------------------
    acc_data_out <= acc_reg;
    flag_c       <= reg_flag_c;
    flag_z       <= reg_flag_z;
    flag_v       <= reg_flag_v;
    flag_n       <= reg_flag_n;

end architecture RTL;