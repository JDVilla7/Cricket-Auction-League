import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

// --- CONFIGURATION ---
const TOURNAMENT_NAME = "MY LEAGUE 2026"; // Change this to your actual league name

export default function Dashboard() {
  const [owners, setOwners] = useState([]);
  const [results, setResults] = useState([]);

  const loadData = async () => {
    // 1. Fetch Owners
    const { data: o } = await supabase.from('league_owners').select('*').order('team_name');
    
    // 2. Fetch ALL Results with Player Details
    const { data: r, error } = await supabase
      .from('auction_results')
      .select('*, players(name, type)');

    if (error) console.error("Data Fetch Error:", error);

    setOwners(o || []);
    setResults(r || []);
  };

  useEffect(() => {
    loadData();
    // Real-time listener for any auction changes
    const sub = supabase.channel('dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, loadData)
      .subscribe();
    
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
      'Batsman': { color: '#ef4444' },
      'Fast Bowler': { color: '#3b82f6' },
      'Spin Bowler': { color: '#60a5fa' },
      'All-rounder': { color: '#fbbf24' },
      'Wicket-keeper': { color: '#10b981' }
    };
    const role = roles[type] || { color: '#666' };
    return (
      <span style={{ 
        color: role.color, 
        fontSize: '0.6rem', 
        fontWeight: '900', 
        border: `1px solid ${role.color}`, 
        padding: '1px 5px', 
        borderRadius: '3px',
        marginRight: '8px',
        textTransform: 'uppercase'
      }}>
        {type ? type.substring(0, 3) : 'OTH'}
      </span>
    );
  };

  return (
    <div style={{ 
      backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      color: '#fff', 
      minHeight: '100vh', 
      padding: '40px', 
      fontFamily: '"Orbitron", sans-serif' 
    }}>
      
      {/* GOOGLE FONTS & GLOBAL STYLES */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');
        
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 10px; }
      `}</style>

      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            fontSize: '3.5rem', 
            color: '#fbbf24', 
            margin: 0, 
            textShadow: '0 0 30px rgba(251, 191, 36, 0.4)',
            letterSpacing: '-2px',
            fontWeight: '900'
          }}>
          {TOURNAMENT_NAME}
        </motion.h1>
        <p style={{ color: '#666', fontWeight: 'bold', letterSpacing: '5px', textTransform: 'uppercase', fontSize: '0.8rem' }}>
          War Room Live Squad Tracker
        </p>
      </div>

      {/* MAIN GRID */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
        gap: '30px' 
      }}>
        {owners.map((owner, index) => {
          const squad = results.filter(res => String(res.owner_id) === String(owner.id));
          const totalSpent = squad.reduce((sum, item) => sum + (parseFloat(item.winning_bid) || 0), 0);

          return (
            <motion.div 
              key={owner.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                backdropFilter: 'blur(15px)',
                borderRadius: '25px', 
                border: owner.is_locked ? '2px solid #22c55e' : '1px solid rgba(251,191,36,0.3)',
                padding: '25px', 
                position: 'relative',
                boxShadow: owner.is_locked ? '0 0 30px rgba(34, 197, 94, 0.2)' : '0 20px 50px rgba(0,0,0,0.5)',
              }}
            >
              {/* TEAM NAME & BUDGET HEADER */}
              <h2 style={{ margin: '0 0 20px 0', color: '#e11d48', fontSize: '1.8rem', fontWeight: '900', textTransform: 'uppercase' }}>
                {owner.team_name}
              </h2>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '20px', 
                background: 'rgba(0,0,0,0.4)',
                padding: '15px',
                borderRadius: '15px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div>
                  <small style={{ color: '#444', display: 'block', fontSize: '0.6rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Spent</small>
                  <span style={{ color: '#fff', fontWeight: '900', fontSize: '1.4rem' }}>{totalSpent.toFixed(2)} <small style={{fontSize:'0.7rem'}}>Cr</small></span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ color: '#444', display: 'block', fontSize: '0.6rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Remaining</small>
                  <span style={{ color: '#22c55e', fontWeight: '900', fontSize: '1.4rem' }}>{owner.budget.toFixed(2)} <small style={{fontSize:'0.7rem'}}>Cr</small></span>
                </div>
              </div>

              {/* SQUAD COUNT & LOCK BADGE */}
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fbbf24', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '1px' }}>
                  SQUAD: {squad.length} / 15
                </span>
                {owner.is_locked && (
                  <span style={{ 
                    background: '#22c55e', 
                    color: '#000', 
                    fontSize: '0.6rem', 
                    padding: '3px 10px', 
                    borderRadius: '5px', 
                    fontWeight: '900',
                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                  }}>LOCKED</span>
                )}
              </div>

              {/* PLAYER LIST */}
              <div style={{ 
                maxHeight: '380px', 
                overflowY: 'auto', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '15px', 
                padding: '10px',
                border: '1px solid rgba(255,255,255,0.02)'
              }}>
                {squad.length > 0 ? squad.map((item, idx) => {
                  const clashes = getBidCount(item.player_id);
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '12px 8px', 
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: '0.9rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img 
                          src={getPlayerImg(item.players?.name)} 
                          style={{ 
                            width: '35px', 
                            height: '35px', 
                            borderRadius: '50%', 
                            objectFit: 'cover', 
                            background:'#111',
                            border: clashes > 1 ? '1px solid #fbbf24' : '1px solid #333'
                          }}
                          onError={(e) => e.target.src = '/players/place_holder.jpg'}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ 
                            color: clashes > 1 ? '#fbbf24' : '#fff', 
                            fontWeight: clashes > 1 ? '900' : 'normal',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {item.players?.name || `ID: ${item.player_id}`} {clashes > 1 && ' ⚠️'}
                          </span>
                          <div style={{ marginTop: '2px' }}>{getRoleBadge(item.players?.type)}</div>
                        </div>
                      </div>
                      <span style={{ 
                        fontWeight: '900', 
                        color: clashes > 1 ? '#fbbf24' : '#666',
                        fontSize: '1rem'
                      }}>
                        {parseFloat(item.winning_bid).toFixed(2)}
                      </span>
                    </div>
                  );
                }) : (
                  <div style={{ color: '#222', textAlign: 'center', padding: '40px', fontSize: '0.8rem', fontWeight: '900', letterSpacing: '2px' }}>
                    SQUAD EMPTY
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* FLOATING REFRESH BUTTON */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={loadData} 
        style={{ 
          position: 'fixed', 
          bottom: '30px', 
          right: '30px', 
          padding: '18px 40px', 
          background: 'linear-gradient(45deg, #fbbf24, #f59e0b)', 
          color: '#000', 
          border: 'none', 
          borderRadius: '50px', 
          fontWeight: '900', 
          cursor: 'pointer',
          boxShadow: '0 15px 40px rgba(251, 191, 36, 0.4)',
          fontSize: '0.9rem',
          letterSpacing: '1px'
        }}
      >
        REFRESH WAR ROOM
      </motion.button>
    </div>
  );
}
