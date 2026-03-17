import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function SecretBidding() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [allPlayers, setAllPlayers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [displayList, setDisplayList] = useState([]);
  const [mySquad, setMySquad] = useState([]); // Track signed players
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [bidAmounts, setBidAmounts] = useState({});
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (router.isReady) fetchData();
  }, [router.isReady, id]);

  const fetchData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);

    const { data: p } = await supabase.from('players').select('*').order('name', { ascending: true });
    if (p) {
      setAllPlayers(p);
      const uniqueCountries = [...new Set(p.map(player => player.country?.trim()))].filter(Boolean).sort();
      setCountries(uniqueCountries);
    }

    // Fetch existing squad for this owner (Secret Round only)
    const { data: squad } = await supabase
      .from('auction_results')
      .select('*, players(name, type, country)')
      .eq('owner_id', id)
      .eq('round_type', 'secret');
    setMySquad(squad || []);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (val.trim().length > 1) {
      const matches = allPlayers.filter(p => {
        const matchesName = p.name?.toLowerCase().includes(val.toLowerCase());
        const matchesRole = roleFilter === 'All' || p.type?.trim() === roleFilter;
        const matchesCountry = countryFilter === 'All' || p.country?.trim() === countryFilter;
        return matchesName && matchesRole && matchesCountry;
      }).slice(0, 5);
      setSuggestions(matches);
    } else { setSuggestions([]); }
  };

  const handleSelectSuggestion = (player) => {
    setSearchTerm(player.name);
    setSuggestions([]);
  };

  const handleFetch = () => {
    setSuggestions([]);
    const filtered = allPlayers.filter(p => {
      const cleanSearch = searchTerm.trim().toLowerCase();
      const matchesName = cleanSearch === "" || p.name?.toLowerCase().includes(cleanSearch);
      const matchesRole = roleFilter === 'All' || p.type?.trim() === roleFilter;
      const matchesCountry = countryFilter === 'All' || p.country?.trim() === countryFilter;
      return matchesName && matchesRole && matchesCountry;
    });
    setDisplayList(filtered);
  };

  // --- NEW: SMOOTH SUBMIT (NO POPUP) ---
  const submitBid = async (player) => {
    const amount = bidAmounts[player.id];
    if (!amount || parseFloat(amount) <= 0) return alert("Enter bid!");
    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert("Insufficient Budget!");

    setLoading(true);
    const { error: resErr } = await supabase.from('auction_results').insert([{
      player_id: player.id, owner_id: id, winning_bid: bidValue, round_type: 'secret'
    }]);

    if (!resErr) {
      await supabase.from('league_owners').update({ budget: owner.budget - bidValue }).eq('id', id);
      setBidAmounts({ ...bidAmounts, [player.id]: '' });
      fetchData(); // Refresh wallet and squad list
    }
    setLoading(false);
  };

  // --- NEW: DELETE PLAYER ---
  const deletePlayer = async (item) => {
    if (!confirm(`Remove ${item.players.name}? Budget will be refunded.`)) return;
    await supabase.from('auction_results').delete().eq('player_id', item.player_id).eq('owner_id', id);
    await supabase.from('league_owners').update({ budget: owner.budget + item.winning_bid }).eq('id', id);
    fetchData();
  };

  // --- NEW: EDIT BID ---
  const editBid = async (item) => {
    const newBid = prompt(`Enter new bid for ${item.players.name}:`, item.winning_bid);
    if (!newBid || isNaN(newBid)) return;
    
    const diff = parseFloat(newBid) - item.winning_bid;
    if (diff > owner.budget) return alert("Insufficient Budget!");

    await supabase.from('auction_results').update({ winning_bid: parseFloat(newBid) }).eq('player_id', item.player_id).eq('owner_id', id);
    await supabase.from('league_owners').update({ budget: owner.budget - diff }).eq('id', id);
    fetchData();
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>LOADING VAULT...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: '5px 0' }}>{owner.budget.toFixed(2)} Cr</h2>
      </div>

      {/* SEARCH/FILTER BOX (Logic Unchanged) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{fontSize: '0.7rem', color: '#666'}}>ROLE</label>
            <select onChange={(e) => setRoleFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}>
              <option value="All">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Fast Bowler">Fast Bowler</option>
              <option value="Spin Bowler">Spin Bowler</option>
              <option value="All-rounder">All-rounder</option>
              <option value="Wicket-keeper">Wicket-keeper</option>
            </select>
          </div>
          <div>
            <label style={{fontSize: '0.7rem', color: '#666'}}>COUNTRY</label>
            <select onChange={(e) => setCountryFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}>
              <option value="All">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2', position: 'relative' }}>
            <label style={{fontSize: '0.7rem', color: '#666'}}>QUICK SEARCH</label>
            <input type="text" placeholder="Start typing..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }} />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', width: '100%', background: '#1a1a1a', border: '1px solid #fbbf24', borderRadius: '8px', zIndex: 999, marginTop: '5px' }}>
                {suggestions.map(p => (
                  <div key={p.id} onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(p); }} style={{ padding: '15px', borderBottom: '1px solid #222', cursor: 'pointer' }}>
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={handleFetch} style={{ width: '100%', padding: '15px', background: '#fbbf24', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🔍 FETCH PLAYERS</button>
      </div>

      {/* FETCHED RESULTS */}
      <div style={{ maxWidth: '800px', margin: '30px auto' }}>
        {displayList.map(p => (
          <div key={p.id} style={{ background: '#111', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #222' }}>
            <div>
              <h4 style={{ margin: 0 }}>{p.name}</h4>
              <small style={{ color: '#666' }}>{p.type} | {p.country} | {(p.base_price / 10000000).toFixed(2)} Cr</small>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="number" placeholder="Bid" value={bidAmounts[p.id] || ''} onChange={(e) => setBidAmounts({ ...bidAmounts, [p.id]: e.target.value })} style={{ width: '70px', padding: '10px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }} />
              <button onClick={() => submitBid(p)} style={{ padding: '10px 20px', background: '#22c55e', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>BUY</button>
            </div>
          </div>
        ))}
      </div>

      <hr style={{ borderColor: '#222', margin: '40px 0' }} />

      {/* --- NEW: MY SIGNED SQUAD --- */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ color: '#fbbf24' }}>MY SIGNED PLAYERS ({mySquad.length})</h3>
        {mySquad.length > 0 ? mySquad.map((item, i) => (
          <div key={i} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0 }}>{item.players?.name}</h4>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => editBid(item)} style={{ padding: '8px 15px', background: '#333', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.8rem' }}>EDIT</button>
              <button onClick={() => deletePlayer(item)} style={{ padding: '8px 15px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.8rem' }}>DEL</button>
            </div>
          </div>
        )) : <p style={{color:'#444'}}>No players signed yet.</p>}
      </div>
    </div>
  );
}
