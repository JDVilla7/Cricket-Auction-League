import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [phase, setPhase] = useState('Phase 1');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('System Online');

  const fetchBids = async () => {
    const { data } = await supabase
      .from('bids_draft')
      .select('*, league_owners(team_name, budget), players(name)')
      .order('created_at', { ascending: false });
    if (data) setLiveBids(data);
  };

  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchBids)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const pushPlayer = async () => {
    if (!pid) return alert("Enter Player ID!");
    setStatus('Pushing...');
    const { error } = await supabase.from('active_auction').upsert({ id: 2, player_id: pid, status: 'bidding' });
    if (!error) {
      setStatus(`LIVE: Player ${pid}`);
      alert(`Player ${pid} pushed successfully! Check owner screens.`);
    } else {
      alert("Error: " + error.message);
    }
  };

  const handleSold = async (bid) => {
    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;
    const { error: resErr } = await supabase.from('auction_results').insert([{ 
      player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: phase 
    }]);
    await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);
    await supabase.from('bids_draft').delete().eq('id', bid.id);

    if (!resErr) { alert("SOLD!"); fetchBids(); }
  };

  const resetTournament = async () => {
    if(!confirm("Reset everything?")) return;
    await supabase.from('auction_results').delete().neq('id', 0);
    await supabase.from('bids_draft').delete().neq('id', 0);
    await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);
    alert("Full Reset Done!");
    fetchBids();
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Admin Control Tower</h1>
      <p style={{ color: status.includes('LIVE') ? '#22c55e' : '#666' }}>● {status}</p>

      <div style={{ background: '#111', padding: '20px', borderRadius: '10px', display: 'inline-block', marginBottom: '20px' }}>
        <input type="number" placeholder="Player ID" onChange={(e) => setPid(e.target.value)} style={{ padding: '10px', width: '80px' }} />
        <button onClick={pushPlayer} style={{ padding: '10px 20px', background: '#e11d48', color: '#fff', border: 'none', marginLeft: '10px', borderRadius: '5px', fontWeight: 'bold' }}>PUSH LIVE</button>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#111', padding: '20px', borderRadius: '10px' }}>
        <h3>Active Bids</h3>
        {liveBids.length > 0 ? liveBids.map((bid) => (
          <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #222' }}>
            <span><strong>{bid.league_owners?.team_name}</strong>: {bid.bid_amount} Cr</span>
            <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', padding: '5px 15px', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>SOLD</button>
          </div>
        )) : <p style={{color:'#444'}}>No bids yet...</p>}
      </div>
      <button onClick={resetTournament} style={{ marginTop: '50px', color: '#444', background: 'none', border: 'none', cursor: 'pointer' }}>Wipe All Data</button>
    </div>
  );
}
