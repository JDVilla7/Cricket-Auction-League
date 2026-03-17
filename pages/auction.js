import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [st, setSt] = useState({ owner: null, player: null, highBid: 0, bidderId: null, isSold: false, squadCount: 0 });
  const [squadList, setSquadList] = useState([]);
  const [showSquad, setShowSquad] = useState(false);

  const sync = async () => {
    if (!id) return;

    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: act } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    // FETCH SQUAD - Force empty if nothing exists
    const { data: squad, count } = await supabase.from('auction_results').select('winning_bid, players(name)').eq('owner_id', id);
    setSquadList(squad || []);

    if (act?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', act.player_id).single();
      const { data: b } = await supabase.from('bids_draft').select('*').eq('player_id', act.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();

      setSt({
        owner,
        player: p,
        highBid: b ? b.bid_amount : (p.base_price / 10000000),
        bidderId: b ? b.owner_id : null,
        isSold: act.is_sold,
        squadCount: count || 0
      });
    } else {
      setSt({ owner, player: null, highBid: 0, bidderId: null, isSold: false, squadCount: count || 0 });
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
    
    // FIXED CALCULATION: If no bid exists, use base. If it does, add exactly 0.25.
    const currentPrice = st.bidderId ? st.highBid : st.highBid;
    const nextBid = st.bidderId ? currentPrice + 0.25 : currentPrice;

    if (nextBid > st.owner.budget) return alert("No Money!");

    await supabase.from('bids_draft').upsert({ 
      owner_id: id, player_id: st.player.id, bid_amount: nextBid 
    }, { onConflict: 'owner_id,player_id' });
  };

  if (!st.owner) return <div>Loading...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
        <h2>{st.owner.team_name}</h2>
        <h2 style={{ color: '#22c55e' }}>{st.owner.budget.toFixed(2)} Cr</h2>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        {st.isSold ? (
           <h1 style={{ fontSize: '5rem', color: '#e11d48' }}>SOLD!</h1>
        ) : st.player ? (
          <div style={{ textAlign: 'center' }}>
            <h1>{st.player.name}</h1>
            <div style={{ padding: '40px', background: '#111', borderRadius: '20px', margin: '20px', border: '2px solid #fbbf24' }}>
              <h2 style={{ fontSize: '4rem', color: '#fbbf24', margin: 0 }}>{st.highBid.toFixed(2)}</h2>
            </div>
            <button onClick={placeBid} style={{ padding: '20px 60px', background: '#e11d48', color: '#fff', fontSize: '2rem', border: 'none', borderRadius: '10px' }}>
              {String(st.bidderId) === String(id) ? "LEADING" : "BID"}
            </button>
          </div>
        ) : <h1>WAITING...</h1>}
      </div>

      <button onClick={() => setShowSquad(true)} style={{ padding: '20px', background: '#111', color: '#fff' }}>VIEW SQUAD ({st.squadCount})</button>

      {showSquad && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000', padding: '40px' }}>
          <button onClick={() => setShowSquad(false)} style={{ color: 'red' }}>CLOSE</button>
          <h1>My Players</h1>
          {squadList.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #222' }}>
              <span>{p.players?.name}</span>
              <span>{p.winning_bid} Cr</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
