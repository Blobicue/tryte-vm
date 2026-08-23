library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity cla_generator_4bit is
    port (
        c_in  : in  std_logic;                    -- Block Carry In (C0)
        p_in  : in  std_logic_vector(3 downto 0); -- Bitwise Propagate (P3, P2, P1, P0)
        g_in  : in  std_logic_vector(3 downto 0); -- Bitwise Generate  (G3, G2, G1, G0)
        c_out : out std_logic_vector(3 downto 1); -- Internal Lookahead Carries (C3, C2, C1)
        c_4   : out std_logic;                    -- Block Carry Out (C4)
        p_g   : out std_logic;                    -- Block Propagate Group
        g_g   : out std_logic                     -- Block Generate Group
    );
end entity cla_generator_4bit;

architecture Behavioral of cla_generator_4bit is
begin

    -- Fast 2-gate lookahead equations
    c_out(1) <= g_in(0) or (p_in(0) and c_in);
    
    c_out(2) <= g_in(1) or 
                (p_in(1) and g_in(0)) or 
                (p_in(1) and p_in(0) and c_in);
                
    c_out(3) <= g_in(2) or 
                (p_in(2) and g_in(1)) or 
                (p_in(2) and p_in(1) and g_in(0)) or 
                (p_in(2) and p_in(1) and p_in(0) and c_in);
                
    c_4      <= g_in(3) or 
                (p_in(3) and g_in(2)) or 
                (p_in(3) and p_in(2) and g_in(1)) or 
                (p_in(3) and p_in(2) and p_in(1) and g_in(0)) or 
                (p_in(3) and p_in(2) and p_in(1) and p_in(0) and c_in);

    -- Hierarchical block flags
    p_g      <= p_in(3) and p_in(2) and p_in(1) and p_in(0);
    g_g      <= g_in(3) or 
                (p_in(3) and g_in(2)) or 
                (p_in(3) and p_in(2) and g_in(1)) or 
                (p_in(3) and p_in(2) and p_in(1) and g_in(0));

end architecture Behavioral;