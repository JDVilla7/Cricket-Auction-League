import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [activePlayer, setActivePlayer] = useState(null);
  const [liveBids, setLiveBids] = useState([]);

  const fetchBids = async () => {
    // 1. Fetch High Bids
    const { data: bids } = await supabase
      .from('bids_draft')
      .select('*, league_owners(team_name, budget), players(name)')
      .order('bid_amount', { ascending: false });
    setLiveBids(bids || []);

    // 2. Fetch Active Player Details
    const { data: auction } = await supabase.from('active_auction').select('player_id').eq('id', 2).maybeSingle();
    if (auction?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', auction.player_id).single();
      setActivePlayer(p);
    }
  };

  useEffect(() => {
    fetchBids();
    const channel = supabase.channel('admin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchBids)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_auction' }, fetchBids)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    const newBudget = (bid.league_owners?.budget || 0) - bid.bid_amount;
    await supabase.from('auction_results').insert([{ player_id: bid.player_id, owner_id: bid.owner_id, winning_bid: bid.bid_amount, phase: "Round 1" }]);
    await supabase.from('league_owners').update({ budget: newBudget }).eq('id', bid.owner_id);
    await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
    alert("SOLD!");
  };

  const pushPlayer = async () => {
    await supabase.from('active_auction').upsert({ id: 2, player_id: pid });
    await supabase.from('bids_draft').delete().eq('player_id', pid);
  };

  return (
    <div style={{ background: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #333', paddingBottom: '20px' }}>
        <input type="number" placeholder="ID" onChange={(e) => setPid(e.target.value)} style={{ padding: '10px', width: '60px' }} />
        <button onClick={pushPlayer} style={{ padding: '10px 20px', background: '#e11d48', color: '#fff', border: 'none', marginLeft: '10px' }}>PUSH PLAYER</button>
      </header>

      {activePlayer && (
        <div style={{ marginTop: '30px' }}>
          <h1 style={{ fontSize: '3rem', margin: '0' }}>{activePlayer.name}</h1>
          <p style={{ color: '#fbbf24' }}>Base Price: {(activePlayer.base_price / 10000000).toFixed(2)} Cr</p>
          
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', border: '2px solid #fbbf24', display: 'inline-block', margin: '20px 0' }}>
            <p style={{ margin: 0, color: '#666' }}>CURRENT HIGH BID</p>
            <h2 style={{ fontSize: '3.5rem', margin: 0, color: '#fbbf24' }}>
              {liveBids[0] ? liveBids[0].bid_amount.toFixed(2) : "0.00"} Cr
            </h2>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '20px auto' }}>
        <h3>Active Bidders</h3>
        {liveBids.map((bid) => (
          <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#111', marginBottom: '10px', borderRadius: '8px' }}>
            <span><strong>{bid.league_owners?.team_name}</strong></span>
            <span>{bid.bid_amount} Cr</span>
            <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '5px 15px', fontWeight: 'bold' }}>SOLD</button>
          </div>
        ))}
      </div>
    </div>
  );
}
