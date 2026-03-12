import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('Initializing...');

  const fetchBids = async () => {
    setStatus('Updating Bids...');
    const { data, error } = await supabase
      .from('bids_draft')
      .select('*, league_owners(team_name, budget), players(name)')
      .order('created_at', { ascending: false });

    if (error) {
      setStatus('Error: ' + error.message);
    } else {
      setLiveBids(data || []);
      setStatus(data && data.length > 0 ? `Watching ${data.length} Live Bids` : 'Live: Waiting for Bids');
    }
  };

  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchBids)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;

    // 1. Record Result (Phase set to 1 if you keep it as number, or "Round 1" if you changed it to text)
    const { error: resError } = await supabase.from('auction_results').insert([
      { 
        player_id: bid.player_id, 
        owner_id: bid.owner_id, 
        winning_bid: bid.bid_amount, 
        phase: "1" // Change this to "Round 1" ONLY AFTER you change the column type to 'text' in Supabase
      }
    ]);

    // 2. Update Budget
    const { error: budError } = await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);

    // 3. Clear the bid
    await supabase.from('bids_draft').delete().eq('id', bid.id);

    if (!resError && !budError) {
      alert(`SOLD! ${bid.players?.name} to ${bid.league_owners?.team_name}`);
      fetchBids();
    } else {
      alert("Error: Check if 'phase' column is set to text in Supabase.");
    }
  };

  const pushPlayer = async () => {
    const { error } = await supabase.from('active_auction').update({ player_id: pid }).eq('id', 2);
    if (!error) alert("Player " + pid + " pushed!");
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ color: '#e11d48', marginBottom: '10px' }}>Auction Control Tower</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>● {status}</p>

      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* CENTERED CONTROL BOX */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }}>
          <input 
            type="number" placeholder="Enter Player ID" 
            onChange={(e) => setPid(e.target.value)}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid #444', background: '#000', color: '#fff', width: '60%', marginRight: '10px' }}
          />
          <button onClick={pushPlayer} style={{ padding: '12px 20px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>PUSH LIVE</button>
        </div>

        {/* CENTERED BID LOG */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#fbbf24', margin: 0 }}>Secret Bid Log</h2>
            <button onClick={fetchBids} style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>REFRESH</button>
          </div>

          {liveBids.length > 0 ? liveBids.map((bid) => (
            <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{bid.league_owners?.team_name || 'Loading...'}</div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>{bid.players?.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.2rem' }}>{bid.bid_amount} Cr</span>
                <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>SOLD</button>
              </div>
            </div>
          )) : (
            <p style={{ textAlign: 'center', color: '#444', marginTop: '20px' }}>No active bids found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
