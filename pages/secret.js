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
  const [mySquad, setMySquad] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [bidAmounts, setBidAmounts] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  
  // State to track which player is being edited in the squad list
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

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

    const { data: squad } = await supabase
      .from('auction_results')
      .select('*, players(name, type, country, base_price)')
      .eq('owner_id', id)
      .eq('round_type', 'secret');
    setMySquad(squad || []);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (val.trim().length > 1) {
      const matches = allPlayers.filter(p => {
        const playerName = p.name?.toLowerCase().includes(val.toLowerCase());
        const matchesRole = roleFilter === 'All' || p.type?.trim() === roleFilter;
        const matchesCountry = countryFilter === 'All' || p.country?.trim() === countryFilter;
        return matchesName && matchesRole && matchesCountry;
      }).slice(0, 5);
      setSuggestions(matches);
    } else { setSuggestions([]); }
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

  // --- SUBMIT WITH BASE PRICE CHECK ---
  const submitBid = async (player) => {
    const amount = bidAmounts[player.id];
    const baseInCr = player.base_price / 10000000;
    
    if (!amount || parseFloat(amount) < baseInCr) {
      return alert(`Error: Bid must be at least ${baseInCr.toFixed(2)} Cr (Base Price)`);
    }

    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert("Insufficient Budget!");

    setLoading(true);
    const { error: resErr } = await supabase.from('auction_results').insert([{
      player_id: player.id, owner_id: id, winning_bid: bidValue, round_type: 'secret'
    }]);

    if (!resErr) {
      await supabase.from('league_owners').update({ budget: owner.budget - bidValue }).eq('id', id);
      setBidAmounts({ ...bidAmounts, [player.id]: '' });
      fetchData();
    }
    setLoading(false);
  };

  // --- SMOOTH EDIT (IN-LINE) ---
  const startEdit = (item) => {
    setEditingId(item.player_id);
    setEditAmount(item.winning_bid);
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

  if (!owner) return <div style={{background:'#000', height:'100vh'}} />;

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* WALLET */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: '5px 0' }}>{owner.budget.toFixed(2)} Cr</h2>
      </div>

      {/* SEARCH (Logic same as before) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <select onChange={(e) => setRoleFilter(e.target.value)} style={{ padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}>
              <option value="All">All Roles</option>
              <option value="Batsman">Batsman</option><option value="Fast Bowler">Fast Bowler</option><option value="Spin Bowler">Spin Bowler</option><option value="All-rounder">All-rounder</option><option value="Wicket-keeper">Wicket-keeper</option>
            </select>
            <select onChange={(e) => setCountryFilter(e.target.value)} style={{ padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}>
              <option value="All">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} style={{ gridColumn: 'span 2', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }} />
         </div>
         <button onClick={handleFetch} style={{ width: '100%', padding: '15px', background: '#fbbf24', color: '#000', fontWeight: 'bold', borderRadius: '8px', border: 'none' }}>🔍 FETCH PLAYERS</button>
      </div>

      {/* FETCHED RESULTS */}
      <div style={{ maxWidth: '800px', margin: '30px auto' }}>
        {displayList.map(p => (
          <div key={p.id} style={{ background: '#111', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #222' }}>
            <div>
              <h4 style={{ margin: 0 }}>{p.name}</h4>
              <small style={{ color: '#fbbf24' }}>Base: {(p.base_price / 10000000).toFixed(2)} Cr</small>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="number" step="0.05" placeholder="Bid" value={bidAmounts[p.id] || ''} onChange={(e) => setBidAmounts({ ...bidAmounts, [p.id]: e.target.value })} style={{ width: '70px', padding: '10px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }} />
              <button onClick={() => submitBid(p)} style={{ padding: '10px 20px', background: '#22c55e', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>BUY</button>
            </div>
          </div>
        ))}
      </div>

      {/* SQUAD LIST WITH IN-LINE EDITING */}
      <div style={{ maxWidth: '800px', margin: '40px auto' }}>
        <h3 style={{ color: '#fbbf24', borderBottom: '1px solid #222', paddingBottom: '10px' }}>SIGNED SQUAD ({mySquad.length})</h3>
        {mySquad.map((item, i) => (
          <div key={i} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0 }}>{item.players?.name}</h4>
              {editingId === item.player_id ? (
                <small style={{color: '#666'}}>Min: {(item.players.base_price / 10000000).toFixed(2)} Cr</small>
              ) : (
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.winning_bid.toFixed(2)} Cr</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {editingId === item.player_id ? (
                <>
                  <input type="number" step="0.05" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={{ width: '80px', padding: '8px', background: '#111', color: '#fff', border: '1px solid #fbbf24', borderRadius: '5px' }} />
                  <button onClick={() => saveEdit(item)} style={{ background: '#22c55e', padding: '8px 12px', borderRadius: '5px', border: 'none', fontWeight: 'bold' }}>SAVE</button>
                  <button onClick={() => setEditingId(null)} style={{ background: '#333', color: '#fff', padding: '8px 12px', borderRadius: '5px', border: 'none' }}>✕</button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(item)} style={{ padding: '8px 15px', background: '#333', color: '#fff', border: 'none', borderRadius: '5px' }}>EDIT</button>
                  <button onClick={() => deletePlayer(item)} style={{ padding: '8px 15px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '5px' }}>DEL</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
