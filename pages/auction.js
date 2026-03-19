import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

const TOURNAMENT_NAME = "MY LEAGUE 2026"; 

export default function LiveAuction() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [activeData, setActiveData] = useState({ player: null, bids: [], isSold: false });
  const [mySquad, setMySquad] = useState([]);
  const [showSquad, setShowSquad] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);

  useEffect(() => {
    if (router.isReady) fetchInitialData();
  }, [router.isReady, id]);

  const fetchInitialData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);
    syncAuction();
    fetchSquad();
  };

  const fetchSquad = async () => {
    if (!id) return;
    const { data } = await supabase.from('auction_results').select('*, players(name, type, base_price)').eq('owner_id', id);
    setMySquad(data || []);
  };

  const syncAuction = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (active?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
      setActiveData({ player: p, bids: bids || [], isSold: active.is_sold });
      if (active.is_sold) fetchSquad(); // Refresh squad if someone is sold
    } else {
      setActiveData({ player: null, bids: [], isSold: false });
    }
  };

  useEffect(() => {
    const sub = supabase.channel('live_auction').on('postgres_changes', { event: '*', schema: 'public' }, syncAuction).subscribe();
    return () => supabase.removeChannel(sub);
  }, [id]);

  const getIncrement = (currentCr) => {
    if (currentCr < 1.00) return 0.10;
    if (currentCr < 2.00) return 0.10;
    if (currentCr < 5.00) return 0.20;
    return 0.25;
  };

  const placeBid = async () => {
    if (!activeData.player || activeData.isSold || bidLoading) return;
    if (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) return;
    const currentMax = activeData.bids[0]?.bid_amount || (activeData.player.base_price / 10000000);
    const newBid = currentMax + getIncrement(currentMax);
    if (newBid > owner.budget) return alert("Insufficient Budget!");
    setBidLoading(true);
    await supabase.from('bids_draft').upsert({ player_id: activeData.player.id, owner_id: id, bid_amount: newBid }, { onConflict: 'player_id, owner_id' });
    setBidLoading(false);
  };

  if (!owner) return <div style={{background:'#000', height:'100vh'}} />;

  const currentPrice = activeData.bids[0]?.bid_amount || (activeData.player?.base_price / 10000000);

  return (
    <div style={{ 
      backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover', backgroundPosition: 'center',
      color: '#fff', height: '100vh', width: '100vw', overflow: 'hidden', // STOPS ALL SCROLLING
      fontFamily: '"Orbitron", sans-serif', display: 'flex', flexDirection: 'column'
    }}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');
        .glass-panel { background: rgba(255,255,255,0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); }
        .fifa-card { background: linear-gradient(135deg, #111 0%, #000 100%); border: 1px solid #fbbf24; border-radius: 15px; position: relative; box-shadow: 0 0 30px rgba(0,0,0,1); }
      `}</style>

      {/* 1. COMPACT HEADER */}
      <div style={{ height: '10%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(251,191,36,0.3)' }}>
        <div style={{fontSize: '0.9rem', fontWeight: '900'}}>{owner.team_name}</div>
        <div style={{color: '#22c55e', fontWeight: '900'}}>{owner.budget.toFixed(2)} Cr</div>
      </div>

      {/* 2. MAIN STAGE (75% height) */}
      <div style={{ height: '75%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '10px' }}>
        <AnimatePresence mode="wait">
          {activeData.player && !activeData.isSold ? (
            <motion.div 
              key={activeData.player.id}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              style={{ width: '100%', maxWidth: '350px', textAlign: 'center' }}
            >
              <div className="fifa-card" style={{ padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#fbbf24', marginBottom: '10px' }}>
                   <span>{TOURNAMENT_NAME}</span>
                   <span style={{background:'#fbbf24', color:'#000', padding:'2px 5px', borderRadius:'3px'}}>{activeData.player.type.toUpperCase()}</span>
                </div>
                <img 
                  src={`/players/${activeData.player.name.toLowerCase().replace(/ /g, '_')}.jpg`}
                  style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #222' }}
                  onError={(e) => e.target.src = '/players/place_holder.jpg'}
                />
                <h2 style={{ fontSize: '1.4rem', margin: '15px 0 5px 0', textTransform: 'uppercase' }}>{activeData.player.name}</h2>
                <div style={{ background: 'rgba(251,191,36,0.1)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(251,191,36,0.3)' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '900' }}>{currentPrice.toFixed(2)} <small style={{fontSize: '0.8rem'}}>Cr</small></div>
                  {activeData.bids[0] && <div style={{ color: '#22c55e', fontSize: '0.7rem' }}>LATEST: {activeData.bids[0].league_owners.team_name}</div>}
                </div>
              </div>
            </motion.div>
          ) : (
            <div style={{ opacity: 0.2, textAlign: 'center' }}>
              <h1 style={{ fontSize: '2rem', letterSpacing: '5px' }}>STANDBY</h1>
              <p style={{fontSize: '0.7rem'}}>Awaiting next player card...</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. ACTION FOOTER (15% height) */}
      <div style={{ height: '15%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={placeBid}
          disabled={!activeData.player || activeData.isSold || (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id))}
          style={{ 
            width: '100%', padding: '18px', borderRadius: '15px', border: 'none', fontWeight: '900', fontSize: '1.1rem',
            background: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? '#222' : 'linear-gradient(to right, #fbbf24, #f59e0b)',
            color: '#000', boxShadow: '0 5px 20px rgba(0,0,0,0.5)'
          }}
        >
          {activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id) ? "TOP BIDDER" : `BID +${getIncrement(currentPrice).toFixed(2)} Cr`}
        </motion.button>
        
        <button 
          onClick={() => setShowSquad(true)}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer' }}
        >
          🔼 VIEW MY SQUAD ({mySquad.length})
        </button>
      </div>

      {/* 4. MY SQUAD DRAWER (Slide Up Overlay) */}
      <AnimatePresence>
        {showSquad && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 100, padding: '20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{color: '#fbbf24', margin: 0}}>MY SQUAD</h3>
              <button onClick={() => setShowSquad(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px' }}>CLOSE</button>
            </div>
            <div style={{ height: '80%', overflowY: 'auto' }}>
              {mySquad.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #222' }}>
                  <span>{item.players.name}</span>
                  <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>
                </div>
              ))}
              {mySquad.length === 0 && <div style={{textAlign: 'center', marginTop: '50px', color: '#444'}}>No players bought yet</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
