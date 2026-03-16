import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [phase, setPhase] = useState('Phase 1');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('Ready');

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
    const { error } = await supabase.from('active_auction').upsert({ id: 2, player_id: pid, status: 'bidding' });
    if (!error) setStatus(`Pushing Player ${pid}...`);
  };

  const handleSold = async (bid) => {
    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;
    
    // 1. Save Result with Phase
    const { error: resErr } = await supabase.from('auction_results').insert([{ 
      player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: phase 
    }]);

    // 2. Update Budget & Delete Bid
    await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);
    await supabase.from('bids_draft').delete().eq('id', bid.id);

    if (!resErr) {
      alert(`SOLD! ${bid.players?.name} to ${bid.league_owners?.team_name}`);
      fetchBids();
    }
  };

  const resetTournament = async () => {
    if(!confirm("Reset everything?")) return;
    await supabase.from('auction_results').delete().neq('id', 0);
    await supabase.from('bids_draft').delete().neq('id', 0);
    await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);
    alert("System Reset Complete!");
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ color: '#e11d48' }}>Admin Tower</h1>
      
      <div style={{ background: '#111', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <label>Current Round: </label>
        <input value={phase} onChange={(e) => setPhase(e.target.value)} style={{ background:'#000', color:'#fff', border:'1px solid #444', padding:'5px' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }}>
          <input type="number" placeholder="Player ID" onChange={(e) => setPid(e.target.value)} style={{ padding: '12px', borderRadius: '6px', width: '50%', marginRight: '10px' }} />
          <button onClick={pushPlayer} style={{ padding: '12px 20px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>PUSH LIVE</button>
        </div>

        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
          <h2 style={{ color: '#fbbf24' }}>Bids for {phase}</h2>
          {liveBids.map((bid) => (
            <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
              <span><strong>{bid.league_owners?.team_name}</strong> ({bid.bid_amount} Cr)</span>
              <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight:'bold' }}>SOLD</button>
            </div>
          ))}
        </div>
        <button onClick={resetTournament} style={{ marginTop:'40px', background:'none', border:'none', color:'#444', cursor:'pointer' }}>Reset All Data</button>
      </div>
    </div>
  );
}
