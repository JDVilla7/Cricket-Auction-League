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
    if(!confirm("Wipe ALL data and reset budgets to 150 Cr? This cannot be undone.")) return;
    await supabase.from('auction_results').delete().neq('id', 0);
    await supabase.from('bids_draft').delete().neq('id', 0);
    await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);
    await supabase.from('active_auction').update({ player_id: null, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    alert("System Reset Successfully!");
  };

  const createOwner = async () => {
    if(!ownerName) return;
    const { data, error } = await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]).select();
    if(!error) alert(`Team Added! Owner ID: ${data[0].id}`);
    setOwnerName('');
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('id', 0);
    setPid('');
  };

  const handleSold = async (bid) => {
    if(!confirm(`Finalize Sale: ${data.player.name} to ${bid.league_owners.team_name}?`)) return;
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount }]);
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    await supabase.from('active_auction').update({ is_sold: true, winner_name: bid.league_owners.team_name, winning_amount: bid.bid_amount }).eq('id', 2);
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>AUCTION CONTROL TOWER</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1000px', margin: '0 auto 40px auto' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
          <h3>TEAM SETUP</h3>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Team Name" style={{ padding: '10px' }} />
          <button onClick={createOwner} style={{ padding: '10px 20px', background: '#22c55e', border: 'none', marginLeft: '5px', fontWeight: 'bold' }}>ADD</button>
          <button onClick={resetTournament} style={{ display: 'block', width: '100%', marginTop: '20px', padding: '15px', background: '#e11d48', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '5px' }}>RESET TOURNAMENT (WIPE ALL)</button>
        </div>

        <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
          <h3>LIVE PUSH</h3>
          <input value={pid} onChange={e => setPid(e.target.value)} placeholder="Player ID" style={{ padding: '15px', width: '80px', textAlign: 'center' }} />
          <button onClick={pushPlayer} style={{ padding: '15px 30px', background: '#fbbf24', border: 'none', marginLeft: '10px', fontWeight: 'bold', borderRadius: '5px' }}>PUSH PLAYER</button>
        </div>
      </div>

      {data.isSold ? (
        <div style={{ padding: '60px', background: '#0a0a0a', border: '2px dashed #22c55e', borderRadius: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#22c55e', fontSize: '4rem', margin: 0 }}>SOLD!</h1>
          <h2 style={{ margin: '10px 0' }}>{data.winner?.league_owners?.team_name}</h2>
          <p style={{ color: '#666' }}>Sign next player above to clear this screen.</p>
        </div>
      ) : data.player ? (
        <div style={{ background: '#111', padding: '40px', borderRadius: '30px', border: '1px solid #444', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '3rem', margin: 0 }}>{data.player.name}</h1>
          <h2 style={{ fontSize: '5rem', color: '#fbbf24', margin: '20px 0' }}>
            {data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : (data.player.base_price/10000000).toFixed(2)} Cr
          </h2>
          <div style={{ textAlign: 'left', marginTop: '40px' }}>
            {data.bids.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: '#000', marginBottom: '10px', borderRadius: '15px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{b.league_owners.team_name}</span>
                <button onClick={() => handleSold(b)} style={{ background: '#22c55e', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}>SOLD AT {b.bid_amount.toFixed(2)}</button>
              </div>
            ))}
          </div>
        </div>
      ) : <h1 style={{ color: '#333', marginTop: '100px' }}>WAITING FOR PLAYER ID...</h1>}
    </div>
  );
}
