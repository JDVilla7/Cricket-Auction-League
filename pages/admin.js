import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winner: null });

  const sync = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!active) return;

    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
    
    // Check results for details
    const { data: res } = await supabase.from('auction_results').select('*, league_owners(team_name)').eq('player_id', active.player_id).maybeSingle();

    setData({ player: p, bids: bids || [], isSold: active.is_sold, winner: res });
  };

  useEffect(() => {
    sync();
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const handleSold = async (bid) => {
    if (!confirm(`Sell to ${bid.league_owners.team_name}?`)) return;

    // 1. Record Result
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: "Main" }]);
    
    // 2. Update Budget
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    
    // 3. Mark as Sold in Active Table (This triggers the flash on owner screens)
    await supabase.from('active_auction').update({ is_sold: true }).eq('id', 2);
    
    // 4. Clear Bids
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
    setPid('');
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100dvh', fontFamily: 'sans-serif', textAlign: 'center', padding: '20px' }}>
      <div style={{ background: '#111', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
        <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="Player ID" style={{ padding: '12px', width: '80px', borderRadius: '8px' }} />
        <button onClick={pushPlayer} style={{ padding: '12px 25px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', marginLeft: '10px', fontWeight: 'bold' }}>PUSH NEXT</button>
      </div>

      {data.isSold ? (
        <div style={{ padding: '60px', border: '2px dashed #22c55e', borderRadius: '20px' }}>
          <h1 style={{ color: '#22c55e', fontSize: '4rem' }}>SOLD!</h1>
          <h2 style={{ margin: 0 }}>{data.winner?.league_owners?.team_name} WON {data.player?.name}</h2>
          <p style={{ color: '#444' }}>Push next player to clear this screen.</p>
        </div>
      ) : data.player && (
        <>
          <h1 style={{ fontSize: '4rem', margin: 0 }}>{data.player.name}</h1>
          <div style={{ background: '#111', padding: '30px', borderRadius: '25px', border: '2px solid #fbbf24', display: 'inline-block', margin: '20px 0' }}>
            <h2 style={{ fontSize: '5rem', margin: 0, color: '#fbbf24' }}>{data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : "BASE"}</h2>
            {data.bids[0] && <h3 style={{ color: '#22c55e' }}>{data.bids[0].league_owners.team_name}</h3>}
          </div>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            {data.bids.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#111', padding: '15px', marginBottom: '10px', borderRadius: '10px' }}>
                <span>{b.league_owners.team_name}</span>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{b.bid_amount} Cr</span>
                <button onClick={() => handleSold(b)} style={{ background: '#22c55e', border: 'none', padding: '5px 15px', borderRadius: '5px', fontWeight: 'bold' }}>SOLD</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
