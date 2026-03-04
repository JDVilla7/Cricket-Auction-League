import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('league_owners')
      .select('*')
      .eq('gmail', gmail)
      .eq('password', password)
      .single();

    if (data) {
      alert('Welcome, ' + data.team_name + '! Redirecting...');
      window.location.href = '/auction';
    } else {
      alert('Invalid login. Check your credentials.');
    }
  };

  return (
    <div style={{ backgroundColor: '#111', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <h1>Owner Entrance</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
        <input type="email" placeholder="Gmail" required onChange={(e) => setGmail(e.target.value)} style={{ padding: '10px' }} />
        <input type="password" placeholder="Password" required onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px' }} />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#e11d48', color: 'white', border: 'none', fontWeight: 'bold' }}>Enter Auction</button>
      </form>
    </div>
  );
}
