import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

export default function LiveAuction() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [activeData, setActiveData] = useState({ player: null, bids: [], isSold: false });
  const [bidLoading, setBidLoading] = useState(false);

  useEffect(() => {
    if (router.isReady) fetchInitialData();
  }, [router.isReady, id]);

  const fetchInitialData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);
    syncAuction();
  };

  const syncAuction = async () => {
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    if (active?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: bids } = await supabase.from('bids_draft').select('*, league_owners(team_name)').eq('player_id', active.player_id).order('bid_amount', { ascending: false });
      setActiveData({ player: p, bids: bids || [], isSold: active.is_sold });
    } else {
      setActiveData({ player: null, bids: [], isSold: false });
    }
  };

  useEffect(() => {
    const sub = supabase.channel('live_auction').on('postgres_changes', { event: '*', schema: 'public' }, syncAuction).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

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

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>ENTERING STADIUM...</div>;

  const currentPrice = activeData.bids[0]?.bid_amount || (activeData.player?.base_price / 10000000);

  return (
    <div style={{ 
      backgroundImage: `linear-gradient(to bottom, rgba(0,20,50,0.8), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      color: '#fff', 
      minHeight: '100vh', 
      padding: '20px', 
      fontFamily: '"Orbitron", sans-serif' 
    }}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');
        
        .advanced-card {
          background: linear-gradient(135deg, rgba(25,25,25,0.9) 0%, rgba(10,10,10,1) 100%);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(251, 191, 36, 0.4);
          border-radius: 20px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(251, 191, 36, 0.1);
        }

        .card-light-effect {
          position: absolute;
          top: 10%; left: 50%;
          transform: translateX(-50%);
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, rgba(0,0,0,0) 70%);
          z-index: 0;
        }

        .neon-border {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border: 2px solid transparent;
          border-radius: 20px;
          background: linear-gradient(45deg, #fbbf24, #f59e0b, #fbbf24) border-box;
          -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          opacity: 0.5;
        }
      `}</style>

      {/* TOP HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', background: 'rgba(0,0,0,0.8)', borderRadius: '50px', borderBottom: '2px solid #fbbf24', marginBottom: '40px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
        <span style={{ fontWeight: '900', letterSpacing: '1px' }}>{owner.team_name}</span>
        <span style={{ color: '#22c55e', fontWeight: '900' }}>{owner.budget.toFixed(2)} Cr</span>
      </div>

      <AnimatePresence mode="wait">
        {activeData.player && !activeData.isSold ? (
          <motion.div 
            key={activeData.player.id}
            initial={{ opacity: 0, scale: 0.8, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
            transition={{ type: "spring", damping: 15 }}
            style={{ maxWidth: '420px', margin: '0 auto' }}
          >
            <div className="advanced-card">
              <div className="neon-border"></div>
              <div className="card-light-effect"></div>

              <div style={{ padding: '25px', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#fbbf24' }}>IPL 2026</span>
                  <span style={{ background: '#fbbf24', color: '#000', padding: '2px 10px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '900' }}>{activeData.player.type.toUpperCase()}</span>
                </div>

                <img 
                  src={`/players/${activeData.player.name.toLowerCase().replace(/ /g, '_')}.jpg`}
                  style={{ 
                    width: '100%', height: '340px', objectFit: 'cover', 
                    borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.3)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.9)'
                  }}
                  onError={(e) => e.target.src = '/players/place_holder.jpg'}
                />

                <h1 style={{ fontSize: '2rem', margin: '20px 0 5px 0', fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '-1px' }}>{activeData.player.name}</h1>
                <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', margin: '0 0 20px 0', fontWeight: 'bold' }}>{activeData.player.country.toUpperCase()}</p>

                <div style={{ background: 'rgba(0,0,0,0.6)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(251, 191, 36, 0.2)', textAlign: 'center' }}>
                  <small style={{ color: '#fbbf24', letterSpacing: '3px', fontSize: '0.7rem' }}>CURRENT VALUATION</small>
                  <div style={{ fontSize: '4.5rem', fontWeight: '900', margin: '5px 0' }}>{currentPrice.toFixed(2)} <small style={{fontSize: '1rem', color: '#666'}}>Cr</small></div>
                  {activeData.bids[0] && (
                    <div style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 'bold', textShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}>
                      LEADING: {activeData.bids[0].league_owners.team_name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={placeBid} 
              disabled={bidLoading || (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id))}
              style={{ 
                width: '100%', marginTop: '25px', padding: '20px', 
                background: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? '#1a1a1a' : 'linear-gradient(to right, #fbbf24, #f59e0b)', 
                color: '#000', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.4rem', cursor: 'pointer',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}
            >
              {activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id) 
                ? "TOP BIDDER" 
                : `PLACE BID +${getIncrement(currentPrice).toFixed(2)} Cr`}
            </motion.button>
          </motion.div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '150px', opacity: 0.5 }}>
            <h1 style={{ fontSize: '3rem', letterSpacing: '10px', fontWeight: '900' }}>STANDBY...</h1>
            <p>PREPARING THE NEXT AUCTION CARD</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
