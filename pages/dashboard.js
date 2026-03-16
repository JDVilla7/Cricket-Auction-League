import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [teams, setTeams] = useState([]);

  const fetchAll = async () => {
    const { data } = await supabase.from('league_owners').select('*, auction_results(winning_bid, players(name))');
    setTeams(data || []);
  };

  useEffect(() => {
    fetchAll();
    supabase.channel('dash').on('postgres_changes', { event: '*', schema: 'public' }, fetchAll).subscribe();
  }, []);

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#fbbf24', fontSize: '3rem' }}>STANDINGS</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '40px' }}>
        {teams.map(t => (
          <div key={t.id} style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #444', marginBottom: '10px' }}>
              <h2 style={{ color: '#e11d48', margin: 0 }}>{t.team_name}</h2>
              <h2 style={{ color: '#22c55e', margin: 0 }}>{t.budget.toFixed(2)} Cr</h2>
            </div>
            {t.auction_results.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span>{r.players?.name}</span>
                <span style={{ color: '#fbbf24' }}>{r.winning_bid.toFixed(2)} Cr</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
