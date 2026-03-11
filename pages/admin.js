import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);
  const [status, setStatus] = useState('Initializing...');

  const fetchBids = async () => {
    setStatus('Fetching Bids...');
    const { data, error } = await supabase
      .from('bids_draft')
      .select('bid_amount, league_owners(team_name), players(name)')
      .order('created_at', { ascending: false });

    if (data) {
      setLiveBids(data);
      setStatus('Live: Connected');
    }
    if (error) setStatus('Error: ' + error.message);
  };

  useEffect(() => {
    fetchBids();

    // Use a unique channel ID every time the page loads
    const channelId = `admin-room-${Math.random().toString(36).substring(7)}`;
    
    const channel = supabase.channel(channelId)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bids_draft' }, 
        (payload) => {
          console.log('New Bid Change!', payload);
          fetchBids(); // Refresh when ANY change happens
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('Live: Watching for Bids');
      });

    return () => supabase.removeChannel(channel);
  }, []);

  const updateAuction = async () => {
    const { error } = await supabase.from('active_auction').update({ player_id: pid }).eq('id', 2);
    if (!error) alert(`Player ${pid} pushed to Live!`);
  };

  const clearBids = async () => {
    if (!confirm("Clear all bids?")) return;
    const { error } = await supabase.from('bids_draft').delete().neq('id', 0);
    if (!error) { setLiveBids([]); alert("Log Cleared!"); }
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>Auction Control Tower</h1>
        <p style={{ color: status.includes('Live') ? '#22c55e' : '#666', fontWeight: 'bold' }}>● {status}</p>
      </header>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* PLAYER PUSH SECTION */}
        <div style={{ background: '#111', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <input 
            type="number" placeholder="Player ID" 
            onChange={(e) => setPid(e.target.value)}
            style={{ padding: '12px', borderRadius: '5px', background: '#000', color: '#fff', border: '1px solid #444', flex: 1 }}
          />
          <button onClick={updateAuction} style={{ background: '#e11d48', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>PUSH LIVE</button>
        </div>

        {/* BID LOG SECTION */}
        <div style={{ background: '#111', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: '#fbbf24', margin: 0 }}>Secret Bid Log</h2>
            <div>
              <button onClick={fetchBids} style={{ background: '#333', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '5px', marginRight: '10px' }}>REFRESH</button>
              <button onClick={clearBids} style={{ background: 'transparent', color: '#666', border: '1px solid #333', padding: '5px 15px', borderRadius: '5px' }}>CLEAR</button>
            </div>
          </div>

          <div>
            {liveBids.length > 0 ? liveBids.map((bid, i) => (
              <div key={i} style={{ padding: '15px 0', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>{bid.league_owners?.team_name}</strong> for {bid.players?.name}</span>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{bid.bid_amount} Cr</span>
              </div>
            )) : <p style={{ color: '#444', textAlign: 'center' }}>No bids detected yet...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
