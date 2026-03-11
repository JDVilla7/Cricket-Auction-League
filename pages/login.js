import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    // This checks your "league_owners" table in Supabase
    const { data, error } = await supabase
      .from('league_owners')
      .select('*')
      .eq('gmail', gmail)
      .eq('password', password)
      .single();

    if (data) {
      alert('Welcome, ' + data.team_name + '! Access Granted.');
      // We will build the /auction dashboard next
      window.location.href = '/auction';
    } else {
      alert('Login failed. Please check your Gmail and Password.');
    }
  };

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1 style={{ color: '#e11d48', marginBottom: '20px' }}>Owner Entrance</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '300px' }}>
        <input 
          type="email" placeholder="Gmail Address" required 
          style={{ padding: '12px', borderRadius: '5px', border: '1px solid #333', backgroundColor: '#222', color: 'white' }} 
          onChange={(e) => setGmail(e.target.value)} 
        />
        <input 
          type="password" placeholder="Password" required 
          style={{ padding: '12px', borderRadius: '5px', border: '1px solid #333', backgroundColor: '#222', color: 'white' }} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        <button type="submit" style={{ padding: '12px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
          Login to Auction
        </button>
      </form>
    </div>
  );
}
