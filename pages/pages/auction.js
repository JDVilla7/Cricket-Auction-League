import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    const fetchOwnerData = async () => {
      // For testing, we fetch the first owner. 
      // Later we will make this show the logged-in owner.
      const { data } = await supabase.from('league_owners').select('*').single();
      setOwner(data);
    };
    fetchOwnerData();
  }, []);

  if (!owner) return <div style={{background:'#111', color:'#fff', height:'100vh', padding:'20px'}}>Loading Stadium...</div>;

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #e11d48', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{owner.team_name} Dashboard</h1>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, color: '#9ca3af' }}>Available Budget</p>
          <h2 style={{ margin: 0, color: '#22c55e' }}>{owner.budget} Cr</h2>
        </div>
      </header>

      <section style={{ backgroundColor: '#222', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
        <h2 style={{ color: '#e11d48' }}>Live Auction - Coming Soon</h2>
        <p>Your connection to Supabase is LIVE. We will list the players here next.</p>
      </section>
    </div>
  );
}
