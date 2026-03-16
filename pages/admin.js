import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [data, setData] = useState({ player: null, bids: [] });

  const syncAdmin = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (active?.player_id) {
      const { data: player } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
      setData({ player, bids: bids || [] });
    }
  };

  useEffect(() => {
    syncAdmin();
    const channel = supabase.channel('admin_live').on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    if (!confirm(`Sell ${data.player.name} to ${bid.league_owners.team_name}?`)) return;
    const { error } = await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: "Main" }]);
    if (!error) {
       await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
       await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
       alert("SOLD SUCCESSFULLY!");
    }
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('bids_draft').delete().neq('id', 0); // Clear old bids
    await supabase.from('active_auction').upsert({ id: 2, player_id: pid });
    setPid('');
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #222' }}>
        <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="Player ID" style={{ padding: '10px', width: '80px', background: '#111', color: '#fff', border: '1px solid #444' }} />
        <button onClick={pushPlayer} style={{ padding: '10px 20px', background: '#e11d48', color: '#fff', border: 'none', marginLeft: '10px', borderRadius: '5px' }}>PUSH PLAYER</button>
      </div>

      {data.player && (
        <div style={{ marginTop: '40px' }}>
          <h1 style={{ fontSize: '4rem', margin: 0 }}>{data.player.name}</h1>
          <div style={{ background: '#111', padding: '40px', borderRadius: '30px', border: '3px solid #fbbf24', display: 'inline-block', margin: '30px 0' }}>
            <p style={{ margin: 0, color: '#666' }}>CURRENT HIGH BID</p>
            <h2 style={{ fontSize: '6rem', margin: 0, color: '#fbbf24', lineHeight: '1' }}>{data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : (data.player.base_price / 10000000).toFixed(2)}</h2>
            {data.bids[0] && <h2 style={{ color: '#22c55e' }}>{data.bids[0].league_owners.team_name}</h2>}
          </div>

          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {data.bids.map((bid) => (
              <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: '#111', marginBottom: '10px', borderRadius: '15px' }}>
                <span style={{ fontSize: '1.2rem' }}>{bid.league_owners.team_name}</span>
                <span style={{ fontSize: '1.2rem', color: '#22c55e', fontWeight: 'bold' }}>{bid.bid_amount} Cr</span>
                <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }}>SOLD</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
