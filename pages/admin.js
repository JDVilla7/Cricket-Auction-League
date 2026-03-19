import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

// --- CONFIGURATION ---
const TOURNAMENT_NAME = "MY LEAGUE 2026"; // Change your tournament name here

export default function Admin() {
  const [pid, setPid] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false });
  const [loading, setLoading] = useState(false);

  // --- SYNC LOGIC ---
  const syncAdmin = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (!active?.player_id) return setData({ player: null, bids: [], isSold: false });

    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    const { data: bids } = await supabase.from('bids_draft')
      .select('*, league_owners(team_name, budget, id)')
      .eq('player_id', active.player_id)
      .order('bid_amount', { ascending: false });

    setData({ player: p, bids: bids || [], isSold: active.is_sold });
  };

  useEffect(() => {
    syncAdmin();
    const sub = supabase.channel('admin_master')
      .on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // --- 1. RESOLVE SECRET PHASE (Clash to Re-Auction) ---
  const resolveSecretBids = async () => {
    if (!confirm("RESOLVE PHASE: Multiple bids on the same player will be refunded and cleared for re-auction. Proceed?")) return;
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
      // Unlock all owners for Phase 3
      await supabase.from('league_owners').update({ is_locked: false }).neq('id', 0);
      alert("PHASE RESOLVED: Clashes cleared!");
      syncAdmin();
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  // --- 2. RE-SYNC BUDGET AUDIT ---
  const recalculateBudgets = async () => {
    setLoading(true);
    const { data: owners } = await supabase.from('league_owners').select('*');
    const { data: results } = await supabase.from('auction_results').select('*');
    for (const owner of owners) {
      const spent = results.filter(r => String(r.owner_id) === String(owner.id)).reduce((sum, p) => sum + p.winning_bid, 0);
      await supabase.from('league_owners').update({ budget: 150 - spent }).eq('id', owner.id);
    }
    alert("Budgets Audit Complete!");
    setLoading(false);
  };

  // --- 3. RESET ENTIRE TOURNAMENT ---
  const resetTournament = async () => {
    if (!confirm("PERMANENT WIPE: This resets all results, bids, and budgets. Proceed?")) return;
    setLoading(true);
    await supabase.from('auction_results').delete().neq('owner_id', '0'); 
    await supabase.from('bids_draft').delete().neq('player_id', 0);
    await supabase.from('league_owners').update({ budget: 150, is_locked: false }).neq('team_name', ''); 
    await supabase.from('active_auction').update({ player_id: null, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    alert("TOURNAMENT WIPED.");
    setLoading(false);
    syncAdmin();
  };

  const createOwner = async () => {
    if(!ownerName) return;
    await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]);
    setOwnerName('');
    alert("Team Created Successfully!");
  };

  const pushPlayer = async () => {
    if (!pid) return;
    await supabase.from('active_auction').update({ player_id: pid, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('player_id', 0);
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
    <div style={{ 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.9), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover', backgroundAttachment: 'fixed', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: '"Orbitron", sans-serif' 
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');`}</style>
      
      <h1 style={{ textAlign: 'center', color: '#e11d48', fontSize: '2.5rem', marginBottom: '40px', textShadow: '0 0 20px rgba(225,29,72,0.4)', fontWeight: '900' }}>
        COMMAND CENTER
      </h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto 50px auto' }}>
        
        {/* TOURNAMENT MGMT */}
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(15px)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(251,191,36,0.3)' }}>
          <h3 style={{ color: '#fbbf24', marginTop: 0, textTransform: 'uppercase', fontSize: '0.9rem' }}>Tournament Operations</h3>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
             <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="New Team Name" style={{ flex: 1, padding: '12px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }} />
             <button onClick={createOwner} style={{ padding: '12px 20px', background: '#22c55e', border: 'none', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>ADD</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={resolveSecretBids} disabled={loading} style={{ padding: '15px', background: '#fbbf24', color: '#000', fontWeight: '900', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>✅ RESOLVE SECRET PHASE</button>
            <button onClick={recalculateBudgets} style={{ padding: '12px', background: '#3b82f6', color: '#fff', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>🔄 RE-SYNC ALL BUDGETS</button>
            <button onClick={resetTournament} style={{ padding: '12px', background: '#e11d48', color: '#fff', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>⚠️ RESET TOURNAMENT</button>
          </div>
        </div>

        {/* LIVE PUSH BOX */}
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(15px)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(251,191,36,0.4)', textAlign: 'center' }}>
          <h3 style={{ color: '#fbbf24', marginTop: 0, textTransform: 'uppercase', fontSize: '0.9rem' }}>Live Stage Control</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '30px' }}>
            <input value={pid} onChange={e => setPid(e.target.value)} placeholder="PID" style={{ padding: '15px', width: '100px', background: '#000', border: '2px solid #fbbf24', color: '#fff', borderRadius: '12px', fontSize: '1.8rem', textAlign: 'center', fontWeight: '900' }} />
            <button onClick={pushPlayer} style={{ padding: '15px 30px', background: '#fbbf24', color: '#000', border: 'none', fontWeight: '900', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 0 20px rgba(251,191,36,0.3)' }}>PUSH PLAYER</button>
          </div>
          <p style={{color: '#444', fontSize: '0.7rem', marginTop: '15px'}}>Enter Player ID to trigger the Stadium entrance</p>
        </div>
      </div>

      {/* LIVE PREVIEW (MATCHES OWNER UI) */}
      <div style={{ maxWidth: '450px', margin: '0 auto' }}>
        {data.player && !data.isSold ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            style={{ background: 'rgba(15,15,15,0.95)', border: '2px solid #fbbf24', borderRadius: '30px', padding: '30px', textAlign: 'center', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}
          >
            <span style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: '900', border: '1px solid #fbbf24', padding: '4px 12px', borderRadius: '5px', textTransform: 'uppercase' }}>{TOURNAMENT_NAME}</span>
            <img 
              src={`/players/${data.player.name.toLowerCase().replace(/ /g, '_')}.jpg`} 
              style={{ width: '100%', height: '320px', objectFit: 'cover', borderRadius: '15px', margin: '20px 0', border: '1px solid #333' }}
              onError={(e) => e.target.src = '/players/place_holder.jpg'}
            />
            <h1 style={{ fontSize: '2.2rem', margin: 0, textTransform: 'uppercase', fontWeight: '900' }}>{data.player.name}</h1>
            <div style={{ fontSize: '4.5rem', color: '#fbbf24', fontWeight: '900', margin: '10px 0' }}>
              {data.bids[0]?.bid_amount.toFixed(2) || (data.player.base_price/10000000).toFixed(2)} 
              <small style={{fontSize: '1rem', color: '#666'}}> Cr</small>
            </div>

            <div style={{ textAlign: 'left', marginTop: '30px' }}>
              <h4 style={{color: '#444', fontSize: '0.7rem', marginBottom: '10px', borderBottom: '1px solid #222'}}>ACTIVE BIDS</h4>
              {data.bids.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#000', marginBottom: '10px', borderRadius: '12px', border: '1px solid #222', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>{b.league_owners.team_name}</span>
                  <button onClick={() => handleSold(b)} style={{ background: '#22c55e', border: 'none', padding: '10px 25px', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>SOLD</button>
                </div>
              ))}
            </div>
          </motion.div>
        ) : <h1 style={{ textAlign: 'center', color: 'rgba(255,255,255,0.05)', marginTop: '50px', fontSize: '4rem', letterSpacing: '10px' }}>STATIONARY</h1>}
      </div>
    </div>
  );
}
