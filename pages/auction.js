import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');

  const fetchData = async () => {
    // 1. Fetch Logged-in Owner
    const { data: ownerData } = await supabase.from('league_owners').select('*').single();
    setOwner(ownerData);

    // 2. Fetch Active Auction Row (ID 2)
    const { data: auctionRow } = await supabase.from('active_auction').select('*').eq('id', 2).single();

    if (auctionRow && auctionRow.player_id) {
      // 3. Fetch Player details
      const { data: playerData } = await supabase.from('players').select('*').eq('id', auctionRow.player_id).single();
      setActivePlayer(playerData);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('live-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_auction' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const placeBid = async () => {
    if (!bidValue || bidValue <= 0) return alert("Enter a valid amount!");

    const { error } = await supabase.from('bids_draft').insert([
      { 
        owner_id: owner.id, 
        player_id: activePlayer.id, 
        bid_amount: bidValue 
      }
    ]);

    if (!error) {
      alert("Bid Placed! Wait for the Auctioneer's decision.");
      setBidValue('');
    } else {
      alert("Bid Error: " + error.message);
    }
  };

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

          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <input 
              type="number" placeholder="Enter Bid (in Cr)" 
              value={bidValue} onChange={(e) => setBidValue(e.target.value)}
              style={{ padding: '15px', borderRadius: '5px', width: '180px', fontSize: '1.1rem', color: '#000' }}
            />
            <button onClick={placeBid} style={{ padding: '15px 30px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              PLACE BID
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h3>Waiting for the Auctioneer...</h3>
        </div>
      )}
    </div>
  );
}
