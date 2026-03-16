/* pages/auction.js */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [owner, setOwner] = useState(null);
  const [activePlayer, setActivePlayer] = useState(null);
  const [bidValue, setBidValue] = useState('');
  const [currentHighBid, setCurrentHighBid] = useState(0);

  const fetchData = async () => {
    if (!id) return;
    const { data: oData } = await supabase.from('league_owners').select('*').eq('id', id).single();
    setOwner(oData);

    const { data: auctionRow } = await supabase.from('active_auction').select('*').eq('id', 2).maybeSingle();
    if (auctionRow?.player_id) {
      const { data: pData } = await supabase.from('players').select('*').eq('id', auctionRow.player_id).single();
      setActivePlayer(pData);

      // Fetch the MAX bid for this player to show everyone
      const { data: highBid } = await supabase
        .from('bids_draft')
        .select('bid_amount')
        .eq('player_id', auctionRow.player_id)
        .order('bid_amount', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setCurrentHighBid(highBid ? highBid.bid_amount : 0);
    } else {
      setActivePlayer(null);
    }
  };

  useEffect(() => {
    if (router.isReady) fetchData();
    const channel = supabase.channel('room-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'bids_draft' }, fetchData).on('postgres_changes', { event: '*', schema: 'public', table: 'active_auction' }, fetchData).subscribe();
    return () => supabase.removeChannel(channel);
  }, [router.isReady, id]);

  const placeBid = async () => {
    const val = parseFloat(bidValue);
    if (val <= currentHighBid) return alert("Bid must be higher than current high bid!");
    if (val > owner.budget) return alert("Insufficient budget!");

    await supabase.from('bids_draft').upsert({
      owner_id: owner.id,
      player_id: activePlayer.id,
      bid_amount: val
    }, { onConflict: 'owner_id,player_id' });
    setBidValue('');
  };

  if (!owner) return <div style={{background:'#000', color:'#fff', height:'100vh', padding:'20px'}}>Loading...</div>;

  return (
    <div style={{ backgroundColor: '#0a0a0a', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', textAlign:'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '10px' }}>
        <h2 style={{color:'#e11d48'}}>{owner.team_name}</h2>
        <h2 style={{color:'#22c55e'}}>{owner.budget.toFixed(2)} Cr Left</h2>
      </div>

      {activePlayer ? (
        <div style={{marginTop: '40px'}}>
          <h1 style={{fontSize:'3rem'}}>{activePlayer.name}</h1>
          <div style={{ background: '#111', padding: '20px', borderRadius: '15px', display: 'inline-block', margin: '20px 0', border: '2px solid #fbbf24' }}>
            <p style={{ margin: 0, color: '#666' }}>CURRENT HIGH BID</p>
            <h2 style={{ margin: 0, color: '#fbbf24', fontSize: '3rem' }}>{currentHighBid.toFixed(2)} Cr</h2>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <input type="number" step="0.1" value={bidValue} onChange={(e) => setBidValue(e.target.value)} style={{ padding: '15px', width: '100px', borderRadius: '8px' }} placeholder="Your Bid" />
            <button onClick={placeBid} style={{ padding: '15px 30px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>BID</button>
          </div>
        </div>
      ) : (
        <h3 style={{marginTop:'100px', color:'#444'}}>Waiting for Next Player...</h3>
      )}
    </div>
  );
}
