import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [teams, setTeams] = useState([]);

  const fetchAll = async () => {
    // Get all owners and their auction results + player names
    const { data } = await supabase
      .from('league_owners')
      .select('*, auction_results(winning_bid, players(name))')
      .order('team_name', { ascending: true });
    setTeams(data || []);
  };

  useEffect(() => {
    fetchAll();
    // Refresh if any bid is sold or result added
    const sub = supabase.channel('dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#fbbf24', fontSize: '3rem', marginBottom: '50px' }}>LIVE STANDINGS</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {teams.map(t => (
          <div key={t.id} style={{ background: '#111', padding: '25px', borderRadius: '15px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>{t.team_name}</h2>
              <h2 style={{ margin: 0, color: '#22c55e' }}>{t.budget.toFixed(2)} Cr</h2>
            </div>
            {t.auction_results?.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: '0.9rem' }}>
                <span style={{ color: '#ccc' }}>{r.players?.name}</span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{r.winning_bid.toFixed(2)} Cr</span>
              </div>
            ))}
            {t.auction_results?.length === 0 && <p style={{color:'#444', textAlign:'center', marginTop:'20px'}}>No players yet.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
