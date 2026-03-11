import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    const fetchOwnerData = async () => {
      // This fetches the data for the user you created in Supabase
      const { data, error } = await supabase
        .from('league_owners')
        .select('*')
        .single();
      
      if (data) setOwner(data);
    };
    fetchOwnerData();
  }, []);

  if (!owner) return (
    <div style={{ background: '#111', color: '#fff', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <h2>Entering Stadium...</h2>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #e11d48', paddingBottom: '10px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#e11d48' }}>{owner.team_name}</h1>
          <p style={{ margin: 0, color: '#9ca3af' }}>Owner Dashboard</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>Remaining Budget</p>
          <h2 style={{ margin: 0, color: '#22c55e', fontSize: '2rem' }}>{owner.budget} Cr</h2>
        </div>
      </header>

      <div style={{ backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '15px', textAlign: 'center', border: '1px solid #333' }}>
        <h3 style={{ color: '#fff', marginBottom: '10px' }}>Live Auction Window</h3>
        <p style={{ color: '#9ca3af' }}>Waiting for the administrator to start the player bidding session...</p>
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#2d2d2d', borderRadius: '5px', display: 'inline-block' }}>
          <span style={{ color: '#fbbf24' }}>●</span> Connection Status: <span style={{ color: '#22c55e' }}>Connected to Supabase</span>
        </div>
      </div>
    </div>
  );
}
