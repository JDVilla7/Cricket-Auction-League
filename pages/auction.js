import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState({ owner: null, player: null, highBid: 0, highBidder: null, isSold: false });
  const [bidValue, setBidValue] = useState('');

  const syncStadium = async () => {
    if (!id) return;
    
    // 1. Fetch Owner & Active Player simultaneously
    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();

    if (active?.player_id) {
      const { data: player } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: highBid } = await supabase.from('bids_draft').select('*').eq('player_id', active.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();
      const { data: soldCheck } = await supabase.from('auction_results').select('*').eq('player_id', active.player_id).maybeSingle();

      setData({
        owner: owner,
        player: player,
        highBid: highBid ? highBid.bid_amount : (player.base_price / 10000000),
        highBidder: highBid ? highBid.owner_id : null,
        isSold: !!soldCheck,
        winnerName: soldCheck ? "SOLD" : null
      });
    }
  };

  useEffect(() => {
    if (router.isReady) {
      syncStadium();
      const stadiumChannel = supabase.channel('stadium_live')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
           console.log("Change Detected - Syncing...");
           syncStadium();
        })
        .subscribe();
      return () => supabase.removeChannel(stadiumChannel);
    }
  }, [router.isReady, id]);

  const handleBid = async () => {
    if (data.isSold || String(data.highBidder) === String(id)) return;
    const nextBid = data.highBidder ? data.highBid + 0.25 : data.highBid;
    
    if (nextBid > data.owner.budget) return alert("Insufficient Budget!");

    await supabase.from('bids_draft').upsert({
      owner_id: id,
      player_id: data.player.id,
      bid_amount: nextBid
    }, { onConflict: 'owner_id,player_id' });
  };

  if (!data.owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>CONNECTING...</div>;

  const isLeading = String(data.highBidder) === String(id);

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      
      {/* TOP BAR */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', background: '#0a0a0a' }}>
        <div style={{textAlign:'left'}}><h2 style={{margin:0, color:'#e11d48', fontSize:'1.1rem'}}>{data.owner.team_name}</h2><small style={{color:'#444'}}>ID: {id}</small></div>
        <div style={{textAlign:'right'}}><h2 style={{margin:0, color:'#22c55e', fontSize:'1.4rem'}}>{data.owner.budget.toFixed(2)} Cr</h2><small style={{color:'#444', fontSize:'0.7rem'}}>BUDGET</small></div>
      </div>

      {/* CENTER STAGE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        {data.isSold ? (
          <div style={{ textAlign: 'center', animation: 'blink 0.8s infinite' }}>
            <h1 style={{ fontSize: '6rem', color: '#e11d48', margin: 0, fontWeight: '900' }}>SOLD!</h1>
            <p style={{ fontSize: '1.5rem' }}>{isLeading ? "HE IS YOURS!" : "Next player coming soon..."}</p>
          </div>
        ) : data.player ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)', margin: 0, fontWeight: '900', textTransform: 'uppercase', lineHeight: '1.1' }}>{data.player.name}</h1>
            <p style={{ color: '#fbbf24', fontSize: '1.2rem', marginTop: '10px' }}>BASE: {(data.player.base_price / 10000000).toFixed(2)} Cr</p>

            <div style={{ background: '#111', margin: '30px auto', padding: '30px', borderRadius: '30px', border: '2px solid #fbbf24', maxWidth: '350px', boxShadow: '0 0 30px rgba(251, 191, 36, 0.1)' }}>
               <p style={{margin:0, fontSize:'0.8rem', color:'#666', fontWeight:'bold'}}>CURRENT PRICE</p>
               <h2 style={{margin:0, fontSize: '5rem', color: '#fbbf24', lineHeight: '1'}}>{data.highBid.toFixed(2)}</h2>
               <p style={{margin:0, color:'#fbbf24'}}>Crore</p>
            </div>

            <button 
              disabled={isLeading || data.isSold}
              onClick={handleBid}
              style={{ width: '100%', maxWidth: '380px', padding: '25px', borderRadius: '20px', border: 'none', background: isLeading ? '#1a1a1a' : '#e11d48', color: '#fff', fontSize: '1.8rem', fontWeight: '900', cursor: isLeading ? 'default' : 'pointer' }}
            >
              {isLeading ? "YOU ARE LEADING" : `BID ${(data.highBidder ? data.highBid + 0.25 : data.highBid).toFixed(2)} Cr`}
            </button>
          </div>
        ) : <h2 style={{color:'#333'}}>WAITING FOR AUCTIONEER...</h2>}
      </div>

      <style jsx global>{`
        @keyframes blink { 50% { opacity: 0.3; } }
        body { margin: 0; padding: 0; background: #050505; }
      `}</style>
    </div>
  );
}
