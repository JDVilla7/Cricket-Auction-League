import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [playerId, setPlayerId] = useState('');

  const updateAuction = async () => {
    const { error } = await supabase
      .from('active_auction')
      .update({ player_id: playerId })
      .eq('id', 2); // Matches the ID in your Supabase screenshot

    if (!error) alert("Player Updated on All Screens!");
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center', background: '#f4f4f4', height: '100vh' }}>
      <h1>Auction Control Panel</h1>
      <input 
        type="number" placeholder="Enter Player ID" 
        onChange={(e) => setPlayerId(e.target.value)} 
        style={{ padding: '10px', width: '200px' }}
      />
      <button onClick={updateAuction} style={{ padding: '10px 20px', background: 'red', color: 'white', marginLeft: '10px' }}>
        PUSH PLAYER TO LIVE
      </button>
    </div>
  );
}
