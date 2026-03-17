import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [owners, setOwners] = useState([]);
  const [results, setResults] = useState([]);

  const loadData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').order('team_name');
    // Fetching ALL results to ensure nothing is hidden by filters
    const { data: r } = await supabase.from('auction_results').select('*, players(name, type, country)');
    setOwners(o || []);
    setResults(r || []);
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel('dashboard').on('postgres_changes', { event: '*', schema: 'public' }, loadData).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // Helper to find how many times a player was bid on
  const getBidCount = (pId) => results.filter(res => res.player_id === pId).length;

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 style={{ fontSize: '3rem', color: '#fbbf24', margin: 0 }}>AUCTION WAR ROOM</h1>
        <p style={{ color: '#666' }}>Phase 1 & 2 Secret Reveal</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
        {owners.map(owner => {
          const squad = results.filter(r => r.owner_id === owner.id);
          const totalSpent = squad.reduce((sum, item) => sum + item.winning_bid, 0);

          return (
            <div key={owner.id} style={{ 
              background: '#0a0a0a', borderRadius: '20px', 
              border: owner.is_locked ? '2px solid #22c55e' : '1px solid #333',
              padding: '25px', position: 'relative', boxShadow: owner.is_locked ? '0 0 20px rgba(34, 197, 94, 0.1)' : 'none'
            }}>
              <h2 style={{ margin: '0 0 10px 0', color: '#e11d48' }}>{owner.team_name}</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
                <div><small style={{ color: '#666' }}>SPENT</small><h3 style={{ margin: 0 }}>{totalSpent.toFixed(2)} Cr</h3></div>
                <div style={{ textAlign: 'right' }}><small style={{ color: '#666' }}>REMAINING</small><h3 style={{ margin: 0, color: '#22c55e' }}>{owner.budget.toFixed(2)} Cr</h3></div>
              </div>

              <div style={{ marginBottom: '15px', color: '#fbbf24', fontWeight: 'bold' }}>SQUAD: {squad.length} Players</div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                {squad.map((item, idx) => {
                  const clashes = getBidCount(item.player_id);
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', justifyContent: 'space-between', padding: '10px 0', 
                      borderBottom: '1px solid #1a1a1a', fontSize: '0.9rem',
                      color: clashes > 1 ? '#fbbf24' : '#fff' // Highlights clashes in Yellow
                    }}>
                      <span>{item.players?.name} {clashes > 1 && '⚠️'}</span>
                      <span style={{ fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <button onClick={loadData} style={{ position: 'fixed', bottom: '30px', right: '30px', padding: '15px 40px', background: '#fbbf24', color: '#000', border: 'none', borderRadius: '50px', fontWeight: '900', cursor: 'pointer', fontSize: '1rem' }}>REFRESH</button>
    </div>
  );
}
