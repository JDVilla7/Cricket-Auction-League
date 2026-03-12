import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Leaderboard() {
  const [teams, setTeams] = useState([]);
  const [results, setResults] = useState([]);

  const fetchData = async () => {
    // 1. Get all teams and their current budgets
    const { data: teamData } = await supabase.from('league_owners').select('*').order('budget', { ascending: false });
    setTeams(teamData || []);

    // 2. Get the Sold Players list (Linked with player names)
    const { data: resultData } = await supabase
      .from('auction_results')
      .select('*, players(name), league_owners(team_name)')
      .order('created_at', { ascending: false });
    setResults(resultData || []);
  };

  useEffect(() => {
    fetchData();
    // Refresh live whenever a player is sold or budget changes
    const channel = supabase.channel('leaderboard-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_results' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_owners' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#fbbf24', fontSize: '3rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
        Live Auction Leaderboard
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '40px' }}>
        
        {/* LEFT SIDE: BUDGET STANDINGS */}
        <div style={{ background: '#111', padding: '30px', borderRadius: '15px', border: '1px solid #333' }}>
          <h2 style={{ borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>Team Budgets</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#666' }}>
                <th style={{ padding: '10px' }}>TEAM</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>REMAINING BUDGET</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '1.2rem' }}>{team.team_name}</td>
                  <td style={{ padding: '15px', textAlign: 'right', color: '#22c55e', fontWeight: 'bold', fontSize: '1.5rem' }}>
                    {team.budget.toFixed(2)} Cr
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT SIDE: RECENT SIGNINGS */}
        <div style={{ background: '#111', padding: '30px', borderRadius: '15px', border: '1px solid #333' }}>
          <h2 style={{ borderBottom: '2px solid #fbbf24', paddingBottom: '10px' }}>Latest Signings</h2>
          <div style={{ marginTop: '20px', maxHeight: '500px', overflowY: 'auto' }}>
            {results.length > 0 ? results.map((res, i) => (
              <div key={i} style={{ padding: '15px', background: '#1a1a1a', marginBottom: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <strong style={{ color: '#fff' }}>{res.players?.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>Bought by {res.league_owners?.team_name} ({res.phase})</div>
                </span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{res.winning_bid} Cr</span>
              </div>
            )) : <p style={{ color: '#444' }}>No players sold yet...</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
