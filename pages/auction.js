import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');
  const [myCurrentBid, setMyCurrentBid] = useState(null);

  const fetchData = async () => {
    const { data: ownerData } = await supabase.from('league_owners').select('*').single();
    setOwner(ownerData);

    const { data: auctionRow } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (auctionRow?.player_id) {
      const { data: pData } = await supabase.from('players').select('*').eq('id', auctionRow.player_id).single();
      setActivePlayer(pData);
      
      // Fetch user's current bid for this player
      const { data: bidData } = await supabase.from('bids_draft').select('bid_amount').eq('owner_id', ownerData.id).eq('player_id', auctionRow.player_id).maybeSingle();
      setMyCurrentBid(bidData ? bidData.bid_amount : null);
    } else {
      setActivePlayer(null);
      setMyCurrentBid(null);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('auction-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_owners' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const placeBid = async () => {
    const val = parseFloat(bidValue);
    if (!val || val <= 0) return alert("Enter valid Cr!");
    
    // Upsert so if you change your bid, it updates the existing row
    const { error } = await supabase.from('bids_draft').upsert({
      owner_id: owner.id,
      player_id: activePlayer.id,
      bid_amount: val
    }, { onConflict: 'owner_id,player_id' });

    if (!error) { setBidValue(''); }
  };

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Entering...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner.budget.toFixed(2)} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h1 style={{ fontSize: '3.5rem', margin: '0' }}>{activePlayer.name}</h1>
          <p style={{ color: '#fbbf24' }}>Base: {(activePlayer.base_price / 10000000).toFixed(2)} Cr</p>
          
          <div style={{ background: '#222', padding: '15px', borderRadius: '10px', display: 'inline-block', margin: '20px 0' }}>
            <p style={{ margin: 0, color: '#9ca3af' }}>Your Active Bid</p>
            <h2 style={{ margin: 0, color: '#22c55e' }}>{myCurrentBid ? myCurrentBid + " Cr" : "No Bid"}</h2>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <input type="number" step="0.1" value={bidValue} onChange={(e) => setBidValue(e.target.value)} style={{ padding: '15px', width: '120px', color: '#000' }} placeholder="Cr" />
            <button onClick={placeBid} style={{ padding: '15px 25px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>BID NOW</button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}><h3>Waiting for Admin to push a player...</h3></div>
      )}
    </div>
  );
}
