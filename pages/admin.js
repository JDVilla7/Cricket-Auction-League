import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('System Ready');

  // 1. Fetch current secret bids with linked data
  const fetchBids = async () => {
    const { data } = await supabase
      .from('bids_draft')
      .select('*, league_owners(team_name, budget), players(name)')
      .order('created_at', { ascending: false });
    if (data) setLiveBids(data);
  };

  useEffect(() => {
    fetchBids();
    // Realtime listener for incoming bids
    const channel = supabase.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchBids)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // 2. Push Player (Self-healing upsert)
  const pushPlayer = async () => {
    if (!pid) return alert("Please enter a Player ID first.");
    setStatus('Pushing Live...');

    const { error } = await supabase
      .from('active_auction')
      .upsert({ 
        id: 2, 
        player_id: pid, 
        status: 'bidding' 
      });

    if (!error) {
      setStatus(`Player ${pid} is Live`);
      alert(`Player ${pid} successfully pushed to the stadium!`);
    } else {
      setStatus('Error: ' + error.message);
    }
  };

  // 3. Finalize Sale (Sold Logic)
  const handleSold = async (bid) => {
    const currentBudget = bid.league_owners?.budget || 0;
    const bidAmount = bid.bid_amount || 0;
    const newBudget = currentBudget - bidAmount;

    if (newBudget < 0) return alert("Insufficient Budget for this team!");

    // A. Move to Results
    const { error: resError } = await supabase.from('auction_results').insert([
      { 
        player_id: bid.player_id, 
        owner_id: bid.owner_id, 
        winning_bid: bidAmount, 
        phase: "Round 1" 
      }
    ]);

    // B. Update Owner Budget
    const { error: budError } = await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);

    // C. Remove from Draft Bids
    const { error: delError } = await supabase.from('bids_draft').delete().eq('id', bid.id);

    if (!resError && !budError && !delError) {
      alert(`OFFICIAL: ${bid.players?.name} sold to ${bid.league_owners?.team_name} for ${bidAmount} Cr!`);
      fetchBids();
    } else {
      alert("Error finalizing sale. Check if 'phase' is text and budget is float8.");
    }
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ color: '#e11d48', fontSize: '2.5rem', marginBottom: '10px' }}>Auction Control Tower</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>● Status: <span style={{ color: '#22c55e' }}>{status}</span></p>

      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* PUSH PLAYER BOX */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1rem' }}>Enter Next Player ID</h3>
          <input 
            type="number" 
            placeholder="e.g. 10" 
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid #444', background: '#000', color: '#fff', width: '50%', marginRight: '10px' }}
          />
          <button onClick={pushPlayer} style={{ padding: '12px 20px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>PUSH LIVE</button>
        </div>

        {/* SECRET BID LOG */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: '#fbbf24', margin: 0, fontSize: '1.2rem' }}>Secret Bid Log</h2>
            <button onClick={fetchBids} style={{ background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', padding: '2px 10px' }}>REFRESH</button>
          </div>
          
          {liveBids.length > 0 ? liveBids.map((bid) => (
            <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{bid.league_owners?.team_name || "Team"}</div>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>Bid for {bid.players?.name || "Player"}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.2rem' }}>{bid.bid_amount} Cr</span>
                <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>SOLD</button>
              </div>
            </div>
          )) : (
            <p style={{ textAlign: 'center', color: '#444' }}>No active bids detected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
