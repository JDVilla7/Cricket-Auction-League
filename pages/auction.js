import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get Logged-in Owner Data
      const { data: ownerData } = await supabase.from('league_owners').select('*').single();
      setOwner(ownerData);

      // 2. Get Current Auction Player (Using your new link!)
      // This pulls the name and role from the 'players' table automatically
      const { data: auctionData } = await supabase
        .from('active_auction')
        .select(`
          player_id,
          players (
            name,
            role,
            base_price
          )
        `)
        .single();

      if (auctionData) setActivePlayer(auctionData.players);
    };
    
    fetchData();
    
    // 3. Listen for changes (So you can change players live!)
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_auction' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>Entering Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px', marginBottom: '30px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner.budget} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ textAlign: 'center', backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '15px', border: '1px solid #333' }}>
          <p style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px' }}>Current Player on Auction</p>
          <h1 style={{ fontSize: '4rem', margin: '20px 0', textShadow: '0 0 10px rgba(225, 29, 72, 0.5)' }}>{activePlayer.name}</h1>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '1.2rem' }}>
            <span style={{ backgroundColor: '#333', padding: '5px 15px', borderRadius: '20px' }}>{activePlayer.role}</span>
            <span style={{ backgroundColor: '#e11d48', padding: '5px 15px', borderRadius: '20px' }}>Base: {activePlayer.base_price} Cr</span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h3>Waiting for the Auctioneer to present the next player...</h3>
        </div>
      )}
    </div>
  );
}
