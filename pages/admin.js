import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winner: null });

  const syncAdmin = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!active?.player_id) return setData({ player: null, bids: [], isSold: false, winner: null });

    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
    const { data: res } = await supabase.from('auction_results').select('*, league_owners(team_name)').eq('player_id', active.player_id).maybeSingle();

    setData({ player: p, bids: bids || [], isSold: active.is_sold, winner: res });
  };

  useEffect(() => {
    syncAdmin();
    const sub = supabase.channel('admin_master').on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const resetTournament = async () => {
    if(!confirm("Wipe ALL squads and reset budgets to 150 Cr?")) return;
    
    // THE NUCLEAR DELETE: Deletes everything where owner_id is not 0
    await supabase.from('auction_results').delete().neq('owner_id', 0);
    await supabase.from('bids_draft').delete().neq('owner_id', 0);
    
    // Reset all team budgets
    await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);
    
    // Clear the active screen
    await supabase.from('active_auction').update({ 
      player_id: null, is_sold: false, winner_name: '', winning_amount: 0 
    }).eq('id', 2);

    alert("Tournament Reset: Database is now empty.");
  };

  const createOwner = async () => {
    if(!ownerName) return;
    const { data, error } = await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]).select();
    if(!error) alert(`Team Added! ID: ${data[0].id}`);
    setOwnerName('');
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
    setPid('');
  };

  const handleSold = async (bid) => {
    if(!confirm(`Sell ${data.player.name} to ${bid.league_owners.team_name}?`)) return;
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount }]);
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    await supabase.from('active_auction').update({ is_sold: true, winner_name: bid.league_owners.team_name, winning_amount: bid.bid_amount }).eq('id', 2);
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '30px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>ADMIN CONTROL</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '800px', margin: '0 auto 40px auto' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '15px' }}>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Team Name" style={{ padding: '10px' }} />
          <button onClick={createOwner} style={{ padding: '10px', background: '#22c55e', marginLeft: '5px' }}>Add</button>
          <button onClick={resetTournament} style={{ display: 'block', width: '100%', marginTop: '20px', padding: '10px', background: '#e11d48', color: '#fff' }}>RESET ALL DATA</button>
        </div>
        <div style={{ background: '#111', padding: '20px', borderRadius: '15px' }}>
          <input value={pid} onChange={e => setPid(e.target.value)} placeholder="Player ID" style={{ padding: '15px', width: '80px' }} />
          <button onClick={pushPlayer} style={{ padding: '15px', background: '#fbbf24', marginLeft: '10px' }}>PUSH</button>
        </div>
      </div>
      {data.isSold ? <h1>SOLD!</h1> : data.player && <h1>{data.player.name}</h1>}
      {/* ... bidding list renders here */}
    </div>
  );
}
