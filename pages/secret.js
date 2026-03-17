import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function SecretBidding() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Search & Filter States
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [natFilter, setNatFilter] = useState('All');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    if (router.isReady) {
      fetchInitialData();
    }
  }, [router.isReady, id]);

  const fetchInitialData = async () => {
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);
    // Fetch all players for the search list
    const { data: p } = await supabase.from('players').select('*').order('name', { ascending: true });
    setPlayers(p || []);
  };

  const submitBid = async () => {
    if (!selectedPlayer || !amount) return alert("Select a player and enter bid!");
    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert("Insufficient Budget!");

    setLoading(true);
    const { error: resErr } = await supabase.from('auction_results').insert([{
      player_id: selectedPlayer.id,
      owner_id: id,
      winning_bid: bidValue,
      round_type: 'secret'
    }]);

    if (!resErr) {
      await supabase.from('league_owners').update({ budget: owner.budget - bidValue }).eq('id', id);
      alert(`${selectedPlayer.name} added to squad!`);
      setSelectedPlayer(null);
      setAmount('');
      setSearchTerm('');
      fetchInitialData();
    } else {
      alert("Error: " + resErr.message);
    }
    setLoading(false);
  };

  // Filter Logic
  const filteredPlayers = players.filter(p => {
    const matchesName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || p.role === roleFilter;
    const matchesNat = natFilter === 'All' || p.nationality === natFilter;
    return matchesName && matchesRole && matchesNat;
  });

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>LOADING VAULT...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: 0 }}>{owner.budget.toFixed(2)} Cr</h2>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', background: '#111', padding: '25px', borderRadius: '20px', border: '1px solid #222' }}>
        <h3 style={{ color: '#fbbf24', textAlign: 'center', marginTop: 0 }}>PHASE 1 & 2 SEARCH</h3>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <select onChange={(e) => setRoleFilter(e.target.value)} style={{ flex: 1, padding: '10px', background: '#000', color: '#fff', border: '1px solid #333' }}>
            <option value="All">All Roles</option>
            <option value="Batsman">Batsman</option>
            <option value="Bowler">Bowler</option>
            <option value="All-Rounder">All-Rounder</option>
            <option value="WK">WK</option>
          </select>
          <select onChange={(e) => setNatFilter(e.target.value)} style={{ flex: 1, padding: '10px', background: '#000', color: '#fff', border: '1px solid #333' }}>
            <option value="All">All Nat.</option>
            <option value="Indian">Indian</option>
            <option value="Overseas">Overseas</option>
          </select>
        </div>

        {/* SEARCH INPUT */}
        <input 
          type="text" 
          placeholder="Type Player Name..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '15px', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '10px', marginBottom: '10px' }}
        />

        {/* SEARCH RESULTS DROPDOWN */}
        {searchTerm.length > 1 && (
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#1a1a1a', borderRadius: '10px', marginBottom: '20px', border: '1px solid #333' }}>
            {filteredPlayers.map(p => (
              <div 
                key={p.id} 
                onClick={() => { setSelectedPlayer(p); setSearchTerm(p.name); }}
                style={{ padding: '12px', borderBottom: '1px solid #222', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{p.name}</span>
                <span style={{ fontSize: '0.7rem', color: '#666' }}>{p.role} | {p.nationality}</span>
              </div>
            ))}
          </div>
        )}

        {/* SELECTION DISPLAY */}
        {selectedPlayer && (
          <div style={{ background: '#050505', padding: '15px', borderRadius: '10px', border: '1px solid #fbbf24', marginBottom: '20px', textAlign: 'center' }}>
            <h4 style={{ margin: 0 }}>SELECTED: {selectedPlayer.name}</h4>
            <small style={{ color: '#666' }}>Base Price: {(selectedPlayer.base_price / 10000000).toFixed(2)} Cr</small>
          </div>
        )}

        {/* BID AMOUNT */}
        <input 
          type="number" 
          step="0.1" 
          placeholder="Winning Bid (Cr)" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: '100%', padding: '15px', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '10px', marginBottom: '20px' }}
        />

        <button 
          disabled={loading || !selectedPlayer} 
          onClick={submitBid}
          style={{ width: '100%', padding: '18px', background: (loading || !selectedPlayer) ? '#333' : '#22c55e', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', fontSize: '1.1rem' }}
        >
          {loading ? "SUBMITTING..." : "SUBMIT SECRET BID"}
        </button>
      </div>
    </div>
  );
}
