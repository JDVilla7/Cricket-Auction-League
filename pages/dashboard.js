import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// --- CONFIGURATION ---
const TOURNAMENT_NAME = "MY LEAGUE 2026"; 

export default function Dashboard() {
  // --- STATE MANAGEMENT ---
  const [owners, setOwners] = useState([]);
  const [results, setResults] = useState([]);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- DATA FETCHING ---
  const loadData = async () => {
    try {
      // 1. Fetch Owners (Alphabetical)
      const { data: o, error: oErr } = await supabase
        .from('league_owners')
        .select('*')
        .order('team_name');
      
      if (oErr) throw oErr;

      // 2. Fetch ALL Results with Player Details (Join)
      const { data: r, error: rErr } = await supabase
        .from('auction_results')
        .select(`
          *,
          players (
            name,
            type,
            base_price,
            country
          )
        `);

      if (rErr) throw rErr;

      // 3. Trigger Confetti if a new player has been sold since last sync
      if (r?.length > results.length && results.length > 0) {
        confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.7 },
          colors: ['#fbbf24', '#22c55e', '#ef4444', '#ffffff'],
          ticks: 300
        });
      }

      setOwners(o || []);
      setResults(r || []);
      setLoading(false);
    } catch (err) {
      console.error("Dashboard Sync Error:", err.message);
    }
  };

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    loadData();

    // Listen for any changes in results or owners tables
    const dashboardSubscription = supabase.channel('dashboard_war_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_results' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_owners' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(dashboardSubscription);
    };
  }, [results.length]);

  // --- LOGIC HELPERS ---
  const getBidCount = (pId) => {
    return results.filter(res => res.player_id === pId).length;
  };

  const getPlayerImg = (name) => {
    if (!name) return '/players/place_holder.jpg';
    const fileName = name.toLowerCase().trim().replace(/ /g, '_');
    return `/players/${fileName}.jpg`;
  };

  const getRoleBadge = (type) => {
    const roles = {
      'Batsman': { icon: '🏏', color: '#ef4444', label: 'BAT' },
      'Fast Bowler': { icon: '🔥', color: '#3b82f6', label: 'BOWL' },
      'Spin Bowler': { icon: '🌀', color: '#60a5fa', label: 'BOWL' },
      'All-rounder': { icon: '⚡', color: '#fbbf24', label: 'ALL' },
      'Wicket-keeper': { icon: '🧤', color: '#10b981', label: 'WK' }
    };
    const role = roles[type] || { icon: '👤', color: '#666', label: 'PLAYER' };
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px',
        background: `${role.color}22`,
        border: `1px solid ${role.color}55`,
        padding: '2px 6px',
        borderRadius: '4px',
        marginTop: '4px',
        width: 'fit-content'
      }}>
        <span style={{ fontSize: '0.6rem' }}>{role.icon}</span>
        <span style={{ 
          fontSize: '0.5rem', 
          fontWeight: '900', 
          color: role.color, 
          letterSpacing: '1px' 
        }}>
          {role.label}
        </span>
      </div>
    );
  };

  if (loading) return (
    <div style={{ background: '#000', height: '100dvh', display: 'grid', placeItems: 'center', color: '#fbbf24' }}>
      SYNCING WITH STADIUM...
    </div>
  );

  return (
    <div style={{ 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
      backgroundPosition: 'center',
      color: '#fff', 
      minHeight: '100dvh', 
      padding: '20px', 
      fontFamily: '"Orbitron", sans-serif',
      boxSizing: 'border-box'
    }}>
      
      {/* GLOBAL STYLES */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');
        
        * { box-sizing: border-box; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 10px; }

        .team-row-active {
          background: rgba(251, 191, 36, 0.95) !important;
          color: #000 !important;
          transform: scale(1.02);
          box-shadow: 0 10px 30px rgba(251, 191, 36, 0.3);
        }
      `}</style>

      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            fontSize: '2.5rem', 
            color: '#fbbf24', 
            margin: 0, 
            textShadow: '0 0 40px rgba(0,0,0,1)',
            fontWeight: '900',
            letterSpacing: '-1px'
          }}>
          {TOURNAMENT_NAME}
        </motion.h1>
        <p style={{ letterSpacing: '6px', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', marginTop: '5px' }}>
          AUCTION WAR ROOM HUB
        </p>
      </div>

      {/* ACCORDION CONTAINER */}
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        paddingBottom: '50px' 
      }}>
        {owners.map((owner, index) => {
          const squad = results.filter(res => String(res.owner_id) === String(owner.id));
          const totalSpent = squad.reduce((sum, item) => sum + (parseFloat(item.winning_bid) || 0), 0);
          const isExpanded = expandedTeam === owner.id;

          return (
            <motion.div 
              key={owner.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              style={{ borderRadius: '15px', overflow: 'hidden', border: owner.is_locked ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)' }}
            >
              {/* TEAM BAR */}
              <div 
                onClick={() => setExpandedTeam(isExpanded ? null : owner.id)}
                className={isExpanded ? 'team-row-active' : ''}
                style={{ 
                  background: 'rgba(0,0,0,0.85)', 
                  padding: '20px 25px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer', 
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    background: owner.is_locked ? '#22c55e' : (squad.length > 0 ? '#fbbf24' : '#444'),
                    boxShadow: owner.is_locked ? '0 0 10px #22c55e' : 'none'
                  }} />
                  <div>
                    <span style={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>
                      {owner.team_name}
                    </span>
                    <div style={{ fontSize: '0.6rem', opacity: 0.7, fontWeight: '900', marginTop: '2px' }}>
                      {squad.length} / 15 PLAYERS {owner.is_locked && '● LOCKED'}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div>
                    <div style={{ fontWeight: '900', fontSize: '1.4rem', lineHeight: 1 }}>
                      {owner.budget.toFixed(2)} 
                      <small style={{ fontSize: '0.7rem', marginLeft: '3px' }}>Cr</small>
                    </div>
                    <div style={{ fontSize: '0.5rem', opacity: 0.6, fontWeight: '900', marginTop: '4px' }}>
                      SPENT: {totalSpent.toFixed(2)} Cr
                    </div>
                  </div>
                  <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>{isExpanded ? '▴' : '▾'}</div>
                </div>
              </div>

              {/* SQUAD LIST (DROPDOWN) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', overflow: 'hidden' }}
                  >
                    <div style={{ padding: '20px' }}>
                      {squad.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {squad.map((item, idx) => {
                            const clashes = getBidCount(item.player_id);
                            return (
                              <div key={idx} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                padding: '12px 0', 
                                borderBottom: '1px solid rgba(255,255,255,0.05)' 
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <img 
                                    src={getPlayerImg(item.players?.name)} 
                                    style={{ 
                                      width: '45px', 
                                      height: '45px', 
                                      borderRadius: '50%', 
                                      objectFit: 'cover', 
                                      border: clashes > 1 ? '2px solid #fbbf24' : '1px solid #333',
                                      padding: '2px'
                                    }} 
                                    onError={(e) => e.target.src = '/players/place_holder.jpg'} 
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ 
                                      fontSize: '0.95rem', 
                                      fontWeight: clashes > 1 ? '900' : 'bold', 
                                      color: clashes > 1 ? '#fbbf24' : '#fff' 
                                    }}>
                                      {item.players?.name} {clashes > 1 && ' ⚠️'}
                                    </span>
                                    {getRoleBadge(item.players?.type)}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ 
                                    fontWeight: '900', 
                                    fontSize: '1.1rem', 
                                    color: clashes > 1 ? '#fbbf24' : '#22c55e' 
                                  }}>
                                    {parseFloat(item.winning_bid).toFixed(2)}
                                  </span>
                                  <div style={{ fontSize: '0.5rem', color: '#444' }}>CR</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#333', fontSize: '0.8rem', fontWeight: '900', letterSpacing: '2px' }}>
                          SQUAD UNDER CONSTRUCTION
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      
      {/* MANUAL REFRESH BUTTON */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
        <button 
          onClick={loadData}
          style={{ 
            padding: '12px 25px', 
            background: '#fbbf24', 
            color: '#000', 
            border: 'none', 
            borderRadius: '50px', 
            fontWeight: '900', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: '0.7rem'
          }}
        >
          FORCE REFRESH
        </button>
      </div>
    </div>
  );
}
