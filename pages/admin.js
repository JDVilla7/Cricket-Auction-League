import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [phaseName, setPhaseName] = useState('Round 1'); // Default phase
  const [liveBids, setLiveBids] = useState([]);

  const fetchBids = async () => {
    const { data } = await supabase
      .from('bids_draft')
      .select('id, bid_amount, owner_id, player_id, league_owners(team_name, budget), players(name)')
      .order('created_at', { ascending: false });
    if (data) setLiveBids(data);
  };

  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-room').on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchBids).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    const newBudget = bid.league_owners.budget - bid.bid_amount;
    if (newBudget < 0) return alert("Insufficient Budget!");

    // 1. Update Owner's Budget
    await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);

    // 2. Add to Results (Now including the 'phase' column)
    await supabase.from('auction_results').insert([
      { 
        player_id: bid.player_id, 
        owner_id: bid.owner_id, 
        winning_bid: bid.bid_amount,
        phase: phaseName 
      }
    ]);

    // 3. Clear Bids for this player
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);

    alert(`${bid.players.name} SOLD to ${bid.league_owners.team_name} in ${phaseName}!`);
    fetchBids();
  };

  const updateAuction = async () => {
    const { error } = await supabase.from('active_auction').update({ player_id: pid }).eq('id', 2);
    if (!error) alert("New Player Live!");
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#e11d48', textAlign: 'center' }}>Admin Control Tower</h1>
      
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* PLAYER & PHASE SETUP */}
        <div style={{ background: '#111', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input type="number" placeholder="Player ID" onChange={(e) => setPid(e.target.value)} style={{ padding: '12px', flex: 1 }} />
            <button onClick={updateAuction} style={{ background: '#e11d48', color: '#fff', padding: '10px 20px', borderRadius: '5px' }}>PUSH LIVE</button>
          </div>
          <input 
            type="text" 
            value={phaseName} 
            onChange={(e) => setPhaseName(e.target.value)} 
            placeholder="Set Current Phase (e.g. Round 1)" 
            style={{ padding: '10px', width: '100%', borderRadius: '5px', background: '#222', color: '#fff', border: '1px solid #444' }} 
          />
        </div>

        {/* LIVE BIDS LOG */}
        <div style={{ background: '#111', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
          <h2 style={{ color: '#fbbf24' }}>Secret Bid Log</h2>
          {liveBids.length > 0 ? liveBids.map((bid, i) => (
            <div key={i} style={{ padding: '15px 0', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><strong>{bid.league_owners?.team_name}</strong>: {bid.bid_amount} Cr</span>
              <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold' }}>SOLD</button>
            </div>
          )) : <p style={{ color: '#666', textAlign: 'center' }}>No bids yet...</p>}
        </div>
      </div>
    </div>
  );
}
