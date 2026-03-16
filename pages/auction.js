import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [st, setSt] = useState({ 
    owner: null, player: null, highBid: 0, bidderId: null, 
    isSold: false, winName: '', winAmt: 0, squadCount: 0 
  });

  const sync = async () => {
    if (!id) return;

    // 1. Fetch Owner & Active Status
    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: act } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    // 2. Count how many players this team already bought
    const { count } = await supabase
      .from('auction_results')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', id);

    if (act?.player_id) {
      const { data: player } = await supabase.from('players').select('*').eq('id', act.player_id).single();
      const { data: bid } = await supabase.from('bids_draft')
        .select('*').eq('player_id', act.player_id)
        .order('bid_amount', { ascending: false }).limit(1).maybeSingle();

      setSt({
        owner,
        player,
        highBid: bid ? bid.bid_amount : (player.base_price / 10000000),
        bidderId: bid ? bid.owner_id : null,
        isSold: act.is_sold,
        winName: act.winner_name,
        winAmt: act.winning_amount,
        squadCount: count || 0
      });
    }
  };

  useEffect(() => {
    if (router.isReady) {
      sync();
      // Listen for ANY changes (bids, sales, new player pushes)
      const sub = supabase.channel('stadium').on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
      return () => supabase.removeChannel(sub);
    }
  }, [router.isReady, id]);

  const placeBid = async () => {
    if (st.isSold || String(st.bidderId) === String(id)) return;
    const next = st.bidderId ? st.highBid + 0.25 : st.highBid;
    if (next > st.owner.budget) return alert("Insufficient Budget!");
    
    await supabase.from('bids_draft').upsert({ 
      owner_id: id, 
      player_id: st.player.id, 
      bid_amount: next 
    }, { onConflict: 'owner_id,player_id' });
  };

  if (!st.owner) return <div style={{ background: '#000', color: '#fff', height: '100dvh', display: 'grid', placeItems: 'center' }}>STADIUM CONNECTING...</div>;

  const leading = String(st.bidderId) === String(id);
  const TOTAL_SLOTS = 15; // <--- CHANGE THIS IF YOUR LEAGUE HAS MORE/LESS SLOTS
  const slotsRemaining = TOTAL_SLOTS - st.squadCount;

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', margin: 0, overflow: 'hidden' }}>
      
      {/* HEADER WITH SLOTS */}
      <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', background: '#0a0a0a', borderBottom: '1px solid #222' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ margin: 0, color: '#e11d48', fontSize: '1rem' }}>{st.owner.team_name}</h2>
          <div style={{ color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>SLOTS: {st.squadCount} / {TOTAL_SLOTS}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, color: '#22c55e', fontSize: '1.2rem' }}>{st.owner.budget.toFixed(2)} Cr</h2>
          <div style={{ color: '#444', fontSize: '0.6rem' }}>SLOTS LEFT: {slotsRemaining}</div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        
        {st.isSold ? (
          <div style={{ textAlign: 'center', animation: 'blink 0.6s infinite' }}>
            <h1 style={{ fontSize: '5rem', color: '#e11d48', fontWeight: '900', margin: 0 }}>SOLD!</h1>
            <div style={{ background: '#111', padding: '30px', borderRadius: '20px', border: '1px solid #333', marginTop: '20px', width: '100%', maxWidth: '350px' }}>
                <h2 style={{ margin: 0 }}>{st.player?.name}</h2>
                <p style={{ color: '#fbbf24', fontSize: '1.2rem', margin: '10px 0' }}>TO {st.winName}</p>
                <p style={{ color: '#22c55e', fontSize: '1.6rem', fontWeight: '900' }}>FOR {st.winAmt.toFixed(2)} Cr</p>
            </div>
          </div>
        ) : st.player ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(3rem, 12vw, 5rem)', margin: 0, fontWeight: '900', textTransform: 'uppercase' }}>{st.player.name}</h1>
            <p style={{ color: '#fbbf24', fontSize: '1.1rem', margin: '10px 0' }}>BASE: {(st.player.base_price / 10000000).toFixed(2)} Cr</p>

            <div style={{ background: '#111', margin: '30px auto', padding: '25px', borderRadius: '30px', border: '3px solid #fbbf24', maxWidth: '320px' }}>
               <p style={{ margin: 0, color: '#666', fontSize: '0.8rem', fontWeight: 'bold' }}>CURRENT PRICE</p>
               <h2 style={{ margin: 0, fontSize: '4.5rem', color: '#fbbf24', lineHeight: '1' }}>{st.highBid.toFixed(2)}</h2>
               <p style={{ margin: 0, color: '#fbbf24' }}>Crore</p>
            </div>

            <button 
              disabled={leading || st.isSold || slotsRemaining === 0}
              onClick={placeBid}
              style={{ width: '100%', maxWidth: '350px', padding: '20px', borderRadius: '15px', border: 'none', background: leading ? '#1a1a1a' : (slotsRemaining === 0 ? '#333' : '#e11d48'), color: '#fff', fontSize: '1.8rem', fontWeight: '900' }}
            >
              {slotsRemaining === 0 ? "SQUAD FULL" : leading ? "YOU LEAD" : `BID ${(st.bidderId ? st.highBid + 0.25 : st.highBid).toFixed(2)} Cr`}
            </button>
          </div>
        ) : <h2 style={{color:'#333'}}>WAITING FOR NEXT PLAYER...</h2>}
      </div>

      <style jsx global>{`
        @keyframes blink { 50% { opacity: 0.5; } }
        body { margin: 0; padding: 0; background: #050505; }
      `}</style>
    </div>
  );
}
