import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [state, setState] = useState({ owner: null, player: null, highBid: 0, bidderId: null, isSold: false, winner: null });

  const sync = async () => {
    if (!id) return;
    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    if (active?.player_id) {
      const { data: player } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: bid } = await supabase.from('bids_draft').select('*').eq('player_id', active.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();
      const { data: result } = await supabase.from('auction_results').select('*, league_owners(team_name)').eq('player_id', active.player_id).maybeSingle();

      setState({
        owner,
        player,
        highBid: bid ? bid.bid_amount : (player.base_price / 10000000),
        bidderId: bid ? bid.owner_id : null,
        isSold: active.is_sold,
        winner: result
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
    if (state.isSold || String(state.bidderId) === String(id)) return;
    const next = state.bidderId ? state.highBid + 0.25 : state.highBid;
    await supabase.from('bids_draft').upsert({ owner_id: id, player_id: state.player.id, bid_amount: next }, { onConflict: 'owner_id,player_id' });
  };

  if (!state.owner) return <div style={{ background: '#000', color: '#fff', height: '100dvh', display: 'grid', placeItems: 'center' }}>CONNECTING...</div>;

  const leading = String(state.bidderId) === String(id);

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', margin: 0, padding: 0, overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', background: '#0a0a0a', borderBottom: '1px solid #222' }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ margin: 0, color: '#e11d48', fontSize: '1.2rem' }}>{state.owner.team_name}</h2>
          <small style={{ color: '#444' }}>ID: {id}</small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, color: '#22c55e', fontSize: '1.4rem' }}>{state.owner.budget.toFixed(2)} Cr</h2>
          <small style={{ color: '#444' }}>BUDGET</small>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '20px' }}>
        
        {state.isSold ? (
          <div style={{ textAlign: 'center', animation: 'blink 0.6s infinite' }}>
            <h1 style={{ fontSize: '5rem', color: '#e11d48', fontWeight: '900', margin: 0 }}>SOLD!</h1>
            <div style={{ background: '#111', padding: '20px', borderRadius: '15px', marginTop: '20px' }}>
                <h2 style={{ margin: 0 }}>{state.player?.name}</h2>
                <p style={{ color: '#fbbf24', margin: '5px 0' }}>TO {state.winner?.league_owners?.team_name}</p>
                <p style={{ color: '#22c55e', fontWeight: 'bold' }}>FOR {state.winner?.winning_bid.toFixed(2)} Cr</p>
            </div>
          </div>
        ) : state.player ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(3rem, 12vw, 6rem)', margin: 0, fontWeight: '900', textTransform: 'uppercase' }}>{state.player.name}</h1>
            <p style={{ color: '#fbbf24', fontSize: '1.3rem', margin: '10px 0' }}>BASE: {(state.player.base_price / 10000000).toFixed(2)} Cr</p>

            <div style={{ background: '#111', margin: '30px auto', padding: '30px', borderRadius: '35px', border: '3px solid #fbbf24', maxWidth: '350px' }}>
               <p style={{ margin: 0, color: '#666', fontSize: '0.8rem', fontWeight: 'bold' }}>CURRENT PRICE</p>
               <h2 style={{ margin: 0, fontSize: '5rem', color: '#fbbf24', lineHeight: '1' }}>{state.highBid.toFixed(2)}</h2>
               <p style={{ margin: 0, color: '#fbbf24' }}>Crore</p>
            </div>

            <button 
              disabled={leading || state.isSold}
              onClick={placeBid}
              style={{ width: '100%', maxWidth: '400px', padding: '25px', borderRadius: '20px', border: 'none', background: leading ? '#1a1a1a' : '#e11d48', color: '#fff', fontSize: '2rem', fontWeight: '900' }}
            >
              {leading ? "YOU LEAD" : `BID ${(state.bidderId ? state.highBid + 0.25 : state.highBid).toFixed(2)} Cr`}
            </button>
          </div>
        ) : <h2>READY?</h2>}
      </div>

      <style jsx global>{`
        @keyframes blink { 50% { opacity: 0.5; } }
        body { margin: 0; padding: 0; background: #050505; }
      `}</style>
    </div>
  );
}
