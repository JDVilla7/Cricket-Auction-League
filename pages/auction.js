import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [currentHighBid, setCurrentHighBid] = useState(0);
  const [highBidderId, setHighBidderId] = useState(null);

  const fetchData = async () => {
    if (!id) return;
    const { data: oData } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(oData);

    const { data: auction } = await supabase.from('active_auction').select('*').eq('id', 2).maybeSingle();
    if (auction?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', auction.player_id).single();
      setActivePlayer(p);

      const { data: high } = await supabase.from('bids_draft')
        .select('bid_amount, owner_id')
        .eq('player_id', auction.player_id)
        .order('bid_amount', { ascending: false })
        .limit(1).maybeSingle();
      
      setCurrentHighBid(high ? high.bid_amount : 0);
      setHighBidderId(high ? high.owner_id : null);
    } else {
      setActivePlayer(null);
    }
  };

  useEffect(() => {
    if (router.isReady) fetchData();
    const channel = supabase.channel('live-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchData).on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData).subscribe();
    return () => supabase.removeChannel(channel);
  }, [router.isReady, id]);

  const placeBid = async () => {
    const baseCr = activePlayer.base_price / 10000000;
    // Logic: If no bids yet, first bid = base. Otherwise, current + 0.25.
    const nextBid = currentHighBid === 0 ? baseCr : currentHighBid + 0.25;
    
    if (nextBid > owner.budget) return alert("Insufficient Budget!");

    await supabase.from('bids_draft').upsert({
      owner_id: owner.id,
      player_id: activePlayer.id,
      bid_amount: nextBid
    }, { onConflict: 'owner_id,player_id' });
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Connecting to Stadium...</div>;

  const isHighBidder = String(highBidderId) === String(id);
  const nextBidDisplay = currentHighBid === 0 ? (activePlayer?.base_price / 10000000) : currentHighBid + 0.25;

  return (
    <div style={{ backgroundColor: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px', marginBottom: '30px' }}>
        <h2 style={{color:'#e11d48', margin: 0}}>{owner.team_name}</h2>
        <h2 style={{color:'#22c55e', margin: 0}}>{owner.budget.toFixed(2)} Cr</h2>
      </header>

      {activePlayer ? (
        <div>
          <h1 style={{ fontSize: '4.5rem', fontWeight: '900', margin: '0', textTransform: 'uppercase' }}>{activePlayer.name}</h1>
          <h2 style={{ color: '#fbbf24', fontSize: '2rem', marginTop: '10px' }}>
            {activePlayer.type} | BASE: {(activePlayer.base_price / 10000000).toFixed(2)} Cr
          </h2>
          
          <div style={{ background: '#111', padding: '30px', borderRadius: '20px', border: '3px solid #fbbf24', margin: '40px auto', maxWidth: '400px' }}>
            <p style={{ margin: 0, color: '#666', fontSize: '1.2rem', fontWeight: 'bold' }}>CURRENT PRICE</p>
            <h2 style={{ fontSize: '5rem', margin: 0, color: '#fbbf24' }}>{currentHighBid.toFixed(2)} Cr</h2>
            {isHighBidder && <div style={{background:'#22c55e', color:'#000', fontWeight:'bold', borderRadius:'5px', padding:'5px', marginTop:'10px'}}>YOU ARE LEADING</div>}
          </div>

          <button 
            disabled={isHighBidder}
            onClick={placeBid} 
            style={{ 
                width: '100%', maxWidth: '400px', padding: '25px', 
                background: isHighBidder ? '#333' : '#e11d48', 
                color: '#fff', border: 'none', borderRadius: '15px', 
                fontSize: '2rem', fontWeight: '900', cursor: isHighBidder ? 'default' : 'pointer',
                boxShadow: isHighBidder ? 'none' : '0 10px 20px rgba(225, 29, 72, 0.4)'
            }}
          >
            {isHighBidder ? "WAITING..." : `BID ${nextBidDisplay.toFixed(2)} Cr`}
          </button>
        </div>
      ) : (
        <h2 style={{marginTop:'150px', color:'#444', fontSize:'2rem'}}>GET READY... NEXT PLAYER COMING</h2>
      )}
    </div>
  );
}
