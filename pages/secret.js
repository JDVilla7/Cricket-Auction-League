import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

// TOURNAMENT RULES
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
    // 1. Fetch Owner & Lock Status
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);
    if (o?.is_locked) setHasSubmitted(true);

    // 2. Fetch All Players for Searching
    const { data: p } = await supabase.from('players').select('*').order('name', { ascending: true });
    if (p) {
      setAllPlayers(p);
      const uniqueCountries = [...new Set(p.map(player => player.country?.trim()))].filter(Boolean).sort();
      setCountries(uniqueCountries);
    }

    // 3. Fetch current Draft Squad
    const { data: squad } = await supabase
      .from('auction_results')
      .select('*, players(name, type, country, base_price)')
      .eq('owner_id', id)
      .eq('round_type', 'secret');
    setMySquad(squad || []);
  };

  // --- SEARCH & DROPDOWN LOGIC ---
  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (val.trim().length > 1) {
      const matches = allPlayers.filter(p => {
        const playerName = p.name ? p.name.trim().toLowerCase() : "";
        const cleanVal = val.trim().toLowerCase();
        const matchesName = playerName.includes(cleanVal);
        const matchesRole = roleFilter === 'All' || p.type?.trim() === roleFilter;
        const matchesCountry = countryFilter === 'All' || p.country?.trim() === countryFilter;
        return matchesName && matchesRole && matchesCountry;
      }).slice(0, 5);
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (player) => {
    setSearchTerm(player.name);
    setSuggestions([]);
  };

  const handleFetch = () => {
    setSuggestions([]);
    const filtered = allPlayers.filter(p => {
      const cleanSearch = searchTerm.trim().toLowerCase();
      const playerName = p.name ? p.name.trim().toLowerCase() : "";
      const matchesName = cleanSearch === "" || playerName.includes(cleanSearch);
      const matchesRole = roleFilter === 'All' || p.type?.trim() === roleFilter;
      const matchesCountry = countryFilter === 'All' || p.country?.trim() === countryFilter;
      return matchesName && matchesRole && matchesCountry;
    });
    setDisplayList(filtered);
  };

  // --- BIDDING & EDITING LOGIC ---
  const submitBid = async (player) => {
    if (hasSubmitted) return;
    if (mySquad.length >= MAX_SQUAD) return alert(`Squad Full (Max ${MAX_SQUAD})`);
    
    const amount = bidAmounts[player.id];
    const baseInCr = player.base_price / 10000000;
    
    if (!amount || parseFloat(amount) < baseInCr) {
      return alert(`Min bid is ${baseInCr.toFixed(2)} Cr (Base Price)`);
    }

    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert("Insufficient Budget!");

    setLoading(true);
    await supabase.from('auction_results').insert([{
      player_id: player.id, owner_id: id, winning_bid: bidValue, round_type: 'secret'
    }]);
    await supabase.from('league_owners').update({ budget: owner.budget - bidValue }).eq('id', id);
    
    setBidAmounts({ ...bidAmounts, [player.id]: '' });
    fetchData();
    setLoading(false);
  };

  const saveEdit = async (item) => {
    const baseInCr = item.players.base_price / 10000000;
    const newBid = parseFloat(editAmount);
    if (newBid < baseInCr) return alert(`Min bid is ${baseInCr.toFixed(2)} Cr`);
    
    const diff = newBid - item.winning_bid;
    if (diff > owner.budget) return alert("Insufficient Budget!");

    await supabase.from('auction_results').update({ winning_bid: newBid }).eq('player_id', item.player_id).eq('owner_id', id);
    await supabase.from('league_owners').update({ budget: owner.budget - diff }).eq('id', id);
    
    setEditingId(null);
    fetchData();
  };

  const deletePlayer = async (item) => {
    if (!confirm(`Remove ${item.players.name}? Refund: ${item.winning_bid} Cr`)) return;
    await supabase.from('auction_results').delete().eq('player_id', item.player_id).eq('owner_id', id);
    await supabase.from('league_owners').update({ budget: owner.budget + item.winning_bid }).eq('id', id);
    fetchData();
  };

  const finalizeSquad = async () => {
    if (mySquad.length < MIN_SQUAD) return alert(`Need at least ${MIN_SQUAD} players!`);
    if (!confirm("Finalize Squad? No more changes allowed after this.")) return;
    
    setLoading(true);
    await supabase.from('league_owners').update({ is_locked: true }).eq('id', id);
    setHasSubmitted(true);
    setLoading(false);
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>LOADING...</div>;

  const squadRemaining = MIN_SQUAD - mySquad.length;
  const statusColor = mySquad.length < MIN_SQUAD ? '#fbbf24' : '#22c55e';

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* WALLET & LOCK STATUS */}
      <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
        <h1 style={{ color: '#e11d48', margin: 0, textTransform: 'uppercase' }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: '5px 0' }}>{owner.budget.toFixed(2)} Cr</h2>
        {hasSubmitted && <div style={{ background: '#22c55e', color: '#000', display: 'inline-block', padding: '4px 12px', borderRadius: '15px', fontWeight: 'bold', fontSize: '0.7rem' }}>SQUAD FINALIZED</div>}
      </div>

      {!hasSubmitted && (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{fontSize: '0.7rem', color: '#666', fontWeight: 'bold'}}>ROLE</label>
              <select onChange={(e) => setRoleFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}>
                <option value="All">All Roles</option>
                <option value="Batsman">Batsman</option><option value="Fast Bowler">Fast Bowler</option><option value="Spin Bowler">Spin Bowler</option><option value="All-rounder">All-rounder</option><option value="Wicket-keeper">Wicket-keeper</option>
              </select>
            </div>
            <div>
              <label style={{fontSize: '0.7rem', color: '#666', fontWeight: 'bold'}}>COUNTRY</label>
              <select onChange={(e) => setCountryFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}>
                <option value="All">All Countries</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', position: 'relative' }}>
              <label style={{fontSize: '0.7rem', color: '#666', fontWeight: 'bold'}}>QUICK SEARCH</label>
              <input type="text" placeholder="Start typing name..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }} />
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', width: '100%', background: '#1a1a1a', border: '1px solid #fbbf24', borderRadius: '8px', zIndex: 999, marginTop: '5px' }}>
                  {suggestions.map(p => (
                    <div key={p.id} onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(p); }} style={{ padding: '15px', borderBottom: '1px solid #222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p.name}</span><span style={{ fontSize: '0.7rem', color: '#666' }}>{p.country}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={handleFetch} style={{ width: '100%', padding: '15px', background: '#fbbf24', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🔍 FETCH PLAYERS</button>
        </div>
      )}

      {/* RESULTS LIST */}
      <div style={{ maxWidth: '800px', margin: '30px auto' }}>
        {displayList.map(p => (
          <div key={p.id} style={{ background: '#111', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #222' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0 }}>{p.name}</h4>
              <small style={{ color: '#fbbf24' }}>Base: {(p.base_price / 10000000).toFixed(2)} Cr</small>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="number" step="0.05" placeholder="Bid" value={bidAmounts[p.id] || ''} onChange={(e) => setBidAmounts({ ...bidAmounts, [p.id]: e.target.value })} style={{ width: '80px', padding: '10px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }} />
              <button onClick={() => submitBid(p)} style={{ padding: '10px 20px', background: '#22c55e', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>BUY</button>
            </div>
          </div>
        ))}
      </div>

      <hr style={{ borderColor: '#222', margin: '40px 0' }} />

      {/* SQUAD LIST & PROGRESS */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
          <div>
            <h3 style={{ color: '#fbbf24', margin: 0 }}>MY SQUAD ({mySquad.length})</h3>
            <span style={{ fontSize: '0.7rem', color: statusColor }}>
              {mySquad.length < MIN_SQUAD ? `Need ${squadRemaining} more` : (mySquad.length === MAX_SQUAD ? "SQUAD FULL" : "Minimum met")}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#444' }}>REQ: {MIN_SQUAD}-{MAX_SQUAD}</span>
        </div>

        <div style={{ width: '100%', height: '6px', background: '#222', borderRadius: '10px', marginBottom: '30px', overflow: 'hidden' }}>
          <div style={{ width: `${(mySquad.length / MAX_SQUAD) * 100}%`, height: '100%', background: statusColor, transition: '0.5s' }} />
        </div>

        {mySquad.map((item, i) => (
          <div key={i} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0 }}>{item.players?.name}</h4>
              {editingId === item.player_id ? <small style={{color: '#666'}}>Min: {(item.players.base_price / 10000000).toFixed(2)} Cr</small> : <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>}
            </div>
            {!hasSubmitted && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {editingId === item.player_id ? (
                  <>
                    <input type="number" step="0.05" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={{ width: '80px', padding: '8px', background: '#111', color: '#fff', border: '1px solid #fbbf24', borderRadius: '5px' }} />
                    <button onClick={() => saveEdit(item)} style={{ background: '#22c55e', padding: '8px 12px', borderRadius: '5px', border: 'none', fontWeight: 'bold' }}>SAVE</button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#333', color: '#fff', padding: '8px 12px', borderRadius: '5px', border: 'none' }}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(item.player_id); setEditAmount(item.winning_bid); }} style={{ padding: '8px 15px', background: '#333', color: '#fff', border: 'none', borderRadius: '5px' }}>EDIT</button>
                    <button onClick={() => deletePlayer(item)} style={{ padding: '8px 15px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '5px' }}>DEL</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {!hasSubmitted && mySquad.length >= MIN_SQUAD && (
          <button onClick={finalizeSquad} style={{ width: '100%', marginTop: '30px', padding: '20px', background: '#22c55e', color: '#000', fontWeight: '900', fontSize: '1.2rem', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>🚀 FINAL SUBMIT SQUAD</button>
        )}
      </div>
    </div>
  );
}
