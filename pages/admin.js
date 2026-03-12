import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('System Ready');

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
    setStatus('Pushing Live...');
    const { error } = await supabase.from('active_auction').upsert({ id: 2, player_id: pid, status: 'bidding' });
    if (!error) { setStatus(`Player ${pid} Live`); alert("Success!"); }
  };

  const handleSold = async (bid) => {
    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;
    if (newBudget < 0) return alert("Insufficient Budget!");

    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: "Round 1" }]);
    await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);
    await supabase.from('bids_draft').delete().eq('id', bid.id);
    
    alert("SOLD!");
    fetchBids();
  };

  // --- NEW: THE RESET TOURNAMENT LOGIC ---
  const resetTournament = async () => {
    const confirm1 = confirm("⚠️ WARNING: This will DELETE all sold player history and RESET all budgets to 150 Cr. Continue?");
    if (!confirm1) return;
    const confirm2 = confirm("FINAL WARNING: Are you 100% sure? This cannot be undone.");
    if (!confirm2) return;

    setStatus('Resetting Tournament...');

    // 1. Clear Auction Results
    await supabase.from('auction_results').delete().neq('id', 0);
    
    // 2. Clear Bids Draft
    await supabase.from('bids_draft').delete().neq('id', 0);

    // 3. Reset all Owner Budgets to 150
    const { error } = await supabase.from('league_owners').update({ budget: 150 }).neq('id', 0);

    if (!error) {
      setStatus('Tournament Reset Complete');
      alert("Tournament has been reset! All teams have 150 Cr.");
      fetchBids();
    } else {
      alert("Reset Error: " + error.message);
    }
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ color: '#e11d48' }}>Admin Control Tower</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>● Status: <span style={{ color: '#22c55e' }}>{status}</span></p>

      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* PUSH PLAYER */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' }}>
          <input type="number" placeholder="Enter Player ID" onChange={(e) => setPid(e.target.value)} style={{ padding: '12px', borderRadius: '6px', width: '50%', marginRight: '10px' }} />
          <button onClick={pushPlayer} style={{ padding: '12px 20px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>PUSH LIVE</button>
        </div>

        {/* BID LOG */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333', marginBottom: '40px' }}>
          <h2 style={{ color: '#fbbf24', fontSize: '1.2rem' }}>Secret Bid Log</h2>
          {liveBids.map((bid) => (
            <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #222' }}>
              <span><strong>{bid.league_owners?.team_name}</strong> for {bid.players?.name}</span>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{bid.bid_amount} Cr</span>
                <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', padding: '8px 15px', borderRadius: '5px' }}>SOLD</button>
              </div>
            </div>
          ))}
        </div>

        {/* DANGER ZONE */}
        <div style={{ borderTop: '1px solid #333', paddingTop: '20px', textAlign: 'center' }}>
          <button onClick={resetTournament} style={{ background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '10px 20px', borderRadius: '5px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>
            RESET TOURNAMENT DATA
          </button>
        </div>
      </div>
    </div>
  );
}
