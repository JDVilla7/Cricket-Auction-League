import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, lastWinner: null });

  const syncAdmin = async () => {
    // 1. Check Active Auction
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    if (active?.player_id) {
      // 2. Check if this player is ALREADY in results (Sold)
      const { data: soldCheck } = await supabase.from('auction_results')
        .select('*, league_owners(team_name)')
        .eq('player_id', active.player_id).maybeSingle();

      if (soldCheck) {
        setData(prev => ({ ...prev, isSold: true, lastWinner: soldCheck }));
      } else {
        const { data: player } = await supabase.from('players').select('*').eq('id', active.player_id).single();
        const { data: bids } = await supabase.from('bids_draft')
          .select('*, league_owners(team_name, budget)')
          .eq('player_id', active.player_id)
          .order('bid_amount', { ascending: false });
        
        setData({ player, bids: bids || [], isSold: false, lastWinner: null });
      }
    }
  };

  useEffect(() => {
    syncAdmin();
    const channel = supabase.channel('admin_live_v2').on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleSold = async (bid) => {
    if (!confirm(`Finalize Sale: ${data.player.name} to ${bid.league_owners.team_name}?`)) return;
    
    // A. Add to Results
    const { error } = await supabase.from('auction_results').insert([{ 
        player_id: bid.player_id, 
        owner_id: bid.owner_id, 
        winning_bid: bid.bid_amount, 
        phase: "Main" 
    }]);

    if (!error) {
       // B. Update Budget & Delete Bids
       await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
       await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
       // C. Local state will auto-update via Realtime listener
    }
  };

  const pushPlayer = async () => {
    if (!pid) return alert("Enter Player ID");
    // Clear all pending bids before starting a new player
    await supabase.from('bids_draft').delete().neq('id', 0); 
    await supabase.from('active_auction').upsert({ id: 2, player_id: pid });
    setPid(''); // Clear input box
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      
      {/* PUSH CONTROL */}
      <div style={{ padding: '20px', borderBottom: '1px solid #222', background: '#0a0a0a', borderRadius: '15px' }}>
        <h3 style={{color: '#666', margin: '0 0 10px 0', fontSize: '0.8rem'}}>AUCTIONEER CONSOLE</h3>
        <input 
          value={pid} 
          onChange={(e) => setPid(e.target.value)} 
          placeholder="ENTER PLAYER ID" 
          style={{ padding: '15px', width: '120px', background: '#111', color: '#fff', border: '1px solid #e11d48', borderRadius: '8px', fontSize: '1.2rem', textAlign: 'center' }} 
        />
        <button onClick={pushPlayer} style={{ padding: '15px 30px', background: '#e11d48', color: '#fff', border: 'none', marginLeft: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>PUSH LIVE</button>
      </div>

      {/* DYNAMIC STAGE */}
      <div style={{ marginTop: '40px' }}>
        {data.isSold ? (
          <div style={{ padding: '50px', background: '#111', borderRadius: '30px', border: '2px dashed #444', maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '4rem', color: '#22c55e', margin: 0 }}>PLAYER SOLD</h1>
            <h2 style={{ color: '#fff', margin: '10px 0' }}>{data.lastWinner?.league_owners?.team_name} WON</h2>
            <p style={{ color: '#666', fontSize: '1.2rem' }}>Please enter next Player ID above to continue.</p>
          </div>
        ) : data.player ? (
          <>
            <h1 style={{ fontSize: '4rem', margin: 0, textTransform: 'uppercase' }}>{data.player.name}</h1>
            <p style={{ color: '#fbbf24', fontSize: '1.5rem' }}>BASE: {(data.player.base_price / 10000000).toFixed(2)} Cr</p>

            <div style={{ background: '#111', padding: '40px', borderRadius: '30px', border: '3px solid #fbbf24', display: 'inline-block', margin: '30px 0', minWidth: '350px' }}>
              <p style={{ margin: 0, color: '#666', fontWeight: 'bold' }}>CURRENT HIGH BID</p>
              <h2 style={{ fontSize: '6rem', margin: 0, color: '#fbbf24', lineHeight: '1' }}>
                {data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : "0.00"}
              </h2>
              {data.bids[0] && <h2 style={{ color: '#22c55e', margin: '10px 0 0 0' }}>{data.bids[0].league_owners.team_name}</h2>}
            </div>

            <div style={{ maxWidth: '600px', margin: '20px auto' }}>
              <h3 style={{ color: '#444', letterSpacing: '2px' }}>INCOMING BIDS</h3>
              {data.bids.map((bid) => (
                <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#111', marginBottom: '10px', borderRadius: '15px', border: '1px solid #222' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{bid.league_owners.team_name}</span>
                  <span style={{ fontSize: '1.5rem', color: '#22c55e', fontWeight: 'bold' }}>{bid.bid_amount.toFixed(2)} Cr</span>
                  <button onClick={() => handleSold(bid)} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '10px 25px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>SOLD</button>
                </div>
              ))}
              {data.bids.length === 0 && <p style={{color: '#333', marginTop: '20px'}}>Waiting for first bid...</p>}
            </div>
          </>
        ) : (
          <h1 style={{ color: '#222', marginTop: '100px' }}>STADIUM IS EMPTY</h1>
        )}
      </div>
    </div>
  );
}
