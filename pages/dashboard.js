import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [owners, setOwners] = useState([]);
  const [results, setResults] = useState([]);

  const loadData = async () => {
    // 1. Fetch Owners
    const { data: o } = await supabase.from('league_owners').select('*').order('team_name');
    
    // 2. Fetch ALL Results (Simple fetch first to avoid join errors)
    const { data: r, error } = await supabase
      .from('auction_results')
      .select('*, players(name)'); // Try to get the name, but don't crash if it fails

    if (error) console.error("Data Fetch Error:", error);

    setOwners(o || []);
    setResults(r || []);
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel('dashboard').on('postgres_changes', { event: '*', schema: 'public' }, loadData).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // Conflict detector
  const getBidCount = (pId) => results.filter(res => res.player_id === pId).length;

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#fbbf24', margin: 0 }}>AUCTION WAR ROOM</h1>
        <p style={{ color: '#444' }}>Phase 1 & 2 Live Reveal</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {owners.map(owner => {
          // Filter results for this specific owner
          const squad = results.filter(res => String(res.owner_id) === String(owner.id));
          
          // Calculate Spent and Count manually for total accuracy
          const totalSpent = squad.reduce((sum, item) => sum + (parseFloat(item.winning_bid) || 0), 0);
          const squadCount = squad.length;

          return (
            <div key={owner.id} style={{ 
              background: '#0a0a0a', borderRadius: '15px', 
              border: owner.is_locked ? '2px solid #22c55e' : '1px solid #222',
              padding: '20px', position: 'relative'
            }}>
              <h2 style={{ margin: '0 0 10px 0', color: '#e11d48', fontSize: '1.4rem' }}>{owner.team_name}</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                <div>
                  <small style={{ color: '#666', display: 'block', fontSize: '0.7rem' }}>TOTAL SPENT</small>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>{totalSpent.toFixed(2)} Cr</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: '#666', display: 'block', fontSize: '0.7rem' }}>REMAINING</small>
                  <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.2rem' }}>{owner.budget.toFixed(2)} Cr</span>
                </div>
              </div>

              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>SQUAD: {squadCount} Players</span>
                {owner.is_locked && <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 'bold' }}>● LOCKED</span>}
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto', background: '#000', borderRadius: '8px', padding: '10px' }}>
                {squad.length > 0 ? squad.map((item, idx) => {
                  const clashes = getBidCount(item.player_id);
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', justifyContent: 'space-between', padding: '8px 0', 
                      borderBottom: '1px solid #111', fontSize: '0.85rem'
                    }}>
                      <span style={{ color: clashes > 1 ? '#fbbf24' : '#fff' }}>
                        {item.players?.name || `Player ID: ${item.player_id}`} {clashes > 1 && '⚠️'}
                      </span>
                      <span style={{ fontWeight: 'bold', color: clashes > 1 ? '#fbbf24' : '#666' }}>
                        {parseFloat(item.winning_bid).toFixed(2)}
                      </span>
                    </div>
                  );
                }) : (
                  <div style={{ color: '#333', textAlign: 'center', padding: '20px' }}>No Players Found</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <button onClick={loadData} style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '12px 25px', background: '#fbbf24', color: '#000', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer' }}>
        REFRESH DATA
      </button>
    </div>
  );
}
