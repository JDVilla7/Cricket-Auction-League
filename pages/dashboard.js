import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [owners, setOwners] = useState([]);
  const [results, setResults] = useState([]);

  const loadData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').order('team_name');
    const { data: r } = await supabase.from('auction_results').select('*, players(name, type, country)').eq('round_type', 'secret');
    setOwners(o || []);
    setResults(r || []);
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel('dashboard').on('postgres_changes', { event: '*', schema: 'public' }, loadData).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 style={{ fontSize: '3rem', color: '#fbbf24', margin: 0 }}>AUCTION WAR ROOM</h1>
        <p style={{ color: '#666' }}>Phase 1 & 2 Secret Bid Standings</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {owners.map(owner => {
          const squad = results.filter(r => r.owner_id === owner.id);
          const totalSpent = squad.reduce((sum, item) => sum + item.winning_bid, 0);

          return (
            <div key={owner.id} style={{ 
              background: '#111', 
              borderRadius: '15px', 
              border: owner.is_locked ? '2px solid #22c55e' : '1px solid #333',
              padding: '20px',
              position: 'relative'
            }}>
              {owner.is_locked && (
                <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#22c55e', color: '#000', padding: '2px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                  LOCKED
                </div>
              )}

              <h2 style={{ margin: '0 0 5px 0', color: '#e11d48' }}>{owner.team_name}</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                <div>
                  <small style={{ color: '#666', display: 'block' }}>SPENT</small>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{totalSpent.toFixed(2)} Cr</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: '#666', display: 'block' }}>REMAINING</small>
                  <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{owner.budget.toFixed(2)} Cr</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: '#fbbf24' }}>SQUAD: {squad.length} / 15</span>
              </div>

              {/* Player List */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {squad.map((item, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 0', 
                    borderBottom: '1px solid #1a1a1a',
                    fontSize: '0.9rem' 
                  }}>
                    <span>{item.players?.name}</span>
                    <span style={{ color: '#666' }}>{item.winning_bid.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      <button 
        onClick={loadData} 
        style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '15px 30px', background: '#fbbf24', color: '#000', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}
      >
        REFRESH DATA
      </button>
    </div>
  );
}
