import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winner: null });

  const syncAdmin = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!active?.player_id) return setData({ player: null, bids: [], isSold: false });

    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
    const { data: res } = await supabase.from('auction_results').select('*, league_owners(team_name)').eq('player_id', active.player_id).maybeSingle();

    setData({ player: p, bids: bids || [], isSold: active.is_sold, winner: res });
  };

  useEffect(() => {
    syncAdmin();
    const sub = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const resetTournament = async () => {
    if(!confirm("Wipe ALL data and reset budgets to 150 Cr?")) return;
    await supabase.from('auction_results').delete().neq('id', 0);
    await supabase.from('bids_draft').delete().neq('id', 0);
    await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);
    await supabase.from('active_auction').update({ player_id: null, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    alert("System Reset!");
  };

  const createOwner = async () => {
    const { data, error } = await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]).select();
    if(!error) alert(`Owner Created! Link ID: ${data[0].id}`);
    setOwnerName('');
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
    setPid('');
  };

  const handleSold = async (bid) => {
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount }]);
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    await supabase.from('active_auction').update({ is_sold: true, winner_name: bid.league_owners.team_name, winning_amount: bid.bid_amount }).eq('id', 2);
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '15px' }}>
          <h3>Owner Setup</h3>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Team Name" style={{ padding: '10px' }} />
          <button onClick={createOwner} style={{ padding: '10px', background: '#22c55e', border: 'none', marginLeft: '5px' }}>Add</button>
          <button onClick={resetTournament} style={{ display: 'block', width: '100%', marginTop: '20px', padding: '10px', background: '#e11d48', border: 'none', color: '#fff' }}>RESET ALL DATA</button>
        </div>
        <div style={{ background: '#111', padding: '20px', borderRadius: '15px' }}>
          <h3>Push Player</h3>
          <input value={pid} onChange={e => setPid(e.target.value)} placeholder="ID" style={{ padding: '10px', width: '60px' }} />
          <button onClick={pushPlayer} style={{ padding: '10px', background: '#fbbf24', border: 'none', marginLeft: '5px' }}>PUSH LIVE</button>
        </div>
      </div>

      {data.isSold ? (
        <div style={{ padding: '40px', border: '2px dashed #22c55e', borderRadius: '20px' }}>
          <h1 style={{ color: '#22c55e', fontSize: '3rem' }}>SOLD!</h1>
          <h2>{data.winner?.league_owners?.team_name} bought {data.player?.name}</h2>
        </div>
      ) : data.player && (
        <div>
          <h1>{data.player.name}</h1>
          <h2 style={{ fontSize: '4rem', color: '#fbbf24' }}>{data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : (data.player.base_price/10000000).toFixed(2)} Cr</h2>
          {data.bids.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#111', marginBottom: '5px' }}>
              <span>{b.league_owners.team_name}</span>
              <button onClick={() => handleSold(b)} style={{ background: '#22c55e', padding: '5px 20px', fontWeight: 'bold' }}>SOLD AT {b.bid_amount}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
