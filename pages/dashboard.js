import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [owners, setOwners] = useState([]);
  const [results, setResults] = useState([]);

  const loadData = async () => {
    // 1. Fetch Owners
    const { data: o } = await supabase.from('league_owners').select('*').order('team_name');
    
    // 2. Fetch ALL Results (Including player type for badges)
    const { data: r, error } = await supabase
      .from('auction_results')
      .select('*, players(name, type)');

    if (error) console.error("Data Fetch Error:", error);

    setOwners(o || []);
    setResults(r || []);
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel('dashboard').on('postgres_changes', { event: '*', schema: 'public' }, loadData).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // --- HELPERS ---
  const getBidCount = (pId) => results.filter(res => res.player_id === pId).length;

  const getPlayerImg = (name) => {
    if (!name) return '/players/place_holder.jpg';
    const fileName = name.toLowerCase().trim().replace(/ /g, '_');
    return `/players/${fileName}.jpg`;
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
      <span style={{ color: role.color, fontSize: '0.8rem' }}>{role.icon}</span>
    );
  };

  return (
    <div style={{ 
      background: '#050505', 
      backgroundImage: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 100%)',
      color: '#fff', 
      minHeight: '100vh', 
      padding: '40px', 
      fontFamily: 'sans-serif' 
    }}>
      
      {/* GLOWING HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ 
          fontSize: '3.5rem', 
          color: '#fbbf24', 
          margin: 0, 
          textShadow: '0 0 30px rgba(251, 191, 36, 0.3)',
          letterSpacing: '-2px'
        }}>
          AUCTION WAR ROOM
        </h1>
        <p style={{ color: '#444', fontWeight: 'bold', letterSpacing: '2px' }}>LIVE SQUAD TRACKER</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
        gap: '25px' 
      }}>
        {owners.map(owner => {
          const squad = results.filter(res => String(res.owner_id) === String(owner.id));
          const totalSpent = squad.reduce((sum, item) => sum + (parseFloat(item.winning_bid) || 0), 0);

          return (
            <div key={owner.id} style={{ 
              background: 'rgba(255,255,255,0.03)', 
              backdropFilter: 'blur(15px)',
              borderRadius: '25px', 
              border: owner.is_locked ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
              padding: '25px', 
              position: 'relative',
              boxShadow: owner.is_locked ? '0 0 30px rgba(34, 197, 94, 0.1)' : '0 10px 40px rgba(0,0,0,0.5)',
              transition: 'transform 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {/* TEAM NAME & BUDGET */}
              <h2 style={{ margin: '0 0 15px 0', color: '#e11d48', fontSize: '1.6rem' }}>{owner.team_name}</h2>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '20px', 
                background: 'rgba(0,0,0,0.3)',
                padding: '15px',
                borderRadius: '15px'
              }}>
                <div>
                  <small style={{ color: '#555', display: 'block', fontSize: '0.6rem', fontWeight: 'bold' }}>SPENT</small>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.3rem' }}>{totalSpent.toFixed(2)} <small style={{fontSize:'0.7rem'}}>Cr</small></span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: '#555', display: 'block', fontSize: '0.6rem', fontWeight: 'bold' }}>REMAINING</small>
                  <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.3rem' }}>{owner.budget.toFixed(2)} <small style={{fontSize:'0.7rem'}}>Cr</small></span>
                </div>
              </div>

              {/* SQUAD COUNT */}
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '0.9rem' }}>SQUAD: {squad.length} / 15</span>
                {owner.is_locked && (
                  <span style={{ 
                    background: '#22c55e', 
                    color: '#000', 
                    fontSize: '0.6rem', 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    fontWeight: 'bold' 
                  }}>LOCKED</span>
                )}
              </div>

              {/* PLAYER SCROLL LIST */}
              <div style={{ 
                maxHeight: '380px', 
                overflowY: 'auto', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '15px', 
                padding: '10px' 
              }}>
                {squad.length > 0 ? squad.map((item, idx) => {
                  const clashes = getBidCount(item.player_id);
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px 5px', 
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      fontSize: '0.9rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={getPlayerImg(item.players?.name)} 
                          style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', background:'#000' }}
                          onError={(e) => e.target.src = '/players/place_holder.jpg'}
                        />
                        <span style={{ color: clashes > 1 ? '#fbbf24' : '#fff', fontWeight: clashes > 1 ? 'bold' : 'normal' }}>
                          {getRoleBadge(item.players?.type)} {item.players?.name || `ID: ${item.player_id}`} {clashes > 1 && '⚠️'}
                        </span>
                      </div>
                      <span style={{ fontWeight: 'bold', color: clashes > 1 ? '#fbbf24' : '#666' }}>
                        {parseFloat(item.winning_bid).toFixed(2)}
                      </span>
                    </div>
                  );
                }) : (
                  <div style={{ color: '#222', textAlign: 'center', padding: '40px', fontSize: '0.8rem', fontWeight: 'bold' }}>SQUAD EMPTY</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* FLOATING REFRESH */}
      <button 
        onClick={loadData} 
        style={{ 
          position: 'fixed', 
          bottom: '30px', 
          right: '30px', 
          padding: '15px 35px', 
          background: 'linear-gradient(45deg, #fbbf24, #f59e0b)', 
          color: '#000', 
          border: 'none', 
          borderRadius: '50px', 
          fontWeight: '900', 
          cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(251, 191, 36, 0.4)'
        }}
      >
        REFRESH DATA
      </button>
    </div>
  );
}
