import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');

  const fetchData = async () => {
    // 1. Fetch Owner Data
    const { data: ownerData } = await supabase.from('league_owners').select('*').single();
    setOwner(ownerData);

    // 2. Fetch Active Auction Row
    const { data: auctionRow } = await supabase.from('active_auction').select('*').eq('id', 2).single();

    if (auctionRow && auctionRow.player_id) {
      const { data: playerData } = await supabase.from('players').select('*').eq('id', auctionRow.player_id).single();
      setActivePlayer(playerData);
    } else {
      setActivePlayer(null); // This clears the UI if no player is active
    }
  };

  useEffect(() => {
    fetchData();

    // LISTEN TO EVERYTHING: Changes in Auction, Owners (Budget), and Bids
    const channel = supabase.channel('auction-all-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_owners' }, fetchData)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bids_draft' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const placeBid = async () => {
    const amount = parseFloat(bidValue);
    if (!amount || amount <= 0) return alert("Enter a valid amount!");

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

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Entering Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        {/* Budget now updates automatically */}
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
              type="number" step="0.1" // Allows 0.1, 0.2, etc.
              placeholder="Enter Bid (Cr)" 
              value={bidValue} onChange={(e) => setBidValue(e.target.value)}
              style={{ padding: '15px', borderRadius: '5px', width: '150px', color: '#000' }}
            />
            <button onClick={placeBid} style={{ padding: '15px 30px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
              PLACE BID
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h3>Waiting for the next player to be pushed...</h3>
        </div>
      )}
    </div>
  );
}
