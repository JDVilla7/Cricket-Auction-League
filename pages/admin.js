import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');

  const updateAuction = async () => {
    // We use .eq('id', 2) because your table row ID is 2
    const { error } = await supabase
      .from('active_auction')
      .update({ player_id: pid })
      .eq('id', 2); 

    if (!error) {
      alert(`Player ${pid} pushed to Live!`);
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <div style={{ background: '#111', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#e11d48' }}>Auction Control Tower</h1>
      <div style={{ background: '#222', padding: '30px', borderRadius: '10px', border: '1px solid #333' }}>
        <input 
          type="number" 
          placeholder="Enter Player ID (e.g., 10)" 
          onChange={(e) => setPid(e.target.value)}
          style={{ padding: '12px', borderRadius: '5px', border: 'none', width: '200px' }}
        />
        <button 
          onClick={updateAuction}
          style={{ padding: '12px 20px', marginLeft: '10px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          PUSH TO LIVE
        </button>
      </div>
      <p style={{ marginTop: '20px', color: '#666' }}>Targeting active_auction Row ID: 2</p>
    </div>
  );
}
