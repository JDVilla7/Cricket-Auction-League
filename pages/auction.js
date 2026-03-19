import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion'; // For the "Push" motion

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
      backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`, // Stadium Background
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      color: '#fff', 
      minHeight: '100vh', 
      padding: '20px', 
      fontFamily: 'sans-serif' 
    }}>
      
      <style>{`
        @keyframes border-glow {
          0% { box-shadow: 0 0 5px #fbbf24, inset 0 0 5px #fbbf24; }
          50% { box-shadow: 0 0 20px #fbbf24, inset 0 0 10px #fbbf24; }
          100% { box-shadow: 0 0 5px #fbbf24, inset 0 0 5px #fbbf24; }
        }
        .fifa-card {
          background: linear-gradient(135deg, #1a1a1a 0%, #000 100%);
          border: 2px solid #fbbf24;
          border-radius: 20px;
          position: relative;
          overflow: hidden;
          animation: border-glow 3s infinite;
        }
        .fifa-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: url('https://www.transparenttextures.com/patterns/carbon-fibre.png');
          opacity: 0.2;
        }
      `}</style>

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '15px 25px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{owner.team_name}</span>
        <span style={{ color: '#22c55e', fontWeight: '900', fontSize: '1.2rem' }}>{owner.budget.toFixed(2)} Cr</span>
      </div>

      <AnimatePresence mode="wait">
        {activeData.player && !activeData.isSold ? (
          <motion.div 
            key={activeData.player.id}
            initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ type: "spring", stiffness: 100 }}
            style={{ maxWidth: '420px', margin: '0 auto' }}
          >
            
            {/* FIFA RECTANGLE CARD */}
            <div className="fifa-card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', position: 'relative', zIndex: 1 }}>
                 <img src={`https://flagcdn.com/w80/${activeData.player.country.toLowerCase().substring(0,2)}.png`} style={{ height: '20px', borderRadius: '2px' }} />
                 <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#fbbf24', border: '1px solid #fbbf24', padding: '2px 8px', borderRadius: '4px' }}>{activeData.player.type.toUpperCase()}</span>
              </div>

              <img 
                src={`/players/${activeData.player.name.toLowerCase().replace(/ /g, '_')}.jpg`}
                style={{ width: '100%', height: '320px', objectFit: 'cover', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', position: 'relative', zIndex: 1 }}
                onError={(e) => e.target.src = '/players/place_holder.jpg'}
              />

              <div style={{ position: 'relative', zIndex: 1, marginTop: '20px' }}>
                <h1 style={{ fontSize: '2.2rem', margin: 0, fontWeight: '900', textTransform: 'uppercase' }}>{activeData.player.name}</h1>
                
                <div style={{ marginTop: '20px', background: 'rgba(251, 191, 36, 0.1)', padding: '20px', borderRadius: '15px', border: '1px solid #fbbf24' }}>
                  <small style={{ color: '#fbbf24', letterSpacing: '2px', fontWeight: 'bold' }}>CURRENT BID</small>
                  <div style={{ fontSize: '4rem', fontWeight: '900' }}>{currentPrice.toFixed(2)} <small style={{fontSize: '1.2rem'}}>Cr</small></div>
                  {activeData.bids[0] && <div style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 'bold' }}>BY {activeData.bids[0].league_owners.team_name}</div>}
                </div>
              </div>
            </div>

            {/* BID BUTTON */}
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={placeBid} 
              disabled={bidLoading || (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id))}
              style={{ 
                width: '100%', marginTop: '25px', padding: '22px', 
                background: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? '#1a1a1a' : 'linear-gradient(45deg, #fbbf24, #f59e0b)', 
                color: '#000', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.4rem', cursor: 'pointer',
                boxShadow: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? 'none' : '0 10px 40px rgba(251, 191, 36, 0.4)'
              }}
            >
              {activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id) 
                ? "HIGHEST BIDDER" 
                : `BID +${getIncrement(currentPrice).toFixed(2)} Cr`}
            </motion.button>

          </motion.div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '150px', color: 'rgba(255,255,255,0.2)' }}>
            <h1 style={{ fontSize: '4rem', letterSpacing: '10px' }}>WAITING...</h1>
            <p>Admin is preparing the next player card</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
