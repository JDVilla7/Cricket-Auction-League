import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidAmount, setBidAmount] = useState('');

  const fetchData = async () => {
    const { data: ownerData } = await supabase.from('league_owners').select('*').single();
    setOwner(ownerData);

    const { data: auctionData } = await supabase
      .from('active_auction')
      .select('player_id, players(id, name, type, base_price)')
      .single();

    if (auctionData) setActivePlayer(auctionData.players);
    else setActivePlayer(null);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('auction-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleBid = async () => {
    if (!bidAmount || bidAmount < activePlayer.base_price / 10000000) {
       return alert(`Min bid is base price: ${activePlayer.base_price / 10000000} Cr`);
    }
    const { error } = await supabase.from('bids_draft').insert([
      { owner_id: owner.id, player_id: activePlayer.id, bid_amount: bidAmount }
    ]);
    if (!error) { alert("Bid Placed!"); setBidAmount(''); }
  };

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>Entering Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner.budget} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ textAlign: 'center', marginTop: '40px', backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '15px', border: '1px solid #333' }}>
          <h2 style={{ color: '#9ca3af' }}>CURRENT PLAYER</h2>
          <h1 style={{ fontSize: '4rem', margin: '10px 0' }}>{activePlayer.name}</h1>
          <p style={{ fontSize: '1.5rem' }}>{activePlayer.type} | Base: {activePlayer.base_price / 10000000} Cr</p>
          
          <div style={{ marginTop: '30px' }}>
            <input 
              type="number" placeholder="Enter Bid (in Cr)" 
              value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
              style={{ padding: '15px', borderRadius: '5px', width: '200px', fontSize: '1.2rem', color: '#000' }}
            />
            <button onClick={handleBid} style={{ padding: '15px 30px', marginLeft: '10px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              PLACE SECRET BID
            </button>
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
