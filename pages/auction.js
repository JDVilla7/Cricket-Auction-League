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
  const [error, setError] = useState(null); // New Error State

  const sync = async () => {
    if (!id) return;

    try {
      // 1. Fetch Owner
      const { data: owner, error: oErr } = await supabase.from('league_owners').select('*').eq('id', id).single();
      
      if (oErr || !owner) {
        setError(`Team ID ${id} not found. re-add team in Admin.`);
        return;
      }

      // 2. Fetch Squad
      const { data: squad, count } = await supabase
        .from('auction_results')
        .select('winning_bid, player_id, players(name)', { count: 'exact' })
        .eq('owner_id', id);

      const actualSquad = squad || [];
      const actualCount = count || 0;
      setSquadList(actualSquad);

      // 3. Fetch Active Auction
      const { data: act } = await supabase.from('active_auction').select('*').eq('id', 2).single();
      
      // 4. Confetti
      if (act?.is_sold && act.winner_name === owner.team_name) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 999 });
      }

      // 5. Final State Build
      let auctionState = {
        owner,
        squadCount: actualCount,
        player: null,
        highBid: 0,
        bidderId: null,
        isSold: false,
        winName: '',
        winAmt: 0
      };

      if (act?.player_id) {
        const { data: p } = await supabase.from('players').select('*').eq('id', act.player_id).single();
        const { data: b } = await supabase.from('bids_draft')
          .select('*').eq('player_id', act.player_id)
          .order('bid_amount', { ascending: false }).limit(1).maybeSingle();
        
        auctionState = {
          ...auctionState,
          player: p,
          highBid: b ? b.bid_amount : (p.base_price / 10000000),
          bidderId: b ? b.owner_id : null,
          isSold: act.is_sold,
          winName: act.winner_name,
          winAmt: act.winning_amount
        };
      }
      setSt(auctionState);
      setError(null); // Clear errors if sync is successful
    } catch (e) {
      console.error(e);
      setError("Sync failed. Check database connection.");
    }
  };

  useEffect(() => {
    if (router.isReady) {
      sync();
      const sub = supabase.channel(`stadium_final_${id}`).on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
      return () => supabase.removeChannel(sub);
    }
  }, [router.isReady, id]);

  const placeBid = async () => {
    if (st.isSold || String(st.bidderId) === String(id) || !st.player) return;
    const next = st.bidderId ? st.highBid + 0.25 : st.highBid;
    if (next > st.owner.budget) return alert("Out of Budget!");
    await supabase.from('bids_draft').upsert({ owner_id: id, player_id: st.player.id, bid_amount: next }, { onConflict: 'owner_id,player_id' });
  };

  // --- UI SCREENS ---
  if (error) return (
    <div style={{ background: '#000', color: '#e11d48', height: '100dvh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '20px' }}>
      <div>
        <h1>⚠️ ACCESS DENIED</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#222', color: '#fff', border: 'none', marginTop: '20px' }}>RETRY</button>
      </div>
    </div>
  );

  if (!st.owner) return <div style={{ background: '#000', color: '#fff', height: '100dvh', display: 'grid', placeItems: 'center' }}>SYNCING STADIUM...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', margin: 0, overflow: 'hidden', position: 'relative' }}>
      <header style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', background: '#0a0a0a', borderBottom: '1px solid #222' }}>
        <div>
          <h2 style={{ margin: 0, color: '#e11d48', fontSize: '1rem' }}>{st.owner.team_name}</h2>
          <div style={{ color: '#666', fontSize: '0.7rem', fontWeight: 'bold' }}>SQUAD: {st.squadCount} / 15</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, color: '#22c55e', fontSize: '1.2rem' }}>{st.owner.budget.toFixed(2)} Cr</h2>
          <div style={{ color: '#444', fontSize: '0.6rem' }}>BUDGET</div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
        {st.isSold ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'blink 0.6s infinite' }}>
            <h1 style={{ fontSize: '5rem', color: '#e11d48', fontWeight: '900', margin: 0 }}>SOLD!</h1>
            <div style={{ background: '#111', padding: '30px', borderRadius: '20px', border: '1px solid #333', marginTop: '20px', width: '100%', maxWidth: '350px' }}>
                <h2 style={{ margin: 0 }}>{st.player?.name}</h2>
                <p style={{ color: '#fbbf24', fontSize: '1.2rem', margin: '10px 0', fontWeight: 'bold' }}>TO {st.winName}</p>
                <p style={{ color: '#22c55e', fontSize: '1.6rem', fontWeight: '900' }}>FOR {st.winAmt.toFixed(2)} Cr</p>
            </div>
          </div>
        ) : st.player ? (
          <div style={{ width: '100%' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)', margin: 0, fontWeight: '900', textTransform: 'uppercase' }}>{st.player.name}</h1>
            <div style={{ background: '#111', margin: '30px auto', padding: '25px', borderRadius: '30px', border: '3px solid #fbbf24', maxWidth: '320px' }}>
               <h2 style={{ margin: 0, fontSize: '4.5rem', color: '#fbbf24', lineHeight: '1' }}>{st.highBid.toFixed(2)}</h2>
               <p style={{ margin: 0, color: '#fbbf24' }}>Crore</p>
            </div>
            <button disabled={String(st.bidderId) === String(id) || st.isSold} onClick={placeBid} style={{ width: '100%', maxWidth: '350px', padding: '20px', borderRadius: '15px', border: 'none', background: String(st.bidderId) === String(id) ? '#1a1a1a' : '#e11d48', color: '#fff', fontSize: '1.8rem', fontWeight: '900' }}>
              {String(st.bidderId) === String(id) ? "YOU LEAD" : `BID ${(st.bidderId ? st.highBid + 0.25 : st.highBid).toFixed(2)} Cr`}
            </button>
          </div>
        ) : <h2>READY FOR AUCTION?</h2>}
      </div>

      <button onClick={() => { sync(); setShowSquad(true); }} style={{ padding: '15px', background: '#111', color: '#ccc', border: 'none', borderTop: '1px solid #222', fontSize: '0.9rem', fontWeight: 'bold' }}>
        📊 VIEW SQUAD ({st.squadCount})
      </button>

      {showSquad && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.98)', zIndex: 100, padding: '40px 20px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <button onClick={() => setShowSquad(false)} style={{ float: 'right', background: 'none', border: 'none', color: '#e11d48', fontSize: '1.8rem', fontWeight: 'bold' }}>✕</button>
          <h1 style={{ color: '#fbbf24', marginBottom: '30px' }}>My Squad</h1>
          <div style={{ marginTop: '20px' }}>
            {squadList.length > 0 ? squadList.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '18px', borderBottom: '1px solid #222', background: '#0a0a0a', marginBottom: '5px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>{item.players?.name || `ID: ${item.player_id}`}</span>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>
              </div>
            )) : <p style={{color:'#666', textAlign: 'center', marginTop: '50px'}}>Your squad is currently empty.</p>}
          </div>
        </div>
      )}
      <style jsx global>{` @keyframes blink { 50% { opacity: 0.5; } } body { margin: 0; background: #050505; } `}</style>
    </div>
  );
}
