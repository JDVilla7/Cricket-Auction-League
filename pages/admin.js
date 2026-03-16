/* pages/admin.js */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [phase, setPhase] = useState('Phase 1');
  const [liveBids, setLiveBids] = useState([]);

  const fetchBids = async () => {
    const { data } = await supabase
      .from('bids_draft')
      .select('*, league_owners(team_name, budget), players(name)')
      .order('bid_amount', { ascending: false }); // Show highest bid at top
    if (data) setLiveBids(data);
  };

  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-room').on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchBids).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    // 1. Safety Check: Is player already sold?
    const { data: alreadySold } = await supabase.from('auction_results').select('id').eq('player_id', bid.player_id).maybeSingle();
    if (alreadySold) return alert("Error: This player is already sold!");

    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;

    // 2. The Final Sale
    const { error: resErr } = await supabase.from('auction_results').insert([{ 
      player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: phase 
    }]);

    // 3. Update Winner's Budget
    await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);

    // 4. CRITICAL: Delete ALL bids for this player so nobody else gets charged
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);

    if (!resErr) {
      alert(`SUCCESS: ${bid.players?.name} sold to ${bid.league_owners?.team_name}`);
      fetchBids();
    }
  };

  const pushPlayer = async () => {
    if (!pid) return alert("Enter Player ID");
    await supabase.from('active_auction').upsert({ id: 2, player_id: pid, status: 'bidding' });
    // Clear previous bids for a fresh start
    await supabase.from('bids_draft').delete().eq('player_id', pid);
    alert("Player Pushed & Bids Cleared for start!");
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Admin Command Center</h1>
      <div style={{ background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #333', maxWidth: '600px', margin: '0 auto' }}>
        <input type="number" placeholder="Player ID" onChange={(e) => setPid(e.target.value)} style={{ padding: '10px', width: '80px' }} />
        <button onClick={pushPlayer} style={{ padding: '10px 20px', background: '#e11d48', color: '#fff', border: 'none', marginLeft: '10px', borderRadius: '5px' }}>PUSH LIVE</button>
        <div style={{marginTop:'10px'}}>
            <input value={phase} onChange={(e) => setPhase(e.target.value)} style={{background:'#000', color:'#fff', border:'1px solid #444', padding:'5px'}} />
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '20px auto', background: '#111', padding: '20px', borderRadius: '10px' }}>
        <h2>Live Bids</h2>
        {liveBids.length > 0 ? liveBids.map((bid) => (
          <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #222' }}>
            <span><strong>{bid.league_owners?.team_name}</strong>: {bid.bid_amount} Cr</span>
            <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', padding: '5px 15px', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>SOLD</button>
          </div>
        )) : <p>No bids yet...</p>}
      </div>
    </div>
  );
}
