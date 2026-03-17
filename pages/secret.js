import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function SecretBidding() {
  const router = useRouter();
  const { id } = router.query;
  const [pid, setPid] = useState('');
  const [amount, setAmount] = useState('');
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch owner data to check budget
  const fetchOwner = async () => {
    if (id) {
      const { data } = await supabase.from('league_owners').select('*').eq('id', id).single();
      setOwner(data);
    }
  };

  useEffect(() => { 
    if (router.isReady) fetchOwner(); 
  }, [router.isReady, id]);

  const submitBid = async () => {
    if (!pid || !amount) return alert("Enter Player ID and Bid Amount!");
    
    const bidValue = parseFloat(amount);
    if (bidValue > owner.budget) return alert(`Insufficient Budget! You only have ${owner.budget} Cr`);

    setLoading(true);

    // 1. Insert into results (marking as 'secret' round)
    const { error: resErr } = await supabase.from('auction_results').insert([{
      player_id: parseInt(pid),
      owner_id: id,
      winning_bid: bidValue,
      round_type: 'secret' 
    }]);

    if (!resErr) {
      // 2. Immediately deduct from owner's budget
      const { error: budErr } = await supabase
        .from('league_owners')
        .update({ budget: owner.budget - bidValue })
        .eq('id', id);

      if (!budErr) {
        alert("BID SECURED: Player added to your squad.");
        setPid(''); setAmount('');
        fetchOwner(); // Refresh balance
      } else {
        alert("Budget Sync Error: " + budErr.message);
      }
    } else {
      alert("Submission Failed: " + resErr.message);
    }
    setLoading(false);
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'grid', placeItems:'center'}}>CONNECTING TO VAULT...</div>;

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      
      <div style={{ padding: '30px 0', borderBottom: '1px solid #222', marginBottom: '40px' }}>
        <h1 style={{ color: '#e11d48', margin: 0, fontSize: '1.5rem' }}>{owner.team_name}</h1>
        <div style={{ marginTop: '10px' }}>
          <span style={{ color: '#666', fontSize: '0.8rem' }}>AVAILABLE WALLET:</span>
          <h2 style={{ color: '#22c55e', margin: 0, fontSize: '2.2rem' }}>{owner.budget.toFixed(2)} Cr</h2>
        </div>
      </div>

      <div style={{ background: '#111', padding: '40px 20px', borderRadius: '25px', maxWidth: '400px', margin: '0 auto', border: '1px solid #333' }}>
        <h2 style={{ marginTop: 0, color: '#fbbf24' }}>PHASE 1 & 2</h2>
        <p style={{ color: '#666', marginBottom: '30px', fontSize: '0.9rem' }}>Enter the Player ID and your winning bid price.</p>
        
        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
          <label style={{ color: '#444', fontSize: '0.7rem', fontWeight: 'bold', marginLeft: '10px' }}>PLAYER ID</label>
          <input type="number" placeholder="e.g. 45" value={pid} onChange={e => setPid(e.target.value)} 
            style={{ padding: '15px', width: '100%', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '12px', fontSize: '1.1rem', marginTop: '5px' }} />
        </div>

        <div style={{ textAlign: 'left', marginBottom: '30px' }}>
          <label style={{ color: '#444', fontSize: '0.7rem', fontWeight: 'bold', marginLeft: '10px' }}>BID AMOUNT (Cr)</label>
          <input type="number" step="0.1" placeholder="e.g. 12.5" value={amount} onChange={e => setAmount(e.target.value)} 
            style={{ padding: '15px', width: '100%', boxSizing: 'border-box', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '12px', fontSize: '1.1rem', marginTop: '5px' }} />
        </div>
        
        <button disabled={loading} onClick={submitBid} 
          style={{ width: '100%', padding: '18px', background: loading ? '#333' : '#22c55e', color: '#000', fontWeight: '900', border: 'none', borderRadius: '12px', fontSize: '1.1rem', cursor: 'pointer' }}>
          {loading ? "LOCKING BID..." : "SUBMIT SECRET BID"}
        </button>
      </div>

      <div style={{ marginTop: '40px', color: '#333', fontSize: '0.7rem' }}>
        <p>Phase 1 & 2 bids are direct and final.</p>
      </div>
    </div>
  );
}
