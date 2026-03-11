import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);

  // 1. Function to fetch all secret bids
  const fetchBids = async () => {
    const { data } = await supabase
      .from('bids_draft')
      .select('bid_amount, league_owners(team_name), players(name)')
      .order('created_at', { ascending: false });
    setLiveBids(data || []);
  };

  useEffect(() => {
    fetchBids();
    // 2. Listen for new bids in real-time
    const bidChannel = supabase.channel('realtime-bids')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids_draft' }, fetchBids)
      .subscribe();
    return () => supabase.removeChannel(bidChannel);
  }, []);

  const updateAuction = async () => {
    const { error } = await supabase
      .from('active_auction')
      .update({ player_id: pid })
      .eq('id', 2); 
    if (!error) alert(`Player ${pid} is now LIVE!`);
  };

  return (
    <div style={{ background: '#111', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#e11d48', textAlign: 'center' }}>Auction Control Tower</h1>
      
      {/* Control Section */}
      <div style={{ background: '#222', padding: '20px', borderRadius: '10px', marginBottom: '30px', textAlign: 'center' }}>
        <input 
          type="number" placeholder="Enter Player ID" 
          onChange={(e) => setPid(e.target.value)}
          style={{ padding: '12px', borderRadius: '5px', width: '150px' }}
        />
        <button onClick={updateAuction} style={{ padding: '12px 20px', marginLeft: '10px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
          PUSH TO LIVE
        </button>
      </div>

      {/* Live Bids Log */}
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
        <h2 style={{ color: '#fbbf24', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Incoming Secret Bids</h2>
        <div style={{ marginTop: '10px' }}>
          {liveBids.length > 0 ? liveBids.map((bid, index) => (
            <div key={index} style={{ padding: '10px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{bid.league_owners?.team_name}</strong> bid for {bid.players?.name}</span>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{bid.bid_amount} Cr</span>
            </div>
          )) : <p style={{ color: '#666' }}>No bids placed yet...</p>}
        </div>
      </div>
    </div>
  );
}
