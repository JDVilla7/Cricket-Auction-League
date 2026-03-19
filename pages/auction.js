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
      if (active.is_sold) fetchSquad();
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

  if (!owner) return <div style={{background:'#000', height:'100dvh'}} />;

  const currentPrice = activeData.bids[0]?.bid_amount || (activeData.player?.base_price / 10000000);

  return (
    <div style={{ 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover', backgroundPosition: 'center',
      color: '#fff', 
      height: '100dvh', // Use Dynamic Viewport Height
      width: '100vw', 
      overflow: 'hidden', 
      fontFamily: '"Orbitron", sans-serif', 
      display: 'flex', 
      flexDirection: 'column',
      boxSizing: 'border-box'
    }}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');
        * { box-sizing: border-box; }
        .fifa-card { 
          background: linear-gradient(135deg, #111 0%, #000 100%); 
          border: 1px solid #fbbf24; 
          border-radius: 15px; 
          position: relative; 
          box-shadow: 0 0 30px rgba(0,0,0,1); 
          max-height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>

      {/* 1. HEADER (Fixed height, no cutting) */}
      <div style={{ flex: '0 0 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(251,191,36,0.3)', width: '100%' }}>
        <div style={{fontSize: '0.8rem', fontWeight: '900', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>
          {owner.team_name}
        </div>
        <div style={{color: '#22c55e', fontWeight: '900', fontSize: '1rem', whiteSpace: 'nowrap'}}>
          {owner.budget.toFixed(2)} Cr
        </div>
      </div>

      {/* 2. CENTER STAGE (Flexible area that fits the card) */}
      <div style={{ flex: '1', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {activeData.player && !activeData.isSold ? (
            <motion.div 
              key={activeData.player.id}
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 1.1 }}
              style={{ width: '100%', maxWidth: '340px', maxHeight: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <div className="fifa-card" style={{ width: '100%', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#fbbf24', marginBottom: '8px' }}>
                   <span style={{fontWeight: '900'}}>{TOURNAMENT_NAME}</span>
                   <span style={{background:'#fbbf24', color:'#000', padding:'2px 6px', borderRadius:'3px', fontWeight: '900'}}>{activeData.player.type.toUpperCase()}</span>
                </div>
                
                <div style={{ flex: '1', minHeight: '0', marginBottom: '10px' }}>
                  <img 
                    src={`/players/${activeData.player.name.toLowerCase().replace(/ /g, '_')}.jpg`}
                    style={{ width: '100%', height: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #222' }}
                    onError={(e) => e.target.src = '/players/place_holder.jpg'}
                  />
                </div>

                <div style={{ flexShrink: 0 }}>
                  <h2 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeData.player.name}
                  </h2>
                  <div style={{ background: 'rgba(251,191,36,0.1)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: '900', lineHeight: 1 }}>
                      {currentPrice.toFixed(2)} <small style={{fontSize: '0.8rem'}}>Cr</small>
                    </div>
                    {activeData.bids[0] && (
                      <div style={{ color: '#22c55e', fontSize: '0.6rem', marginTop: '5px', fontWeight: '900', textTransform: 'uppercase' }}>
                        BY {activeData.bids[0].league_owners.team_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div style={{ opacity: 0.15, textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.8rem', letterSpacing: '8px', fontWeight: '900' }}>STANDBY</h1>
              <p style={{fontSize: '0.6rem', letterSpacing: '2px'}}>AWAITING NEXT PUSH</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. FOOTER (Bottom buttons, fixed) */}
      <div style={{ flex: '0 0 auto', padding: '10px 20px 25px 20px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        <motion.button 
          whileTap={{ scale: 0.96 }}
          onClick={placeBid}
          disabled={!activeData.player || activeData.isSold || (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id))}
          style={{ 
            width: '100%', padding: '18px', borderRadius: '15px', border: 'none', fontWeight: '900', fontSize: '1.1rem',
            background: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? '#1a1a1a' : 'linear-gradient(to right, #fbbf24, #f59e0b)',
            color: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? '#444' : '#000',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          {activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id) ? "TOP BIDDER" : `BID +${getIncrement(currentPrice).toFixed(2)} Cr`}
        </motion.button>
        
        <button 
          onClick={() => setShowSquad(true)}
          style={{ background: 'none', border: 'none', color: '#555', fontSize: '0.65rem', fontWeight: '900', letterSpacing: '2px', cursor: 'pointer', textTransform: 'uppercase' }}
        >
          View My Squad ({mySquad.length})
        </button>
      </div>

      {/* 4. SQUAD OVERLAY */}
      <AnimatePresence>
        {showSquad && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', height: '85%', background: '#050505', zIndex: 100, padding: '25px', borderRadius: '30px 30px 0 0', borderTop: '2px solid #fbbf24', boxShadow: '0 -20px 50px rgba(0,0,0,1)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h3 style={{color: '#fbbf24', margin: 0, fontSize: '1.2rem', fontWeight: '900'}}>MY SQUAD</h3>
              <button onClick={() => setShowSquad(false)} style={{ background: '#222', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '900', fontSize: '0.7rem' }}>CLOSE</button>
            </div>
            <div style={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
              {mySquad.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #111' }}>
                  <div style={{fontSize: '0.9rem'}}>{item.players.name}</div>
                  <div style={{ color: '#22c55e', fontWeight: '900' }}>{item.winning_bid.toFixed(2)} Cr</div>
                </div>
              ))}
              {mySquad.length === 0 && <div style={{textAlign: 'center', marginTop: '50px', color: '#222', fontWeight: '900'}}>NO PLAYERS YET</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
