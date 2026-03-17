import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winner: null });

  const syncAdmin = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!active?.player_id) return setData({ player: null, bids: [], isSold: false, winner: null });

    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name, budget)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
    const { data: res } = await supabase.from('auction_results').select('*, league_owners(team_name)').eq('player_id', active.player_id).maybeSingle();

    setData({ player: p, bids: bids || [], isSold: active.is_sold, winner: res });
  };

  useEffect(() => {
    syncAdmin();
    const sub = supabase.channel('admin_master').on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // // --- AGGRESSIVE RESET LOGIC ---
  // const resetTournament = async () => {
  //   if(!confirm("WARNING: This will delete ALL players from ALL squads and reset budgets to 150 Cr. Proceed?")) return;
    
  //   // 1. Force delete all results (using .gte('id', 0) to ensure every row is hit)
  //   const { error: err1 } = await supabase.from('auction_results').delete().gte('id', 0);
  //   const { error: err2 } = await supabase.from('bids_draft').delete().gte('id', 0);
    
  //   // 2. Reset budgets
  //   const { error: err3 } = await supabase.from('league_owners').update({ budget: 150 }).gte('id', 0);
    
  //   // 3. Clear the active auction control row
  //   const { error: err4 } = await supabase.from('active_auction').update({ 
  //     player_id: null, is_sold: false, winner_name: '', winning_amount: 0 
  //   }).eq('id', 2);

  //   if (err1 || err2 || err3 || err4) {
  //     console.error("Reset Errors:", { err1, err2, err3, err4 });
  //     alert("Partial Reset Failed. Please run the SQL manual wipe or check Supabase Permissions.");
  //   } else {
  //     alert("TOURNAMENT WIPED. All squads are now empty.");
  //     syncAdmin(); // Refresh local admin view
  //   }
  // };

  const resetTournament = async () => {
  if (!confirm("This will permanently WIPE all squads and reset budgets. Proceed?")) return;

  try {
    // 1. Wipe auction_results using owner_id (since they are all '3')
    // We use .neq('owner_id', '0') because every owner_id is a real string.
    const { error: err1 } = await supabase
      .from('auction_results')
      .delete()
      .neq('owner_id', '0'); 

    // 2. Wipe bids_draft using player_id
    const { error: err2 } = await supabase
      .from('bids_draft')
      .delete()
      .neq('player_id', 0);

    // 3. Reset budgets to 150
    const { error: err3 } = await supabase
      .from('league_owners')
      .update({ budget: 150 })
      .neq('team_name', ''); // Hits every team with a name

    // 4. Clear the active auction row
    const { error: err4 } = await supabase
      .from('active_auction')
      .update({ 
        player_id: null, 
        is_sold: false, 
        winner_name: '', 
        winning_amount: 0 
      })
      .eq('id', 2);

    if (err1 || err2 || err3 || err4) {
      console.error("Reset Failures:", { err1, err2, err3, err4 });
      alert("Reset failed. Check the console for specific table errors.");
    } else {
      alert("TOURNAMENT WIPED: All squads are now empty.");
      if (typeof sync === 'function') sync();
    }
  } catch (e) {
    alert("Critical Error: " + e.message);
  }
};
  const createOwner = async () => {
    if(!ownerName) return;
    const { data, error } = await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]).select();
    if(!error) alert(`Owner Created! Team: ${data[0].team_name}`);
    setOwnerName('');
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    await supabase.from('bids_draft').delete().gte('id', 0);
    setPid('');
  };

  const handleSold = async (bid) => {
    if(!confirm(`Sell ${data.player.name} to ${bid.league_owners.team_name}?`)) return;
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount }]);
    await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
    await supabase.from('active_auction').update({ is_sold: true, winner_name: bid.league_owners.team_name, winning_amount: bid.bid_amount }).eq('id', 2);
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '30px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{color: '#e11d48'}}>AUCTION CONTROL TOWER</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1000px', margin: '0 auto 40px auto' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
          <h3>TOURNAMENT SETUP</h3>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="New Team Name" style={{ padding: '10px', borderRadius: '5px' }} />
          <button onClick={createOwner} style={{ padding: '10px 20px', background: '#22c55e', border: 'none', marginLeft: '5px', fontWeight: 'bold', borderRadius: '5px' }}>ADD TEAM</button>
          <hr style={{margin: '20px 0', borderColor: '#222'}} />
          <button onClick={resetTournament} style={{ width: '100%', padding: '15px', background: '#e11d48', color: '#fff', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>RESET ENTIRE TOURNAMENT</button>
        </div>

        <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
          <h3>LIVE PUSH</h3>
          <input value={pid} onChange={e => setPid(e.target.value)} placeholder="PID" style={{ padding: '15px', width: '80px', textAlign: 'center', borderRadius: '5px' }} />
          <button onClick={pushPlayer} style={{ padding: '15px 30px', background: '#fbbf24', border: 'none', marginLeft: '10px', fontWeight: 'bold', borderRadius: '5px' }}>PUSH PLAYER</button>
        </div>
      </div>

      {data.isSold ? (
        <div style={{ padding: '60px', background: '#0a0a0a', border: '2px dashed #22c55e', borderRadius: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#22c55e', fontSize: '4rem', margin: 0 }}>SOLD!</h1>
          <h2>{data.winner?.league_owners?.team_name}</h2>
          <p style={{ color: '#666' }}>Push next player to clear.</p>
        </div>
      ) : data.player ? (
        <div style={{ background: '#111', padding: '40px', borderRadius: '30px', border: '1px solid #444', maxWidth: '800px', margin: '0 auto' }}>
          <h1>{data.player.name}</h1>
          <h2 style={{ fontSize: '5rem', color: '#fbbf24' }}>{data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : (data.player.base_price/10000000).toFixed(2)} Cr</h2>
          <div style={{ textAlign: 'left', marginTop: '40px' }}>
            {data.bids.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: '#000', marginBottom: '10px', borderRadius: '15px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{b.league_owners.team_name}</span>
                <button onClick={() => handleSold(b)} style={{ background: '#22c55e', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 'bold' }}>SOLD AT {b.bid_amount.toFixed(2)}</button>
              </div>
            ))}
          </div>
        </div>
      ) : <h1 style={{ color: '#222', marginTop: '100px' }}>READY...</h1>}
    </div>
  );
}
