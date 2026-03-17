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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [bidAmounts, setBidAmounts] = useState({});

  useEffect(() => {
    if (router.isReady) {
      fetchData();
    }
  }, [router.isReady, id]);

  const fetchData = async () => {
    // 1. Fetch Owner
    const { data: o } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(o);

    // 2. Fetch All Players - Mapping to your 'country' column
    const { data: p, error } = await supabase.from('players').select('*').order('name', { ascending: true });
    
    if (error) {
        console.error("Supabase Error:", error);
    }

    if (p) {
      console.log("Players Loaded:", p.length);
      setAllPlayers(p);
      // Using 'country' column from your screenshot
      const uniqueCountries = [...new Set(p.map(player => player.country))].filter(Boolean).sort();
      setCountries(uniqueCountries);
    }
  };

  const handleFetch = () => {
    const filtered = allPlayers.filter(p => {
      // Matches your 'name', 'type', and 'country' columns
      const matchesName = p.name ? p.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesRole = roleFilter === 'All' || p.type === roleFilter;
      const matchesCountry = countryFilter === 'All' || p.country === countryFilter;
      return matchesName && matchesRole && matchesCountry;
    });
    setDisplayList(filtered);
  };

  const submitBid = async (player) => {
    const amount = bidAmounts[player.id];
    if (!amount || parseFloat(amount) <= 0) return alert("Enter a bid amount!");
    
    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert("Insufficient Budget!");

    if (!confirm(`Confirm buying ${player.name} for ${bidValue} Cr?`)) return;

    setLoading(true);
    const { error: resErr } = await supabase.from('auction_results').insert([{
      player_id: player.id,
      owner_id: id,
      winning_bid: bidValue,
      round_type: 'secret'
    }]);

    if (!resErr) {
      await supabase.from('league_owners').update({ budget: owner.budget - bidValue }).eq('id', id);
      alert(`${player.name} signed!`);
      setBidAmounts({ ...bidAmounts, [player.id]: '' });
      fetchData(); 
      setDisplayList(prev => prev.filter(item => item.id !== player.id));
    } else {
      alert("Error: " + resErr.message);
    }
    setLoading(false);
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>LOADING VAULT...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
        <h1 style={{ color: '#e11d48', margin: 0 }}>{owner.team_name}</h1>
        <h2 style={{ color: '#22c55e', margin: '5px 0' }}>{owner.budget.toFixed(2)} Cr</h2>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', background: '#111', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          
          <div>
            <label style={{fontSize: '0.7rem', color: '#666', fontWeight: 'bold'}}>PLAYER ROLE</label>
            <select onChange={(e) => setRoleFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px', marginTop: '5px' }}>
              <option value="All">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Fast Bowler">Fast Bowler</option>
              <option value="Spin Bowler">Spin Bowler</option>
              <option value="All-rounder">All-rounder</option>
              <option value="Wicket-keeper">Wicket-keeper</option>
            </select>
          </div>

          <div>
            <label style={{fontSize: '0.7rem', color: '#666', fontWeight: 'bold'}}>COUNTRY</label>
            <select onChange={(e) => setCountryFilter(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px', marginTop: '5px' }}>
              <option value="All">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={{fontSize: '0.7rem', color: '#666', fontWeight: 'bold'}}>SEARCH NAME</label>
            <input 
              type="text" 
              placeholder="Search Virat, Shreyas, etc..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px', marginTop: '5px' }}
            />
          </div>
        </div>

        <button onClick={handleFetch} style={{ width: '100%', padding: '15px', background: '#fbbf24', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
          🔍 FETCH PLAYERS
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '30px auto' }}>
        {displayList.length > 0 ? (
          displayList.map(p => (
            <div key={p.id} style={{ background: '#111', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #222' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{p.name}</h4>
                <small style={{ color: '#666' }}>{p.type} | {p.country} | Base: {(p.base_price / 10000000).toFixed(2)} Cr</small>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  placeholder="Bid" 
                  value={bidAmounts[p.id] || ''}
                  onChange={(e) => setBidAmounts({ ...bidAmounts, [p.id]: e.target.value })}
                  style={{ width: '80px', padding: '10px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '8px' }}
                />
                <button onClick={() => submitBid(p)} style={{ padding: '10px 20px', background: '#22c55e', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px' }}>
                  BUY
                </button>
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', color: '#444', marginTop: '40px' }}>Use filters and click Fetch.</p>
        )}
      </div>
    </div>
  );
}
