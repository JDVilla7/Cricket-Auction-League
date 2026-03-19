import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

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

  // --- IPL DYNAMIC INCREMENT LOGIC ---
  const getIncrement = (currentCr) => {
    if (currentCr < 1.00) return 0.10; // 10 Lakhs
    if (currentCr < 2.00) return 0.10; // 10 Lakhs
    if (currentCr < 5.00) return 0.20; // 20 Lakhs
    return 0.25; // 25 Lakhs
  };

  const placeBid = async () => {
    if (!activeData.player || activeData.isSold || bidLoading) return;

    // BUG 1 FIX: Cannot outbid yourself
    if (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) {
      return alert("You are already the highest bidder!");
    }

    const currentMax = activeData.bids[0]?.bid_amount || (activeData.player.base_price / 10000000);
    const increment = getIncrement(currentMax);
    const newBid = currentMax + increment;

    if (newBid > owner.budget) return alert("Insufficient Budget!");

    setBidLoading(true);
    const { error } = await supabase.from('bids_draft').upsert({
      player_id: activeData.player.id,
      owner_id: id,
      bid_amount: newBid
    }, { onConflict: 'player_id, owner_id' });

    if (error) alert("Bid failed");
    setBidLoading(false);
  };

  // --- CLEAN PROFESSIONAL BADGE ---
  const getRoleBadge = (type) => {
    const colors = { 'Batsman': '#ef4444', 'Fast Bowler': '#3b82f6', 'Spin Bowler': '#60a5fa', 'All-rounder': '#fbbf24', 'Wicket-keeper': '#10b981' };
    const color = colors[type] || '#666';
    return (
      <span style={{ background: color, color: '#000', padding: '4px 12px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {type}
      </span>
    );
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>LOADING...</div>;

  const currentPrice = activeData.bids[0]?.bid_amount || (activeData.player?.base_price / 10000000);
  const nextIncrement = activeData.player ? getIncrement(currentPrice) : 0;

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* CSS FOR RGB MOVING BORDER */}
      <style>{`
        @keyframes rotate {
          100% { transform: rotate(1turn); }
        }
        .rgb-card {
          position: relative;
          z-index: 0;
          border-radius: 20px;
          overflow: hidden;
          padding: 3px; /* Border thickness */
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .rgb-card::before {
          content: '';
          position: absolute;
          z-index: -2;
          left: -50%;
          top: -50%;
          width: 200%;
          height: 200%;
          background-color: #1a1a1a;
          background-repeat: no-repeat;
          background-size: 50% 50%, 50% 50%;
          background-position: 0 0, 100% 0, 100% 100%, 0 100%;
          background-image: linear-gradient(#fbbf24, #fbbf24), linear-gradient(#ef4444, #ef4444), linear-gradient(#22c55e, #22c55e), linear-gradient(#3b82f6, #3b82f6);
          animation: rotate 4s linear infinite;
        }
        .rgb-card::after {
          content: '';
          position: absolute;
          z-index: -1;
          left: 3px;
          top: 3px;
          width: calc(100% - 6px);
          height: calc(100% - 6px);
          background: #0a0a0a;
          border-radius: 18px;
        }
      `}</style>

      {/* TOP STATS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '20px', border: '1px solid #222' }}>
        <span>{owner.team_name}</span>
        <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{owner.budget.toFixed(2)} Cr</span>
      </div>

      {activeData.player && !activeData.isSold ? (
        <div style={{ maxWidth: '450px', margin: '0 auto' }}>
          
          {/* FIFA STYLE RGB CARD */}
          <div className="rgb-card">
            <div style={{ width: '100%', textAlign: 'center', padding: '30px 20px' }}>
              <img 
                src={`/players/${activeData.player.name.toLowerCase().replace(/ /g, '_')}.jpg`}
                style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '15px', marginBottom: '20px' }}
                onError={(e) => e.target.src = '/players/place_holder.jpg'}
              />
              <div style={{ marginBottom: '10px' }}>{getRoleBadge(activeData.player.type)}</div>
              <h1 style={{ fontSize: '2rem', margin: '5px 0' }}>{activeData.player.name}</h1>
              <p style={{ color: '#666', fontSize: '0.8rem' }}>{activeData.player.country.toUpperCase()}</p>
              
              <div style={{ marginTop: '20px', background: '#000', padding: '20px', borderRadius: '15px' }}>
                <small style={{ color: '#fbbf24', fontWeight: 'bold' }}>CURRENT BID</small>
                <div style={{ fontSize: '3.5rem', fontWeight: '900' }}>{currentPrice.toFixed(2)} <small style={{fontSize: '1rem'}}>Cr</small></div>
                {activeData.bids[0] && <div style={{ color: '#22c55e', fontSize: '0.8rem' }}>BY {activeData.bids[0].league_owners.team_name}</div>}
              </div>
            </div>
          </div>

          {/* DYNAMIC BID BUTTON */}
          <button 
            onClick={placeBid} 
            disabled={bidLoading || (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id))}
            style={{ 
              width: '100%', marginTop: '20px', padding: '20px', 
              background: (activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id)) ? '#333' : 'linear-gradient(45deg, #fbbf24, #f59e0b)', 
              color: '#000', border: 'none', borderRadius: '15px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer' 
            }}
          >
            {activeData.bids[0] && String(activeData.bids[0].owner_id) === String(id) 
              ? "YOU ARE HIGHEST" 
              : `BID +${nextIncrement.toFixed(2)} Cr`}
          </button>

          {/* HISTORY */}
          <div style={{ marginTop: '30px', background: '#111', padding: '20px', borderRadius: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#444', fontSize: '0.7rem' }}>BID LOG</h4>
            {activeData.bids.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', fontSize: '0.8rem' }}>
                <span style={{ color: i === 0 ? '#fbbf24' : '#fff' }}>{b.league_owners.team_name}</span>
                <span>{b.bid_amount.toFixed(2)}</span>
              </div>
            ))}
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '100px', color: '#222' }}><h1>WAITING...</h1></div>
      )}
    </div>
  );
}
