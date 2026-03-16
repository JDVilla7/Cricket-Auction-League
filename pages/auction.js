import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [st, setSt] = useState({ owner: null, player: null, highBid: 0, bidderId: null, isSold: false, winName: '', winAmt: 0 });

  const sync = async () => {
    if (!id) return;
    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: act } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    if (act?.player_id) {
      const { data: player } = await supabase.from('players').select('*').eq('id', act.player_id).single();
      const { data: bid } = await supabase.from('bids_draft').select('*').eq('player_id', act.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();

      setSt({
        owner,
        player,
        highBid: bid ? bid.bid_amount : (player.base_price / 10000000),
        bidderId: bid ? bid.owner_id : null,
        isSold: act.is_sold,
        winName: act.winner_name,
        winAmt: act.winning_amount
      });
    }
  };

  useEffect(() => {
    if (router.isReady) {
      sync();
      const sub = supabase.channel('stadium').on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
      return () => supabase.removeChannel(sub);
    }
  }, [router.isReady, id]);

  const placeBid = async () => {
    if (st.isSold || String(st.bidderId) === String(id)) return;
    const next = st.bidderId ? st.highBid + 0.25 : st.highBid;
    await supabase.from('bids_draft').upsert({ owner_id: id, player_id: st.player.id, bid_amount: next }, { onConflict: 'owner_id,player_id' });
  };

  if (!st.owner) return <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'grid', placeItems: 'center' }}>STADIUM CONNECTING...</div>;

  const leading = String(st.bidderId) === String(id);

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', margin: 0, overflowX: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', background: '#0a0a0a', borderBottom: '1px solid #222', width: '100%' }}>
        <h2 style={{ margin: 0, color: '#e11d48', fontSize: '1rem' }}>{st.owner.team_name}</h2>
        <h2 style={{ margin: 0, color: '#22c55e', fontSize: '1.2rem' }}>{st.owner.budget.toFixed(2)} Cr</h2>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        
        {st.isSold ? (
          <div style={{ textAlign: 'center', animation: 'blink 0.6s infinite', width: '100%' }}>
            <h1 style={{ fontSize: '5rem', color: '#e11d48', fontWeight: '900', margin: 0 }}>SOLD!</h1>
            <div style={{ background: '#111', padding: '30px', borderRadius: '20px', border: '1px solid #333', marginTop: '20px', width: '100%', maxWidth: '350px', display: 'inline-block' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{st.player?.name}</h2>
                <p style={{ color: '#fbbf24', fontSize: '1.4rem', margin: '10px 0', fontWeight: 'bold' }}>TO {st.winName}</p>
                <p style={{ color: '#22c55e', fontSize: '1.8rem', margin: 0, fontWeight: '900' }}>FOR {st.winAmt.toFixed(2)} Cr</p>
            </div>
          </div>
        ) : st.player ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900', margin: 0, textTransform: 'uppercase', lineHeight: '1' }}>{st.player.name}</h1>
            <p style={{ color: '#fbbf24', fontSize: '1.1rem', margin: '10px 0' }}>BASE: {(st.player.base_price / 10000000).toFixed(2)} Cr</p>

            <div style={{ background: '#111', margin: '30px auto', padding: '25px', borderRadius: '30px', border: '3px solid #fbbf24', width: '90%', maxWidth: '320px' }}>
               <p style={{ margin: 0, color: '#666', fontSize: '0.8rem', fontWeight: 'bold' }}>CURRENT PRICE</p>
               <h2 style={{ margin: 0, fontSize: '4.5rem', color: '#fbbf24', lineHeight: '1' }}>{st.highBid.toFixed(2)}</h2>
               <p style={{ margin: 0, color: '#fbbf24', fontSize: '1rem' }}>Crore</p>
            </div>

            <button 
              disabled={leading || st.isSold}
              onClick={placeBid}
              style={{ width: '100%', maxWidth: '350px', padding: '20px', borderRadius: '15px', border: 'none', background: leading ? '#1a1a1a' : '#e11d48', color: '#fff', fontSize: '1.8rem', fontWeight: '900' }}
            >
              {leading ? "YOU LEAD" : `BID ${(st.bidderId ? st.highBid + 0.25 : st.highBid).toFixed(2)} Cr`}
            </button>
          </div>
        ) : <h2 style={{color:'#333'}}>WAITING FOR AUCTIONEER...</h2>}
      </div>

      <style jsx global>{`
        @keyframes blink { 50% { opacity: 0.5; } }
        body { margin: 0; padding: 0; background: #050505; }
      `}</style>
    </div>
  );
}
