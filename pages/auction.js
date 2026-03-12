import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');

  const fetchOwner = async () => {
    const { data } = await supabase.from('league_owners').select('*').single();
    setOwner(data);
  };

  const fetchActivePlayer = async () => {
    const { data: auctionRow } = await supabase.from('active_auction').select('player_id').eq('id', 2).single();
    if (auctionRow?.player_id) {
      const { data: playerData } = await supabase.from('players').select('*').eq('id', auctionRow.player_id).single();
      setActivePlayer(playerData);
    } else {
      setActivePlayer(null);
    }
  };

  useEffect(() => {
    fetchOwner();
    fetchActivePlayer();

    // LISTENERS
    const channel = supabase.channel('auction-room')
      // If the admin pushes a new Player ID to active_auction row 2
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_auction' }, fetchActivePlayer)
      // If the admin updates the budget in league_owners
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_owners' }, fetchOwner)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const placeBid = async () => {
    const amount = parseFloat(bidValue);
    if (!amount || amount <= 0) return alert("Enter a valid Cr value!");

    const { error } = await supabase.from('bids_draft').insert([
      { owner_id: owner.id, player_id: activePlayer.id, bid_amount: amount }
    ]);

    if (!error) {
      alert("Bid Placed!");
      setBidValue('');
    } else {
      alert("Error: " + error.message);
    }
  };

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Loading Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner.budget.toFixed(2)} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h3 style={{ color: '#9ca3af' }}>CURRENT PLAYER</h3>
          <h1 style={{ fontSize: '4.5rem', margin: '10px 0' }}>{activePlayer.name}</h1>
          <p style={{ fontSize: '1.5rem', color: '#fbbf24' }}>
            {activePlayer.type} | Base: {(activePlayer.base_price / 10000000).toFixed(2)} Cr
          </p>

          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <input 
              type="number" step="0.01"
              placeholder="Enter Bid (Cr)" 
              value={bidValue} onChange={(e) => setBidValue(e.target.value)}
              style={{ padding: '15px', borderRadius: '5px', width: '150px', color: '#000', fontSize: '1.1rem' }}
            />
            <button onClick={placeBid} style={{ padding: '15px 30px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              PLACE BID
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h3>Waiting for the Auctioneer to Push a Player...</h3>
        </div>
      )}
    </div>
  );
}
