import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function LiveAuction() {
  const router = useRouter();
  const { id } = router.query; // Owner ID from URL
  const [owner, setOwner] = useState(null);
  const [activeData, setActiveData] = useState({ player: null, bids: [], isSold: false });
  const [bidLoading, setBidLoading] = useState(false);

  useEffect(() => {
    if (router.isReady) fetchInitialData();
  }, [router.isReady, id]);

  const fetchInitialData = async () => {
    // 1. Fetch Owner Info
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);
    syncAuction();
  };

  const syncAuction = async () => {
    // 2. Fetch Active Auction State
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    if (active?.player_id) {
      const { data: p } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: bids } = await supabase.from('bids_draft')
        .select('*, league_owners(team_name)')
        .eq('player_id', active.player_id)
        .order('bid_amount', { ascending: false });
      
      setActiveData({ player: p, bids: bids || [], isSold: active.is_sold });
    } else {
      setActiveData({ player: null, bids: [], isSold: false });
    }
  };

  useEffect(() => {
    const sub = supabase.channel('live_auction').on('postgres_changes', { event: '*', schema: 'public' }, syncAuction).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const placeBid = async (increment) => {
    if (!activeData.player || activeData.isSold || bidLoading) return;
    
    const currentMax = activeData.bids[0]?.bid_amount || (activeData.player.base_price / 10000000);
    const newBid = currentMax + increment;

    if (newBid > owner.budget) return alert("You don't have enough budget!");

    setBidLoading(true);
    // Upsert bid: if this owner already has a bid for this player, update it.
    const { error } = await supabase.from('bids_draft').upsert({
      player_id: activeData.player.id,
      owner_id: id,
      bid_amount: newBid
    }, { onConflict: 'player_id, owner_id' });

    if (error) alert("Bid failed: " + error.message);
    setBidLoading(false);
  };

  const getRoleBadge = (type) => {
    const roles = {
      'Batsman': { icon: '🏏', color: '#ef4444' },
      'Fast Bowler': { icon: '🔥', color: '#3b82f6' },
      'Spin Bowler': { icon: '🌀', color: '#60a5fa' },
      'All-rounder': { icon: '⚡', color: '#fbbf24' },
      'Wicket-keeper': { icon: '🧤', color: '#10b981' }
    };
    const role = roles[type] || { icon: '👤', color: '#666' };
    return (
      <span style={{ background: `${role.color}22`, color: role.color, padding: '5px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${role.color}50`, textTransform: 'uppercase' }}>
        {role.icon} {type}
      </span>
    );
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>LOADING AUCTION...</div>;

  return (
    <div style={{ background: '#050505', backgroundImage: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 100%)', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* TOP STATUS BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', padding: '15px 25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
        <div>
          <small style={{ color: '#666', display: 'block', fontWeight: 'bold' }}>TEAM</small>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fbbf24' }}>{owner.team_name}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <small style={{ color: '#666', display: 'block', fontWeight: 'bold' }}>BUDGET</small>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>{owner.budget.toFixed(2)} Cr</span>
        </div>
      </div>

      {activeData.isSold ? (
        <div style={{ textAlign: 'center', padding: '100px 20px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '30px', border: '2px dashed #22c55e' }}>
          <h1 style={{ color: '#22c55e', fontSize: '5rem', margin: 0 }}>SOLD</h1>
          <p style={{ fontSize: '1.5rem', color: '#888' }}>Waiting for next player...</p>
        </div>
      ) : activeData.player ? (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          
          {/* PLAYER CARD */}
          <div style={{ background: 'linear-gradient(135deg, #111 0%, #050505 100%)', borderRadius: '30px', padding: '40px', border: '1px solid #333', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>{getRoleBadge(activeData.player.type)}</div>
            
            <img 
              src={`/players/${activeData.player.name.toLowerCase().replace(/ /g, '_')}.jpg`}
              style={{ width: '180px', height: '180px', borderRadius: '50%', border: '5px solid #fbbf24', objectFit: 'cover', marginBottom: '20px', boxShadow: '0 0 30px rgba(251, 191, 36, 0.3)' }}
              onError={(e) => e.target.src = '/players/place_holder.jpg'}
            />
            <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', letterSpacing: '-1px' }}>{activeData.player.name}</h1>
            <p style={{ color: '#666', fontWeight: 'bold' }}>{activeData.player.country.toUpperCase()}</p>

            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', border: '1px solid #222' }}>
              <small style={{ color: '#fbbf24', fontWeight: 'bold' }}>CURRENT BID</small>
              <div style={{ fontSize: '4rem', fontWeight: '900', color: '#fff' }}>
                {activeData.bids[0] ? activeData.bids[0].bid_amount.toFixed(2) : (activeData.player.base_price / 10000000).toFixed(2)} 
                <span style={{ fontSize: '1.5rem', color: '#666' }}> Cr</span>
              </div>
              {activeData.bids[0] && <div style={{ color: '#22c55e', fontWeight: 'bold' }}>BY {activeData.bids[0].league_owners.team_name}</div>}
            </div>
          </div>

          {/* BIDDING BUTTONS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
            <button 
              onClick={() => placeBid(0.5)} 
              disabled={bidLoading}
              style={{ padding: '25px', background: '#fbbf24', color: '#000', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 10px 20px rgba(251, 191, 36, 0.2)' }}
            >
              +0.50 Cr
            </button>
            <button 
              onClick={() => placeBid(1.0)} 
              disabled={bidLoading}
              style={{ padding: '25px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 10px 20px rgba(225, 29, 72, 0.2)' }}
            >
              +1.00 Cr
            </button>
          </div>

          {/* BID HISTORY PANEL */}
          <div style={{ marginTop: '40px', background: '#0a0a0a', borderRadius: '20px', padding: '20px', border: '1px solid #111' }}>
            <h4 style={{ color: '#444', borderBottom: '1px solid #222', paddingBottom: '10px', marginTop: 0 }}>BID HISTORY</h4>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {activeData.bids.map((b, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #111', fontSize: '0.9rem' }}>
                  <span style={{ color: idx === 0 ? '#fbbf24' : '#fff', fontWeight: idx === 0 ? 'bold' : 'normal' }}>{b.league_owners.team_name}</span>
                  <span style={{ color: '#666' }}>{b.bid_amount.toFixed(2)} Cr</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div style={{ color: '#222', textAlign: 'center', marginTop: '150px' }}>
          <h1 style={{ fontSize: '4rem', margin: 0 }}>WAITING...</h1>
          <p>The Admin will push the next player soon.</p>
        </div>
      )}
    </div>
  );
}
