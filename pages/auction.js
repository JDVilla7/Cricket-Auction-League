import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);

  const fetchData = async () => {
    // 1. Fetch Owner (Chennai Super Kings)
    const { data: ownerData } = await supabase.from('league_owners').select('*').single();
    setOwner(ownerData);

    // 2. Fetch the Active Auction Row (ID 2)
    const { data: auctionRow, error: auctionError } = await supabase
      .from('active_auction')
      .select('*')
      .eq('id', 2)
      .single();

    if (auctionRow && auctionRow.player_id) {
      // 3. Fetch the Player details using the ID we just found
      const { data: playerData } = await supabase
        .from('players')
        .select('id, name, type, base_price')
        .eq('id', auctionRow.player_id)
        .single();
      
      setActivePlayer(playerData);
    }
  };

  useEffect(() => {
    fetchData();
    // Listen for the "Push" from your Admin page
    const channel = supabase.channel('auction-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_auction' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Entering Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner.budget} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h3 style={{ color: '#9ca3af' }}>CURRENT PLAYER</h3>
          <h1 style={{ fontSize: '4.5rem', margin: '10px 0' }}>{activePlayer.name}</h1>
          <p style={{ fontSize: '1.5rem', color: '#fbbf24' }}>
            {activePlayer.type} | Base: {activePlayer.base_price / 10000000} Cr
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h3>Waiting for the Auctioneer to present the next player...</h3>
        </div>
      )}
    </div>
  );
}
