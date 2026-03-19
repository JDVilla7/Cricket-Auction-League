import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const MIN_SQUAD = 11;
const MAX_SQUAD = 15;

export default function SecretBidding() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  const [allPlayers, setAllPlayers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [displayList, setDisplayList] = useState([]);
  const [mySquad, setMySquad] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [bidAmounts, setBidAmounts] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    if (router.isReady) fetchData();
  }, [router.isReady, id]);

  const fetchData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);
    if (o?.is_locked) setHasSubmitted(true);

    const { data: p } = await supabase.from('players').select('*').order('name', { ascending: true });
    if (p) {
      setAllPlayers(p);
      const uniqueCountries = [...new Set(p.map(player => player.country?.trim()))].filter(Boolean).sort();
      setCountries(uniqueCountries);
    }

    const { data: squad } = await supabase
      .from('auction_results')
      .select('*, players(name, type, country, base_price)')
      .eq('owner_id', id)
      .eq('round_type', 'secret');
    setMySquad(squad || []);
  };

  // --- NEON ROLE BADGES HELPER ---
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
      <span style={{
        background: `${role.color}15`,
        color: role.color,
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '0.65rem',
        fontWeight: '900',
        border: `1px solid ${role.color}50`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        {role.icon} {type}
      </span>
    );
  };

  // --- AUTOMATIC IMAGE DETECTOR ---
  const getPlayerImg = (name) => {
    if (!name) return '/players/place_holder.jpg';
    const fileName = name.toLowerCase().trim().replace(/ /g, '_');
    return `/players/${fileName}.jpg`;
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (val.trim().length > 1) {
      const matches = allPlayers.filter(p => {
        const playerName = p.name ? p.name.trim().toLowerCase() : "";
        const cleanVal = val.trim().toLowerCase();
        return playerName.includes(cleanVal) && (roleFilter === 'All' || p.type?.trim() === roleFilter) && (countryFilter === 'All' || p.country?.trim() === countryFilter);
      }).slice(0, 5);
      setSuggestions(matches);
    } else setSuggestions([]);
  };

  const handleSelectSuggestion = (player) => { setSearchTerm(player.name); setSuggestions([]); };
  
  const handleFetch = () => {
    setSuggestions([]);
    const filtered = allPlayers.filter(p => {
      const cleanSearch = searchTerm.trim().toLowerCase();
      const playerName = p.name ? p.name.trim().toLowerCase() : "";
      return (cleanSearch === "" || playerName.includes(cleanSearch)) && (roleFilter === 'All' || p.type?.trim() === roleFilter) && (countryFilter === 'All' || p.country?.trim() === countryFilter);
    });
    setDisplayList(filtered);
  };

  const submitBid = async (player) => {
    if (hasSubmitted) return;
    if (mySquad.some(item => item.player_id === player.id)) return alert(`${player.name} is already in your squad!`);
    if (mySquad.length >= MAX_SQUAD) return alert(`Squad Full (Max ${MAX_SQUAD})`);
    
    const amount = bidAmounts[player.id];
    const baseInCr = player.base_price / 10000000;
    if (!amount || parseFloat(amount) < baseInCr) return alert(`Min bid is ${baseInCr.toFixed(2)} Cr`);
    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert("Insufficient Budget!");

    setLoading(true);
    const { error: resErr } = await supabase.from('auction_results').insert([{ player_id: player.id, owner_id: id, winning_bid: bidValue, round_type: 'secret' }]);
    if (!resErr) {
      await supabase.from('league_owners').update({ budget: owner.budget - bidValue }).eq('id', id);
      setBidAmounts({ ...bidAmounts, [player.id]: '' });
      setSearchTerm(''); setDisplayList([]);
      await fetchData(); 
    }
    setLoading(false);
  };

  const saveEdit = async (item) => {
    const newBid = parseFloat(editAmount);
    const diff = newBid - item.winning_bid;
    if (diff > owner.budget) return alert("Insufficient Budget!");
    await supabase.from('auction_results').update({ winning_bid: newBid }).eq('player_id', item.player_id).eq('owner_id', id);
    await supabase.from('league_owners').update({ budget: owner.budget - diff }).eq('id', id);
    setEditingId(null); fetchData();
  };

  const deletePlayer = async (item) => {
    if (!confirm(`Remove ${item.players.name}? Refund: ${item.winning_bid} Cr`)) return;
    await supabase.from('auction_results').delete().eq('player_id', item.player_id).eq('owner_id', id);
    await supabase.from('league_owners').update({ budget: owner.budget + item.winning_bid }).eq('id', id);
    fetchData();
  };

  const finalizeSquad = async () => {
    if (mySquad.length < MIN_SQUAD) return alert(`Need at least ${MIN_SQUAD} players!`);
    if (!confirm("Finalize Squad? No more changes allowed.")) return;
    await supabase.from('league_owners').update({ is_locked: true }).eq('id', id);
    setHasSubmitted(true);
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>INITIALIZING VAULT...</div>;

  const squadRemaining = MIN_SQUAD - mySquad.length;
  const statusColor = mySquad.length < MIN_SQUAD ? '#fbbf24' : '#22c55e';

  return (
    <div style={{ background: '#050505', backgroundImage: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 100%)', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* 3D HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#fff', fontSize: '2.5rem', textShadow: '0 0 20px rgba(225, 29, 72, 0.4)', margin: 0 }}>{owner.team_name}</h1>
        <div style={{ color: '#22c55e', fontSize: '1.8rem', fontWeight: 'bold' }}>{owner.budget.toFixed(2)} <span style={{fontSize:'1rem'}}>Cr</span></div>
        {hasSubmitted && <div style={{ background: '#22c55e', color: '#000', padding: '4px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.7rem', marginTop: '10px' }}>LOCKED</div>}
      </div>

      {!hasSubmitted && (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{fontSize: '0.65rem', color: '#555', fontWeight: 'bold', textTransform: 'uppercase'}}>Role</label>
              <select onChange={(e) => setRoleFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #333', borderRadius: '12px', marginTop: '5px' }}>
                <option value="All">All Roles</option>
                <option value="Batsman">Batsman</option><option value="Fast Bowler">Fast Bowler</option><option value="Spin Bowler">Spin Bowler</option><option value="All-rounder">All-rounder</option><option value="Wicket-keeper">Wicket-keeper</option>
              </select>
            </div>
            <div>
              <label style={{fontSize: '0.65rem', color: '#555', fontWeight: 'bold', textTransform: 'uppercase'}}>Nation</label>
              <select onChange={(e) => setCountryFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #333', borderRadius: '12px', marginTop: '5px' }}>
                <option value="All">All Nations</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', position: 'relative' }}>
              <label style={{fontSize: '0.65rem', color: '#555', fontWeight: 'bold', textTransform: 'uppercase'}}>Quick Search</label>
              <input type="text" placeholder="Type name..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #333', borderRadius: '12px', marginTop: '5px' }} />
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', width: '100%', background: '#111', border: '1px solid #fbbf24', borderRadius: '12px', zIndex: 999, marginTop: '8px', overflow: 'hidden' }}>
                  {suggestions.map(p => (
                    <div key={p.id} onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(p); }} style={{ padding: '15px', borderBottom: '1px solid #222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{fontWeight:'bold'}}>{p.name}</span><span style={{ fontSize: '0.7rem', color: '#666' }}>{p.country}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={handleFetch} style={{ width: '100%', padding: '18px', background: 'linear-gradient(45deg, #fbbf24, #f59e0b)', color: '#000', fontWeight: '900', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(251, 191, 36, 0.2)' }}>🔍 REVEAL PLAYERS</button>
        </div>
      )}

      {/* RESULT CARDS (3D Style) */}
      <div style={{ maxWidth: '800px', margin: '40px auto' }}>
        {displayList.map(p => (
          <div key={p.id} style={{ 
            background: 'linear-gradient(135deg, #111 0%, #0a0a0a 100%)', 
            padding: '20px', borderRadius: '20px', marginBottom: '15px', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            transition: 'transform 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px) scale(1.01)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <img src={getPlayerImg(p.name)} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #333', background:'#111' }} 
                   onError={(e) => { e.target.src = '/players/place_holder.jpg'; }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{p.name}</h4>
                <div style={{marginTop:'5px'}}>{getRoleBadge(p.type)}</div>
                <div style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '5px' }}>BASE: {(p.base_price / 10000000).toFixed(2)} Cr</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="number" step="0.05" placeholder="Bid" value={bidAmounts[p.id] || ''} onChange={(e) => setBidAmounts({ ...bidAmounts, [p.id]: e.target.value })} style={{ width: '80px', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '12px', textAlign:'center' }} />
              <button onClick={() => submitBid(p)} style={{ padding: '12px 25px', background: '#22c55e', color: '#000', fontWeight: '900', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>BUY</button>
            </div>
          </div>
        ))}
      </div>

      {/* SQUAD SECTION */}
      <div style={{ maxWidth: '800px', margin: '60px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: '#fbbf24', margin: 0, fontSize: '1.5rem' }}>DRAFT SQUAD ({mySquad.length})</h3>
            <span style={{ fontSize: '0.8rem', color: statusColor, fontWeight:'bold' }}>
              {mySquad.length < MIN_SQUAD ? `WAIT! Need ${squadRemaining} more` : (mySquad.length === MAX_SQUAD ? "SQUAD FULL" : "READY TO LOCK")}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#444' }}>GOAL: {MIN_SQUAD}-{MAX_SQUAD}</span>
        </div>

        {/* GLOWING PROGRESS BAR */}
        <div style={{ width: '100%', height: '10px', background: '#111', borderRadius: '10px', marginBottom: '40px', overflow: 'hidden', border:'1px solid #222' }}>
          <div style={{ width: `${(mySquad.length / MAX_SQUAD) * 100}%`, height: '100%', background: statusColor, boxShadow: `0 0 15px ${statusColor}`, transition: 'width 0.8s ease' }} />
        </div>

        {mySquad.map((item, i) => (
          <div key={i} style={{ 
            background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', 
            border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src={getPlayerImg(item.players?.name)} style={{ width: '45px', height: '45px', borderRadius: '10px', objectFit: 'cover', background:'#000' }} 
                   onError={(e) => { e.target.src = '/players/place_holder.jpg'; }} />
              <div>
                <h4 style={{ margin: 0 }}>{item.players?.name}</h4>
                {editingId === item.player_id ? <small style={{color: '#666'}}>Min: {(item.players.base_price / 10000000).toFixed(2)} Cr</small> : <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>}
              </div>
            </div>
            {!hasSubmitted && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {editingId === item.player_id ? (
                  <>
                    <input type="number" step="0.05" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={{ width: '80px', padding: '10px', background: '#111', color: '#fff', border: '1px solid #fbbf24', borderRadius: '10px' }} />
                    <button onClick={() => saveEdit(item)} style={{ background: '#22c55e', padding: '10px 15px', borderRadius: '10px', border: 'none', fontWeight: 'bold' }}>SAVE</button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#333', color: '#fff', padding: '10px 15px', borderRadius: '10px', border: 'none' }}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(item.player_id); setEditAmount(item.winning_bid); }} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '10px' }}>EDIT</button>
                    <button onClick={() => deletePlayer(item)} style={{ padding: '10px 18px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '10px' }}>DEL</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {!hasSubmitted && mySquad.length >= MIN_SQUAD && (
          <button onClick={finalizeSquad} style={{ width: '100%', marginTop: '40px', padding: '25px', background: 'linear-gradient(45deg, #22c55e, #16a34a)', color: '#000', fontWeight: '900', fontSize: '1.4rem', borderRadius: '20px', border: 'none', cursor: 'pointer', boxShadow: '0 15px 30px rgba(34, 197, 94, 0.3)' }}>🚀 FINAL SUBMIT SQUAD</button>
        )}
      </div>
    </div>
  );
}
