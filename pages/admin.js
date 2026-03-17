import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false });

  const sync = async () => {
    const { data: act } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!act?.player_id) return setData({ player: null, bids: [], isSold: false });

    const { data: p } = await supabase.from('players').select('*').eq('id', act.player_id).single();
    const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', act.player_id).order('bid_amount', { ascending: false });

    setData({ player: p, bids: bids || [], isSold: act.is_sold });
  };

  useEffect(() => {
    sync();
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, sync).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const resetTournament = async () => {
    if(!confirm("DELETE ALL DATA?")) return;
    // We use .neq('id', 0) to force Supabase to find and kill every row
    await supabase.from('auction_results').delete().neq('id', 0);
    await supabase.from('bids_draft').delete().neq('id', 0);
    await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);
    await supabase.from('active_auction').update({ player_id: null, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    alert("WIPED CLEAN.");
  };

  const pushPlayer = async () => {
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
    setPid('');
  };

  const handleSold = async (bid) => {
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount }]);
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    await supabase.from('active_auction').update({ is_sold: true, winner_name: bid.league_owners.team_name, winning_amount: bid.bid_amount }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '40px' }}>
      <button onClick={resetTournament} style={{ background: 'red', padding: '10px' }}>RESET ALL</button>
      <input value={pid} onChange={e => setPid(e.target.value)} placeholder="Player ID" />
      <button onClick={pushPlayer}>PUSH</button>
      {data.player && <h1>{data.player.name}</h1>}
      {data.bids.map(b => (
        <div key={b.id} style={{ margin: '10px', border: '1px solid #333', padding: '10px' }}>
          {b.league_owners.team_name} - {b.bid_amount} Cr
          <button onClick={() => handleSold(b)}>SOLD</button>
        </div>
      ))}
    </div>
  );
}
