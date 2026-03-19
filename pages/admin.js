import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Admin() {
  const [pid, setPid] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winner: null });
  const [loading, setLoading] = useState(false);

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

  // --- RESOLVE PHASE 1 & 2 (Clashes go to Re-Auction) ---
  const resolveSecretBids = async () => {
    if (!confirm("RESOLVE PHASE: Clashed players (multiple bids) will be sent to RE-AUCTION. Proceed?")) return;
    setLoading(true);
    try {
      const { data: allBids } = await supabase.from('auction_results').select('*');
      const bidCounts = {};
      allBids.forEach(bid => { bidCounts[bid.player_id] = (bidCounts[bid.player_id] || 0) + 1; });
      const clashedIds = Object.keys(bidCounts).filter(id => bidCounts[id] > 1);

      for (const pId of clashedIds) {
        const toRefund = allBids.filter(b => String(b.player_id) === String(pId));
        for (const bid of toRefund) {
          const { data: owner } = await supabase.from('league_owners').select('budget').eq('id', bid.owner_id).single();
          await supabase.from('league_owners').update({ budget: owner.budget + bid.winning_bid }).eq('id', bid.owner_id);
          await supabase.from('auction_results').delete().eq('player_id', pId).eq('owner_id', bid.owner_id);
        }
      }
      await supabase.from('league_owners').update({ is_locked: false }).neq('id', 0);
      alert("PHASE RESOLVED: Clashed players cleared for Re-Auction!");
      syncAdmin();
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  // --- RESET ENTIRE TOURNAMENT ---
  const resetTournament = async () => {
    if (!confirm("PERMANENT WIPE: This will reset EVERYTHING. Proceed?")) return;
    setLoading(true);
    await supabase.from('auction_results').delete().neq('owner_id', '0'); 
    await supabase.from('bids_draft').delete().neq('player_id', 0);
    await supabase.from('league_owners').update({ budget: 150, is_locked: false }).neq('team_name', ''); 
    await supabase.from('active_auction').update({ player_id: null, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    alert("TOURNAMENT WIPED.");
    setLoading(false);
    syncAdmin();
  };

  // --- RE-SYNC BUDGET AUDIT ---
  const recalculateBudgets = async () => {
    setLoading(true);
    const { data: owners } = await supabase.from('league_owners').select('*');
    const { data: results } = await supabase.from('auction_results').select('*');
    for (const owner of owners) {
      const spent = results.filter(r => String(r.owner_id) === String(owner.id)).reduce((sum, p) => sum + p.winning_bid, 0);
      await supabase.from('league_owners').update({ budget: 150 - spent }).eq('id', owner.id);
    }
    alert("Budgets Re-synced!");
    setLoading(false);
  };

  const createOwner = async () => {
    if(!ownerName) return;
    await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]);
    alert("Team Added!");
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
    <div style={{ background: '#050505', backgroundImage: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 100%)', color: '#fff', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#e11d48', fontSize: '2.5rem', textShadow: '0 0 20px rgba(225, 29, 72, 0.4)' }}>CONTROL TOWER</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto 40px auto' }}>
        
        {/* SETUP BOX */}
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#fbbf24' }}>TOURNAMENT MGMT</h3>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="New Team Name" style={{ padding: '12px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px', width: '60%' }} />
          <button onClick={createOwner} style={{ padding: '12px', background: '#22c55e', border: 'none', marginLeft: '5px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>ADD</button>
          
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={resolveSecretBids} disabled={loading} style={{ padding: '15px', background: '#22c55e', color: '#000', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>✅ RESOLVE SECRET PHASE</button>
            <button onClick={recalculateBudgets} style={{ padding: '10px', background: '#3b82f6', color: '#fff', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>🔄 RE-SYNC BUDGETS</button>
            <button onClick={resetTournament} style={{ padding: '15px', background: '#e11d48', color: '#fff', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>⚠️ RESET TOURNAMENT</button>
          </div>
        </div>

        {/* LIVE PUSH BOX */}
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0, color: '#fbbf24' }}>PHASE 3 PUSH</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '30px' }}>
            <input value={pid} onChange={e => setPid(e.target.value)} placeholder="PID" style={{ padding: '15px', width: '80px', textAlign: 'center', background: '#000', border: '1px solid #444', color: '#fff', borderRadius: '12px', fontSize: '1.2rem' }} />
            <button onClick={pushPlayer} style={{ padding: '15px 30px', background: '#fbbf24', color: '#000', border: 'none', fontWeight: '900', borderRadius: '12px', cursor: 'pointer' }}>PUSH PLAYER</button>
          </div>
          <p style={{ color: '#444', marginTop: '15px', fontSize: '0.8rem' }}>Enter Player ID and hit Push to start Live Bidding</p>
        </div>
      </div>

      {/* LIVE STAGE VIEW */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {data.isSold ? (
          <div style={{ padding: '60px', background: 'rgba(34, 197, 94, 0.05)', border: '2px dashed #22c55e', borderRadius: '30px', textAlign: 'center' }}>
            <h1 style={{ color: '#22c55e', fontSize: '4rem', margin: 0 }}>SOLD!</h1>
            <h2 style={{ fontSize: '2rem' }}>{data.winner_name}</h2>
            <div style={{ color: '#fbbf24', fontSize: '1.5rem', fontWeight: 'bold' }}>{data.winning_amount} Cr</div>
          </div>
        ) : data.player ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', padding: '40px', borderRadius: '40px', border: '1px solid #444', textAlign: 'center' }}>
            <img 
              src={`/players/${data.player.name.toLowerCase().replace(/ /g, '_')}.jpg`} 
              style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #fbbf24', marginBottom: '20px' }}
              onError={(e) => { e.target.src = '/players/place_holder.jpg'; }}
            />
            <h1 style={{ fontSize: '3rem', margin: 0 }}>{data.player.name}</h1>
            <div style={{ fontSize: '5rem', color: '#fbbf24', fontWeight: '900' }}>
              {data.bids[0] ? data.bids[0].bid_amount.toFixed(2) : (data.player.base_price/10000000).toFixed(2)} <span style={{fontSize:'1.5rem'}}>Cr</span>
            </div>

            <div style={{ marginTop: '40px', textAlign: 'left' }}>
              <h4 style={{ color: '#666', borderBottom: '1px solid #222', paddingBottom: '10px' }}>ACTIVE BIDS</h4>
              {data.bids.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', background: '#000', marginBottom: '10px', borderRadius: '15px', alignItems: 'center', border: '1px solid #222' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{b.league_owners.team_name}</span>
                  <button onClick={() => handleSold(b)} style={{ background: '#22c55e', color: '#000', border: 'none', padding: '12px 30px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>SELL AT {b.bid_amount.toFixed(2)}</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ color: '#222', marginTop: '100px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '4rem' }}>READY...</h1>
          </div>
        )}
      </div>
    </div>
  );
}
