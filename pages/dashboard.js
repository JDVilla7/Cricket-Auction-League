import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const TOURNAMENT_NAME = "MY LEAGUE 2026"; 

export default function Admin() {
  // --- STATE MANAGEMENT ---
  const [pid, setPid] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [data, setData] = useState({ player: null, bids: [], isSold: false, winner_name: '', winning_amount: 0 });
  const [loading, setLoading] = useState(false);
  const [owners, setOwners] = useState([]);

  // --- CORE SYNC LOGIC ---
  const syncAdmin = async () => {
    // 1. Fetch Active Auction State
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    // 2. Fetch Owners for Management List
    const { data: oList } = await supabase.from('league_owners').select('*').order('team_name');
    setOwners(oList || []);

    if (!active?.player_id) {
      return setData({ player: null, bids: [], isSold: active?.is_sold || false, winner_name: active?.winner_name, winning_amount: active?.winning_amount });
    }

    // 3. Fetch Current Player Details
    const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
    
    // 4. Fetch Real-time Bids (Phase 3)
    const { data: bids } = await supabase.from('bids_draft')
      .select('*, league_owners(team_name, budget, id)')
      .eq('player_id', active.player_id)
      .order('bid_amount', { ascending: false });

    setData({ 
      player: p, 
      bids: bids || [], 
      isSold: active.is_sold, 
      winner_name: active.winner_name, 
      winning_amount: active.winning_amount 
    });
  };

  useEffect(() => {
    syncAdmin();
    const sub = supabase.channel('admin_master').on('postgres_changes', { event: '*', schema: 'public' }, syncAdmin).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // --- TOURNAMENT MANAGEMENT FUNCTIONS ---

  // 1. RESOLVE SECRET PHASE (Clashes -> Re-Auction)
  const resolveSecretBids = async () => {
    if (!confirm("RESOLVE PHASE: Multiple bids on one player will be refunded and cleared for re-auction. Proceed?")) return;
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
      alert("SECRET PHASE RESOLVED: Clashes cleared for Re-Auction!");
      syncAdmin();
    } catch (e) { alert("Error: " + e.message); }
    setLoading(false);
  };

  // 2. RE-SYNC BUDGET AUDIT (The "Truth" function)
  const recalculateBudgets = async () => {
    if (!confirm("Audit all team budgets based on actual auction results?")) return;
    setLoading(true);
    const { data: owners } = await supabase.from('league_owners').select('*');
    const { data: results } = await supabase.from('auction_results').select('*');
    for (const owner of owners) {
      const spent = results.filter(r => String(r.owner_id) === String(owner.id)).reduce((sum, p) => sum + p.winning_bid, 0);
      await supabase.from('league_owners').update({ budget: 150 - spent }).eq('id', owner.id);
    }
    alert("BUDGET AUDIT COMPLETE: All team wallets updated.");
    setLoading(false);
    syncAdmin();
  };

  // 3. RESET ENTIRE TOURNAMENT (Dangerous)
  const resetTournament = async () => {
    if (!confirm("PERMANENT WIPE: This will delete ALL bids, results, and reset budgets to 150. Proceed?")) return;
    setLoading(true);
    await supabase.from('auction_results').delete().neq('owner_id', '0'); 
    await supabase.from('bids_draft').delete().neq('player_id', 0);
    await supabase.from('league_owners').update({ budget: 150, is_locked: false }).neq('team_name', ''); 
    await supabase.from('active_auction').update({ player_id: null, is_sold: false, winner_name: '', winning_amount: 0 }).eq('id', 2);
    alert("SYSTEM RESET: Fresh Tournament Ready.");
    setLoading(false);
    syncAdmin();
  };

  // 4. TEAM MANAGEMENT
  const createOwner = async () => {
    if(!ownerName) return;
    const { error } = await supabase.from('league_owners').insert([{ team_name: ownerName, budget: 150 }]);
    if(!error) { setOwnerName(''); syncAdmin(); alert("Team Added!"); }
  };

  // 5. LIVE AUCTION CONTROL (The "Push")
  const pushPlayer = async () => {
    if (!pid) return;
    setLoading(true);
    await supabase.from('active_auction').update({ 
      player_id: pid, 
      is_sold: false, 
      winner_name: '', 
      winning_amount: 0 
    }).eq('id', 2);
    await supabase.from('bids_draft').delete().neq('player_id', 0);
    setPid('');
    setLoading(false);
    alert("Player Pushed to Stage!");
  };

  // 6. FINALIZE SALE
  const handleSold = async (bid) => {
    if(!confirm(`Sell ${data.player.name} to ${bid.league_owners.team_name} for ${bid.bid_amount} Cr?`)) return;
    setLoading(true);
    const { error: resErr } = await supabase.from('auction_results').insert([{ 
      player_id: bid.player_id, 
      owner_id: bid.owner_id, 
      winning_bid: bid.bid_amount 
    }]);

    if (!resErr) {
      await supabase.from('league_owners').update({ budget: bid.league_owners.budget - bid.bid_amount }).eq('id', bid.owner_id);
      await supabase.from('active_auction').update({ 
        is_sold: true, 
        winner_name: bid.league_owners.team_name, 
        winning_amount: bid.bid_amount 
      }).eq('id', 2);
      await supabase.from('bids_draft').delete().eq('player_id', bid.player_id);
      confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 } });
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover', backgroundAttachment: 'fixed', color: '#fff', minHeight: '100dvh', padding: '20px', fontFamily: '"Orbitron", sans-serif', boxSizing: 'border-box'
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');`}</style>

      <h1 style={{ textAlign: 'center', color: '#fbbf24', fontSize: '1.8rem', marginBottom: '20px', textShadow: '0 0 20px #000' }}>AUCTION CONTROL TOWER</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* LEFT COLUMN: MANAGEMENT TOOLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* TEAM CREATION */}
          <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h4 style={{ color: '#fbbf24', marginTop: 0, fontSize: '0.8rem' }}>TEAM MANAGEMENT</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="New Team Name" style={{ flex: 1, padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px' }} />
              <button onClick={createOwner} style={{ padding: '0 20px', background: '#22c55e', border: 'none', fontWeight: '900', borderRadius: '8px', cursor: 'pointer' }}>ADD</button>
            </div>
          </div>

          {/* STAGE CONTROL */}
          <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '15px', border: '2px solid #fbbf24' }}>
            <h4 style={{ color: '#fbbf24', marginTop: 0, fontSize: '0.8rem' }}>LIVE STAGE (PUSH PID)</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input value={pid} onChange={e => setPid(e.target.value)} placeholder="PID" style={{ width: '80px', padding: '15px', background: '#000', border: '1px solid #fbbf24', color: '#fff', borderRadius: '10px', fontSize: '1.5rem', textAlign: 'center', fontWeight: '900' }} />
              <button onClick={pushPlayer} disabled={loading} style={{ flex: 1, background: '#fbbf24', border: 'none', fontWeight: '900', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem' }}>PUSH TO STADIUM</button>
            </div>
          </div>

          {/* SYSTEM OPERATIONS */}
          <div style={{ background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h4 style={{ color: '#fbbf24', marginTop: 0, fontSize: '0.8rem' }}>DANGER ZONE</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
               <button onClick={resolveSecretBids} style={{ background: '#f59e0b', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '0.7rem' }}>RESOLVE SECRET</button>
               <button onClick={recalculateBudgets} style={{ background: '#3b82f6', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '0.7rem' }}>RE-SYNC BUDGETS</button>
               <button onClick={resetTournament} style={{ gridColumn: 'span 2', background: '#e11d48', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: '900', marginTop: '5px' }}>RESET ENTIRE TOURNAMENT</button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: LIVE AUCTION VIEW */}
        <div style={{ background: 'rgba(0,0,0,0.9)', padding: '25px', borderRadius: '20px', border: '1px solid #333', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '400px' }}>
          <AnimatePresence mode="wait">
            {data.isSold ? (
              <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ padding: '40px' }}>
                <h1 style={{ color: '#22c55e', fontSize: '4rem', margin: 0 }}>SOLD!</h1>
                <h2 style={{ fontSize: '1.5rem', textTransform: 'uppercase' }}>{data.winner_name}</h2>
                <div style={{ color: '#fbbf24', fontSize: '2rem', fontWeight: '900' }}>{data.winning_amount} Cr</div>
              </motion.div>
            ) : data.player ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={data.player.id}>
                 <span style={{ color: '#fbbf24', fontSize: '0.6rem', border: '1px solid #fbbf24', padding: '3px 10px', borderRadius: '5px' }}>{TOURNAMENT_NAME}</span>
                 <h1 style={{ fontSize: '2.5rem', margin: '15px 0 5px 0', textTransform: 'uppercase' }}>{data.player.name}</h1>
                 <div style={{ color: '#fbbf24', fontSize: '4rem', fontWeight: '900' }}>
                    {data.bids[0]?.bid_amount.toFixed(2) || (data.player.base_price/10000000).toFixed(2)} 
                    <small style={{fontSize: '1rem'}}> Cr</small>
                 </div>
                 
                 <div style={{ textAlign: 'left', marginTop: '30px' }}>
                   <h5 style={{ color: '#444', margin: '0 0 10px 0', borderBottom: '1px solid #222' }}>INCOMING BIDS</h5>
                   <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                     {data.bids.map(b => (
                       <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#000', marginBottom: '8px', borderRadius: '10px', border: '1px solid #222', alignItems: 'center' }}>
                         <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{b.league_owners.team_name}</span>
                         <button onClick={() => handleSold(b)} style={{ background: '#22c55e', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>SELL</button>
                       </div>
                     ))}
                     {data.bids.length === 0 && <div style={{ color: '#222', padding: '20px' }}>WAITING FOR BIDS...</div>}
                   </div>
                 </div>
              </motion.div>
            ) : (
              <div style={{ opacity: 0.2 }}>
                <h1 style={{ fontSize: '3rem', letterSpacing: '10px' }}>READY</h1>
                <p>Push a PID to start the show</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
