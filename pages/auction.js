import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import confetti from 'canvas-confetti';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [st, setSt] = useState({ 
    owner: null, player: null, highBid: 0, bidderId: null, 
    isSold: false, winName: '', winAmt: 0, squadCount: 0 
  });
  const [squadList, setSquadList] = useState([]);
  const [showSquad, setShowSquad] = useState(false);

  const sync = async () => {
    if (!id) return;

    // 1. Fetch Fresh Owner & Results
    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: squad, count } = await supabase.from('auction_results').select('winning_bid, players(name)').eq('owner_id', id);

    // CRITICAL: If no results found, FORCE wipe the local list
    if (!squad || squad.length === 0) {
      setSquadList([]);
    } else {
      setSquadList(squad);
    }

    const currentCount = count || 0;

    // 2. Fetch Active Auction
    const { data: act } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    if (act?.is_sold && act.winner_name === owner?.team_name) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }

    // 3. Update Master State
    let stateUpdate = { owner, squadCount: currentCount, player: null, isSold: false };

    if (act?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', act.player_id).single();
      const { data: b } = await supabase.from('bids_draft').select('*').eq('player_id', act.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();
      stateUpdate = { ...stateUpdate, player: p, highBid: b ? b.bid_amount : (p.base_price / 10000000), bidderId: b ? b.owner_id : null, isSold: act.is_sold, winName: act.winner_name, winAmt: act.winning_amount };
    }

    setSt(stateUpdate);
  };

  useEffect(() => {
    if (router.isReady) {
      sync();
      const sub = supabase.channel(`stadium_${id}`).on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
      return () => supabase.removeChannel(sub);
    }
  }, [router.isReady, id]);

  const placeBid = async () => {
    const next = st.bidderId ? st.highBid + 0.25 : st.highBid;
    await supabase.from('bids_draft').upsert({ owner_id: id, player_id: st.player.id, bid_amount: next }, { onConflict: 'owner_id,player_id' });
  };

  if (!st.owner) return <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'grid', placeItems: 'center' }}>SYNCING...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222' }}>
        <div>
          <h2 style={{ margin: 0, color: '#e11d48', fontSize: '1rem' }}>{st.owner.team_name}</h2>
          <div style={{ color: '#666', fontSize: '0.7rem' }}>SQUAD: {st.squadCount} / 15</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, color: '#22c55e', fontSize: '1.2rem' }}>{st.owner.budget.toFixed(2)} Cr</h2>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        {st.isSold ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '5rem', color: '#e11d48', fontWeight: '900' }}>SOLD!</h1>
            <div style={{ background: '#111', padding: '30px', borderRadius: '20px' }}>
                <h2 style={{ margin: 0 }}>{st.player?.name}</h2>
                <p style={{ color: '#fbbf24' }}>TO {st.winName} FOR {st.winAmt.toFixed(2)} Cr</p>
            </div>
          </div>
        ) : st.player ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900' }}>{st.player.name}</h1>
            <h2 style={{ fontSize: '4.5rem', color: '#fbbf24' }}>{st.highBid.toFixed(2)}</h2>
            <button onClick={placeBid} style={{ padding: '20px 50px', borderRadius: '15px', background: '#e11d48', color: '#fff', fontSize: '1.8rem', fontWeight: '900', border: 'none' }}>BID</button>
          </div>
        ) : <h2>READY?</h2>}
      </div>

      <button onClick={() => { sync(); setShowSquad(true); }} style={{ padding: '15px', background: '#111', color: '#ccc', border: 'none', borderTop: '1px solid #222' }}>
        📊 VIEW MY SQUAD ({st.squadCount})
      </button>

      {showSquad && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.98)', zIndex: 100, padding: '40px 20px', overflowY: 'auto' }}>
          <button onClick={() => setShowSquad(false)} style={{ float: 'right', color: '#e11d48', fontSize: '1.8rem', background: 'none', border: 'none' }}>✕</button>
          <h1>My Squad</h1>
          {squadList.length > 0 ? squadList.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #222' }}>
              <span>{item.players?.name}</span>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>
            </div>
          )) : <p style={{textAlign: 'center', color: '#444'}}>Squad is empty.</p>}
        </div>
      )}
    </div>
  );
}
