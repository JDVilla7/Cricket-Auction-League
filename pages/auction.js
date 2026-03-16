import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [currentHighBid, setCurrentHighBid] = useState(0);

  const fetchData = async () => {
    if (!id) return;
    const { data: oData } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(oData);

    const { data: auction } = await supabase.from('active_auction').select('*').eq('id', 2).maybeSingle();
    if (auction?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', auction.player_id).single();
      setActivePlayer(p);

      const { data: high } = await supabase.from('bids_draft').select('bid_amount').eq('player_id', auction.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();
      
      // If no bid yet, start at Base Price
      const baseCr = p.base_price / 10000000;
      setCurrentHighBid(high ? high.bid_amount : baseCr);
    } else {
      setActivePlayer(null);
    }
  };

  useEffect(() => {
    if (router.isReady) fetchData();
    const channel = supabase.channel('live').on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchData).on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData).subscribe();
    return () => supabase.removeChannel(channel);
  }, [router.isReady, id]);

  const placeIncrementBid = async () => {
    // IPL Increment Logic: +0.25 Cr
    const nextBid = currentHighBid + 0.25;
    
    if (nextBid > owner.budget) return alert("Not enough budget!");

    await supabase.from('bids_draft').upsert({
      owner_id: owner.id,
      player_id: activePlayer.id,
      bid_amount: nextBid
    }, { onConflict: 'owner_id,player_id' });
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh'}}>Connecting...</div>;

  return (
    <div style={{ backgroundColor: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h2>{owner.team_name}</h2>
        <h2 style={{color:'#22c55e'}}>{owner.budget.toFixed(2)} Cr Left</h2>
      </header>

      {activePlayer ? (
        <div style={{ marginTop: '40px' }}>
          <h1 style={{ fontSize: '3.5rem', margin: 0 }}>{activePlayer.name}</h1>
          <p style={{ color: '#666' }}>{activePlayer.type} | Base: {(activePlayer.base_price / 10000000).toFixed(2)} Cr</p>
          
          <div style={{ background: '#111', padding: '25px', borderRadius: '15px', border: '2px solid #fbbf24', margin: '30px 0' }}>
            <p style={{ margin: 0, color: '#666' }}>CURRENT BID</p>
            <h2 style={{ fontSize: '4rem', margin: 0, color: '#fbbf24' }}>{currentHighBid.toFixed(2)} Cr</h2>
          </div>

          <button 
            onClick={placeIncrementBid} 
            style={{ width: '100%', padding: '20px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1.5rem', fontWeight: 'bold' }}
          >
            BID {(currentHighBid + 0.25).toFixed(2)} Cr
          </button>
        </div>
      ) : (
        <h3 style={{marginTop:'100px', color:'#444'}}>Next player coming soon...</h3>
      )}
    </div>
  );
}
