import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winName: '', winAmt: 0 });

  const sync = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!active) return;
    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });

    setData({ player: p, bids: bids || [], isSold: active.is_sold, winName: active.winner_name, winAmt: active.winning_amount });
  };

  useEffect(() => {
    sync();
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const handleSold = async (bid) => {
    if (!confirm(`Sell to ${bid.league_owners.team_name}?`)) return;

    // 1. Record Result & Update Budget
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: "Main" }]);
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    
    // 2. THE FIX: Update active_auction with ALL info at once
    await supabase.from('active_auction').update({ 
      is_sold: true, 
      winner_name: bid.league_owners.team_name, 
      winning_amount: bid.bid_amount 
    }).eq('id', 2);
    
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
    setPid('');
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#111', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
        <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="Player ID" style={{ padding: '12px', width: '80px', borderRadius: '8px' }} />
        <button onClick={pushPlayer} style={{ padding: '12px 25px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', marginLeft: '10px', fontWeight: 'bold' }}>PUSH NEXT</button>
      </div>

      {data.isSold ? (
        <div style={{ padding: '60px', border: '2px dashed #22c55e', borderRadius: '20px', background: '#050505' }}>
          <h1 style={{ color: '#22c55e', fontSize: '4rem', margin: 0 }}>SOLD!</h1>
          <h2 style={{ fontSize: '2.5rem', margin: '10px 0' }}>{data.winName}</h2>
          <h3 style={{ color: '#fbbf24' }}>WON {data.player?.name} FOR {data.winAmt.toFixed(2)} Cr</h3>
          <p style={{ color: '#444', marginTop: '20px' }}>Enter next Player ID above to reset.</p>
        </div>
      ) : data.player && (
        <>
          <h1 style={{ fontSize: '3.5rem', margin: 0 }}>{data.player.name}</h1>
          <div style={{ background: '#111', padding: '30px', borderRadius: '25px', border: '3px solid #fbbf24', display: 'inline-block', margin: '20px 0' }}>
            <h2 style={{ fontSize: '4rem', margin: 0, color: '#fbbf24' }}>{data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : "BASE"}</h2>
            {data.bids[0] && <h3 style={{ color: '#22c55e', margin: '5px 0 0 0' }}>{data.bids[0].league_owners.team_name}</h3>}
          </div>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            {data.bids.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#111', padding: '15px', marginBottom: '10px', borderRadius: '10px', alignItems: 'center' }}>
                <span style={{fontWeight:'bold'}}>{b.league_owners.team_name}</span>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{b.bid_amount} Cr</span>
                <button onClick={() => handleSold(b)} style={{ background: '#22c55e', border: 'none', padding: '10px 20px', borderRadius: '5px', fontWeight: 'bold' }}>SOLD</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
