import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('Checking Connection...');

  const fetchBids = async () => {
    setStatus('Fetching Bids...');
    // Simple fetch first to ensure we see the numbers
    const { data, error } = await supabase
      .from('bids_draft')
      .select('*, league_owners(team_name, budget), players(name)')
      .order('created_at', { ascending: false });

    if (error) {
      setStatus('Fetch Error: ' + error.message);
    } else {
      setLiveBids(data || []);
      setStatus(data.length > 0 ? `Watching ${data.length} Bids` : 'No Bids in Table');
    }
  };

  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, (payload) => {
        console.log('Change detected:', payload);
        fetchBids();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;
    
    // 1. Move to Results
    const { error: resError } = await supabase.from('auction_results').insert([
      { player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: 'Round 1' }
    ]);

    // 2. Update Budget
    const { error: budError } = await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);

    // 3. Delete from Draft
    await supabase.from('bids_draft').delete().eq('id', bid.id);

    if (!resError && !budError) {
      alert("SOLD!");
      fetchBids();
    } else {
      alert("Error finalizing: " + (resError?.message || budError?.message));
    }
  };

  const pushPlayer = async () => {
    const { error } = await supabase.from('active_auction').update({ player_id: pid }).eq('id', 2);
    if (!error) alert("Player " + pid + " is Live!");
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#ff4d4d' }}>AUCTION COMMAND CENTER</h1>
      <p style={{ color: '#888' }}>Status: <span style={{ color: '#00ff00' }}>{status}</span></p>

      <div style={{ border: '1px solid #333', padding: '20px', marginBottom: '20px' }}>
        <input 
          type="number" placeholder="Enter Player ID" 
          onChange={(e) => setPid(e.target.value)} 
          style={{ padding: '10px', width: '150px', background: '#222', color: '#fff', border: '1px solid #444' }} 
        />
        <button onClick={pushPlayer} style={{ padding: '10px 20px', background: '#ff4d4d', color: '#fff', border: 'none', marginLeft: '10px', cursor: 'pointer' }}>PUSH TO LIVE</button>
      </div>

      <div style={{ border: '1px solid #333', padding: '20px' }}>
        <h2>LIVE BIDS</h2>
        {liveBids.length === 0 && <p>Waiting for incoming data...</p>}
        {liveBids.map((bid) => (
          <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #222', alignItems: 'center', background: '#111', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{bid.league_owners?.team_name || `Owner ${bid.owner_id}`}</div>
              <div style={{ color: '#888' }}>Bidding for: {bid.players?.name || `Player ${bid.player_id}`}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <span style={{ fontSize: '1.5rem', color: '#00ff00' }}>{bid.bid_amount} Cr</span>
              <button onClick={() => handleSold(bid)} style={{ padding: '10px 20px', background: '#00ff00', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>SOLD</button>
            </div>
          </div>
        ))}
      </div>
      
      <button onClick={fetchBids} style={{ marginTop: '20px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer' }}>Manual Refresh</button>
    </div>
  );
}
