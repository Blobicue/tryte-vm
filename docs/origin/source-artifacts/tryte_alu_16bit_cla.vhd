library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity tryte_alu_16bit_cla is
    port (
        x         : in  std_logic_vector(15 downto 0); -- 16-bit Input Bus X
        y         : in  std_logic_vector(15 downto 0); -- 16-bit Input Bus Y
        c_in      : in  std_logic;                     -- Global Carry In
        s_trit    : in  signed(1 downto 0);            -- Control Trit: -1 (XOR), 0 (AND), +1 (ADD)
        alu_out   : out std_logic_vector(15 downto 0); -- 16-bit Output Bus
        c_out     : out std_logic;                     -- Lookahead Carry Out Flag
        zero_flag : out std_logic                      -- Zero Detection Flag
    );
end entity tryte_alu_16bit_cla;

architecture Structural of tryte_alu_16bit_cla is

    -- Component Declaration: 4-Bit CLA Unit
    component cla_generator_4bit is
        port (
            c_in  : in  std_logic;
            p_in  : in  std_logic_vector(3 downto 0);
            g_in  : in  std_logic_vector(3 downto 0);
            c_out : out std_logic_vector(3 downto 1);
            c_4   : out std_logic;
            p_g   : out std_logic;
            g_g   : out std_logic
        );
    end component;

    -- Bit-sliced intermediate nodes
    signal stage1_or   : std_logic_vector(15 downto 0);
    signal stage1_and  : std_logic_vector(15 downto 0); -- Also Generate (G)
    signal stage2_xor  : std_logic_vector(15 downto 0); -- Also Propagate (P)
    signal stage3_sum  : std_logic_vector(15 downto 0);

    -- CLA Carry Buses
    signal carries     : std_logic_vector(16 downto 0); -- Carry lines for each individual slice
    signal blk_c_in    : std_logic_vector(3 downto 0);  -- Block carry-ins (C0, C4, C8, C12)
    signal blk_pg      : std_logic_vector(3 downto 0);  -- Block Propagate Groups
    signal blk_gg      : std_logic_vector(3 downto 0);  -- Block Generate Groups

    signal mux_out     : std_logic_vector(15 downto 0);
    signal cout_reg    : std_logic;

begin

    -- ------------------------------------------------------------------------
    -- 1. Bit-Sliced Intermediate Processing (Stages 1 & 2)
    -- ------------------------------------------------------------------------
    GEN_SLICES: for i in 0 to 15 generate
        -- Stage 1: Tryte Vector [+1, 0] -> OR, AND
        stage1_or(i)  <= x(i) or y(i);
        stage1_and(i) <= x(i) and y(i); -- Generate (G_i)

        -- Stage 2: Tryte Vector [-1, 0] -> (NOT, AND) => XOR
        stage2_xor(i) <= stage1_or(i) and (not stage1_and(i)); -- Propagate (P_i)

        -- Stage 3: Fast Addition sum resolved with CLA carry
        stage3_sum(i) <= stage2_xor(i) xor carries(i);
    end generate GEN_SLICES;

    -- ------------------------------------------------------------------------
    -- 2. Top-Level / Hierarchical Lookahead Carry Network
    -- ------------------------------------------------------------------------
    carries(0) <= c_in;
    blk_c_in(0) <= c_in;

    -- Second-Level CLA: Resolves block carry-ins (C4, C8, C12, C16)
    TOP_CLA: cla_generator_4bit
        port map (
            c_in     => c_in,
            p_in     => blk_pg,
            g_in     => blk_gg,
            c_out(1) => blk_c_in(1), -- C4
            c_out(2) => blk_c_in(2), -- C8
            c_out(3) => blk_c_in(3), -- C12
            c_4      => carries(16), -- Final C16 (Cout)
            p_g      => open,
            g_g      => open
        );

    carries(4)  <= blk_c_in(1);
    carries(8)  <= blk_c_in(2);
    carries(12) <= blk_c_in(3);

    -- First-Level CLAs: 4-Bit Block Internal Carries
    GEN_4BIT_CLA: for j in 0 to 3 generate
        CLA_BLK: cla_generator_4bit
            port map (
                c_in     => blk_c_in(j),
                p_in     => stage2_xor((j*4 + 3) downto (j*4)),
                g_in     => stage1_and((j*4 + 3) downto (j*4)),
                c_out(1) => carries(j*4 + 1),
                c_out(2) => carries(j*4 + 2),
                c_out(3) => carries(j*4 + 3),
                c_4      => open,
                p_g      => blk_pg(j),
                g_g      => blk_gg(j)
            );
    end generate GEN_4BIT_CLA;

    -- ------------------------------------------------------------------------
    -- 3. Dynamic T-MUX & Output Router
    -- ------------------------------------------------------------------------
    process(s_trit, stage2_xor, stage1_and, stage3_sum, carries)
    begin
        case s_trit is
            when to_signed(-1, 2) => -- -1 : Bitwise XOR
                mux_out  <= stage2_xor;
                cout_reg <= '0';
                
            when to_signed(0, 2)  => --  0 : Bitwise AND
                mux_out  <= stage1_and;
                cout_reg <= '0';
                
            when to_signed(1, 2)  => -- +1 : High-Speed CLA 16-bit Addition
                mux_out  <= stage3_sum;
                cout_reg <= carries(16);
                
            when others =>
                mux_out  <= (others => '0');
                cout_reg <= '0';
        end case;
    end process;

    -- Output Assignments
    alu_out   <= mux_out;
    c_out     <= cout_reg;
    zero_flag <= '1' when mux_out = X"0000" else '0';

end architecture Structural;