import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [liveBids, setLiveBids] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch current secret bids from the table
  const fetchBids = async () => {
    const { data, error } = await supabase
      .from('bids_draft')
      .select('bid_amount, league_owners(team_name), players(name)')
      .order('created_at', { ascending: false });

    if (data) setLiveBids(data);
    if (error) console.error("Fetch Error:", error.message);
  };

  // 2. Real-time Listener for incoming bids
  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-bid-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, () => {
        fetchBids(); // Refresh list whenever anyone bids or when you clear them
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // 3. Push a new player to the Live Dashboard
  const updateAuction = async () => {
    if (!pid) return alert("Enter a Player ID first!");
    setLoading(true);
    const { error } = await supabase
      .from('active_auction')
      .update({ player_id: pid })
      .eq('id', 2); // Targets your specific active_auction row

    setLoading(false);
    if (!error) alert(`Player ${pid} is now LIVE on all screens!`);
    else alert("Push Error: " + error.message);
  };

  // 4. Clear the Bid Log (Reset for next player)
  const clearBids = async () => {
    if (!confirm("Are you sure you want to clear all current bids?")) return;
    
    const { error } = await supabase
      .from('bids_draft')
      .delete()
      .neq('id', 0); // This is a trick to delete all rows

    if (!error) {
      alert("Bid log cleared!");
      setLiveBids([]);
    } else {
      alert("Clear Error: " + error.message);
    }
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#e11d48', fontSize: '2.5rem', marginBottom: '10px' }}>Auction Control Tower</h1>
        <p style={{ color: '#666' }}>Manage players and monitor secret bids in real-time</p>
      </header>
      
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* PLAYER CONTROL CARD */}
        <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '15px', border: '1px solid #333', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#fff' }}>Change Live Player</h2>
          <div style={{ display: 'flex', gap: '15px' }}>
            <input 
              type="number" 
              placeholder="Enter Player ID (e.g. 10)" 
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              style={{ padding: '15px', borderRadius: '8px', border: '1px solid #444', background: '#000', color: '#fff', flex: 1, fontSize: '1rem' }}
            />
            <button 
              onClick={updateAuction} 
              disabled={loading}
              style={{ padding: '0 30px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
            >
              {loading ? 'PUSHING...' : 'PUSH TO LIVE'}
            </button>
          </div>
        </div>

        {/* LIVE BIDS LOG CARD */}
        <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '15px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>
            <h2 style={{ color: '#fbbf24', margin: 0 }}>Incoming Secret Bids</h2>
            <button 
              onClick={clearBids}
              style={{ background: 'transparent', color: '#666', border: '1px solid #333', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              CLEAR LOG
            </button>
          </div>

          <div style={{ minHeight: '200px' }}>
            {liveBids.length > 0 ? liveBids.map((bid, index) => (
              <div key={index} style={{ padding: '15px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeIn 0.5s ease' }}>
                <span>
                  <strong style={{ color: '#fff' }}>{bid.league_owners?.team_name || "Unknown"}</strong> 
                  <span style={{ color: '#666' }}> bid for </span>
                  <strong style={{ color: '#fff' }}>{bid.players?.name || "Player"}</strong>
                </span>
                <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.4rem' }}>{bid.bid_amount} Cr</span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', marginTop: '50px', color: '#444' }}>
                <p>Waiting for owners to place bids...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
