import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query; // Gets the ID from the URL (.../auction?id=1)

  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');
  const [myCurrentBid, setMyCurrentBid] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;

    // 1. Fetch THIS specific owner based on URL ID
    const { data: ownerData, error: oErr } = await supabase
      .from('league_owners')
      .select('*')
      .eq('id', id)
      .single();

    if (oErr) { console.error("Owner Error:", oErr.message); return; }
    setOwner(ownerData);

    // 2. Fetch Active Auction
    const { data: auctionRow } = await supabase.from('active_auction').select('*').eq('id', 2).maybeSingle();
    
    if (auctionRow?.player_id) {
      const { data: pData } = await supabase.from('players').select('*').eq('id', auctionRow.player_id).single();
      setActivePlayer(pData);
      
      // 3. Fetch current bid for this specific owner/player combo
      const { data: bidData } = await supabase
        .from('bids_draft')
        .select('bid_amount')
        .eq('owner_id', id)
        .eq('player_id', auctionRow.player_id)
        .maybeSingle();
      setMyCurrentBid(bidData ? bidData.bid_amount : null);
    } else {
      setActivePlayer(null);
      setMyCurrentBid(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (router.isReady) fetchData();

    const channel = supabase.channel('stadium')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_owners' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [router.isReady, id]);

  const placeBid = async () => {
    const val = parseFloat(bidValue);
    if (!val || val <= 0) return alert("Enter valid Cr!");
    if (val > owner.budget) return alert("Not enough budget!");

    const { error } = await supabase.from('bids_draft').upsert({
      owner_id: owner.id,
      player_id: activePlayer.id,
      bid_amount: val
    }, { onConflict: 'owner_id,player_id' });

    if (!error) { setBidValue(''); } else { alert(error.message); }
  };

  if (loading) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Entering Stadium... (Make sure your URL has ?id=X)</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <div>
          <h1 style={{ color: '#e11d48', margin: 0 }}>{owner?.team_name}</h1>
          <small style={{color: '#666'}}>Owner ID: {id}</small>
        </div>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner?.budget.toFixed(2)} Cr</h2>
      </header>

      {activePlayer ? (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <h3 style={{ color: '#9ca3af', marginBottom: '0' }}>NOW BIDDING</h3>
          <h1 style={{ fontSize: '4rem', margin: '5px 0' }}>{activePlayer.name}</h1>
          <p style={{ color: '#fbbf24', fontSize: '1.2rem' }}>Base: {(activePlayer.base_price / 10000000).toFixed(2)} Cr</p>
          
          <div style={{ background: '#222', padding: '20px', borderRadius: '15px', display: 'inline-block', margin: '20px 0', border: '1px solid #333' }}>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>YOUR SECRET BID</p>
            <h2 style={{ margin: 0, color: '#22c55e', fontSize: '2.5rem' }}>{myCurrentBid ? myCurrentBid.toFixed(2) + " Cr" : "No Bid Yet"}</h2>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <input 
              type="number" step="0.1" 
              value={bidValue} 
              onChange={(e) => setBidValue(e.target.value)} 
              style={{ padding: '15px', width: '130px', borderRadius: '8px', border: 'none', fontSize: '1.1rem' }} 
              placeholder="0.00" 
            />
            <button onClick={placeBid} style={{ padding: '15px 30px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              SUBMIT BID
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
          <h3>Waiting for Admin to push player...</h3>
        </div>
      )}
    </div>
  );
}
