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
  const [isSold, setIsSold] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    const { data: oData } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(oData);

    const { data: auction } = await supabase.from('active_auction').select('*').eq('id', 2).maybeSingle();
    
    if (auction?.player_id) {
      // Check if this player is already in the results table (meaning they were JUST sold)
      const { data: result } = await supabase.from('auction_results').select('owner_id').eq('player_id', auction.player_id).maybeSingle();
      
      if (result) {
        setIsSold(true);
        setHighBidderId(result.owner_id);
      } else {
        setIsSold(false);
        const { data: p } = await supabase.from('players').select('*').eq('id', auction.player_id).single();
        setActivePlayer(p);

        const { data: high } = await supabase.from('bids_draft')
          .select('bid_amount, owner_id').eq('player_id', auction.player_id)
          .order('bid_amount', { ascending: false }).limit(1).maybeSingle();
        
        setCurrentHighBid(high ? high.bid_amount : 0);
        setHighBidderId(high ? high.owner_id : null);
      }
    } else {
      setActivePlayer(null);
      setIsSold(false);
    }
  };

  useEffect(() => {
    if (router.isReady) fetchData();
    const channel = supabase.channel('stadium').on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auction_results' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [router.isReady, id]);

  const placeBid = async () => {
    if (isSold) return;
    const baseCr = activePlayer.base_price / 10000000;
    const nextBid = currentHighBid === 0 ? baseCr : currentHighBid + 0.25;
    if (nextBid > owner.budget) return alert("Out of Budget!");

    await supabase.from('bids_draft').upsert({ owner_id: owner.id, player_id: activePlayer.id, bid_amount: nextBid }, { onConflict: 'owner_id,player_id' });
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Loading Stadium...</div>;

  const isHighBidder = String(highBidderId) === String(id);
  const nextBidDisplay = currentHighBid === 0 ? (activePlayer?.base_price / 10000000) : currentHighBid + 0.25;

  return (
    <div style={{ backgroundColor: '#0a0a0a', color: 'white', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* HEADER SECTION */}
      <header style={{ padding: '20px', borderBottom: '2px solid #e11d48', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ color: '#e11d48', margin: 0, fontSize: '1.2rem' }}>{owner.team_name}</h2>
          <span style={{ fontSize: '0.7rem', color: '#444' }}>ID: {id}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ color: '#22c55e', margin: 0, fontSize: '1.5rem' }}>{owner.budget.toFixed(2)} Cr</h2>
          <small style={{ color: '#666', fontSize: '0.6rem' }}>BUDGET REMAINING</small>
        </div>
      </header>

      {/* MAIN AUCTION AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        
        {isSold ? (
          <div style={{ animation: 'pulse 1s infinite', textAlign: 'center' }}>
             <h1 style={{ fontSize: '5rem', color: '#e11d48', fontWeight: '900' }}>SOLD!</h1>
             <h2 style={{ color: '#fff' }}>{isHighBidder ? "CONGRATULATIONS! YOU WON." : "Player has been signed."}</h2>
          </div>
        ) : activePlayer ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900', margin: '0', lineHeight: '1' }}>{activePlayer.name}</h1>
            <h3 style={{ color: '#fbbf24', fontSize: '1.2rem', margin: '10px 0' }}>BASE: {(activePlayer.base_price / 10000000).toFixed(2)} Cr</h3>

            <div style={{ background: '#111', padding: '30px', borderRadius: '25px', border: '3px solid #fbbf24', margin: '30px 0', width: '90%', maxWidth: '350px', display: 'inline-block' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', fontWeight: 'bold' }}>CURRENT BID</p>
              <h2 style={{ fontSize: '4.5rem', margin: 0, color: '#fbbf24', lineHeight: '1' }}>{currentHighBid.toFixed(2)}</h2>
              <p style={{ margin: 0, color: '#fbbf24', fontSize: '1.2rem' }}>Cr</p>
            </div>

            <button 
              disabled={isHighBidder}
              onClick={placeBid} 
              style={{ width: '100%', maxWidth: '350px', padding: '20px', background: isHighBidder ? '#222' : '#e11d48', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '1.8rem', fontWeight: '900', boxShadow: isHighBidder ? 'none' : '0 10px 30px rgba(225, 29, 72, 0.3)' }}
            >
              {isHighBidder ? "YOU LEAD" : `BID ${nextBidDisplay.toFixed(2)} Cr`}
            </button>
          </div>
        ) : (
          <h2 style={{ color: '#333' }}>Waiting for the next player...</h2>
        )}
      </main>

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
