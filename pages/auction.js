import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Get Owner Data
      const { data: ownerData } = await supabase.from('league_owners').select('*').single();
      setOwner(ownerData);

      // Get Current Auction Player
      const { data: auctionData } = await supabase.from('active_auction').select('*, players(*)').single();
      if (auctionData) setActivePlayer(auctionData.players);
    };
    fetchData();
  }, []);

  const submitBid = async () => {
    if (!bidValue || bidValue <= 0) return alert("Enter a valid bid!");
    
    const { error } = await supabase.from('bids_draft').insert([
      { owner_id: owner.id, player_id: activePlayer.id, bid_amount: bidValue }
    ]);

    if (!error) {
      alert("Bid Placed Successfully!");
      setBidValue('');
    } else {
      alert("Error placing bid: " + error.message);
    }
  };

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Entering Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h1 style={{ color: '#e11d48' }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e' }}>{owner.budget} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ marginTop: '40px', textAlign: 'center', backgroundColor: '#222', padding: '30px', borderRadius: '15px' }}>
          <h3 style={{ color: '#9ca3af' }}>CURRENT PLAYER</h3>
          <h1 style={{ fontSize: '3rem', margin: '10px 0' }}>{activePlayer.name}</h1>
          <p style={{ fontSize: '1.2rem' }}>Type: {activePlayer.role} | Base Price: {activePlayer.base_price} Cr</p>
          
          <div style={{ marginTop: '30px' }}>
            <input 
              type="number" placeholder="Enter Your Secret Bid" 
              value={bidValue} onChange={(e) => setBidValue(e.target.value)}
              style={{ padding: '15px', borderRadius: '5px', width: '200px', fontSize: '1.1rem' }}
            />
            <button 
              onClick={submitBid}
              style={{ padding: '15px 30px', marginLeft: '10px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              PLACE BID
            </button>
          </div>
        </div>
      ) : (
        <p style={{ textAlign: 'center', marginTop: '50px' }}>Waiting for next player...</p>
      )}
    </div>
  );
}
