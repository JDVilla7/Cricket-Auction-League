import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Auction() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState({ owner: null, player: null, highBid: 0, highBidder: null, isSold: false, soldInfo: null, squadCount: 0 });
  const [loading, setLoading] = useState(true);

  const syncStadium = async () => {
    if (!id) return;
    
    // 1. Fetch Owner & Active Player
    const { data: owner } = await supabase.from('league_owners').select('*').eq('id', id).single();
    const { data: active } = await supabase.from('active_auction').select('*').eq('id', 2).single();
    
    // 2. Fetch Squad Count for this owner
    const { count: squadCount } = await supabase.from('auction_results').select('*', { count: 'exact', head: true }).eq('owner_id', id);

    if (active?.player_id) {
      const { data: player } = await supabase.from('players').select('*').eq('id', active.player_id).single();
      const { data: highBid } = await supabase.from('bids_draft').select('*, league_owners(team_name)').eq('player_id', active.player_id).order('bid_amount', { ascending: false }).limit(1).maybeSingle();
      const { data: soldCheck } = await supabase.from('auction_results').select('*, league_owners(team_name)').eq('player_id', active.player_id).maybeSingle();

      setData({
        owner,
        player,
        highBid: highBid ? highBid.bid_amount : (player.base_price / 10000000),
        highBidder: highBid ? highBid.owner_id : null,
        isSold: !!soldCheck,
        soldInfo: soldCheck, // This contains winning_bid and team_name
        squadCount: squadCount || 0
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (router.isReady) {
      syncStadium();
      const stadiumChannel = supabase.channel('stadium_v4')
        .on('postgres_changes', { event: '*', schema: 'public' }, syncStadium)
        .subscribe();
      return () => supabase.removeChannel(stadiumChannel);
    }
  }, [router.isReady, id]);

  const handleBid = async () => {
    if (data.isSold || String(data.highBidder) === String(id)) return;
    const nextBid = data.highBidder ? data.highBid + 0.25 : data.highBid;
    if (nextBid > data.owner.budget) return alert("Insufficient Budget!");

    await supabase.from('bids_draft').upsert({ owner_id: id, player_id: data.player.id, bid_amount: nextBid }, { onConflict: 'owner_id,player_id' });
  };

  if (loading || !data.owner) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>ENTERING STADIUM...</div>;

  const isLeading = String(data.highBidder) === String(id);
  const slotsRemaining = 15 - data.squadCount; // Assuming 15 slots total

  return (
    <div style={{ background: '#050505', color: '#fff', height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e11d48', background: '#0a0a0a' }}>
        <div style={{textAlign:'left'}}>
            <h2 style={{margin:0, color:'#e11d48', fontSize:'1rem'}}>{data.owner.team_name}</h2>
            <div style={{color:'#666', fontSize:'0.7rem', fontWeight:'bold'}}>SQUAD: {data.squadCount} / 15</div>
        </div>
        <div style={{textAlign:'right'}}>
            <h2 style={{margin:0, color:'#22c55e', fontSize:'1.2rem'}}>{data.owner.budget.toFixed(2)} Cr</h2>
            <div style={{color:'#444', fontSize:'0.6rem'}}>REMAINING BUDGET</div>
        </div>
      </div>

      {/* MAIN STAGE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        
        {data.isSold ? (
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-in' }}>
            <div style={{ color: '#e11d48', fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>OFFICIALLY</div>
            <h1 style={{ fontSize: '5rem', color: '#e11d48', margin: '0', fontWeight: '900', lineHeight: '1' }}>SOLD!</h1>
            
            <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #333', borderRadius: '15px', background: '#111' }}>
                <h2 style={{ margin: 0, fontSize: '2rem' }}>{data.player?.name}</h2>
                <p style={{ margin: '5px 0', color: '#fbbf24', fontSize: '1.2rem' }}>TO {data.soldInfo?.league_owners?.team_name}</p>
                <p style={{ margin: 0, color: '#22c55e', fontWeight: 'bold' }}>FOR {data.soldInfo?.winning_bid.toFixed(2)} Cr</p>
            </div>
            <p style={{ color: '#444', marginTop: '20px' }}>Next player coming soon...</p>
          </div>
        ) : data.player ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 10vw, 4.5rem)', margin: 0, fontWeight: '900', textTransform: 'uppercase', lineHeight: '1' }}>{data.player.name}</h1>
            <p style={{ color: '#fbbf24', fontSize: '1.1rem', margin: '10px 0' }}>{data.player.type} | BASE: {(data.player.base_price / 10000000).toFixed(2)} Cr</p>

            <div style={{ background: '#111', margin: '25px auto', padding: '25px', borderRadius: '30px', border: '3px solid #fbbf24', maxWidth: '320px' }}>
               <p style={{margin:0, fontSize:'0.7rem', color:'#666', fontWeight:'bold'}}>CURRENT HIGH BID</p>
               <h2 style={{margin:0, fontSize: '4.5rem', color: '#fbbf24', lineHeight: '1'}}>{data.highBid.toFixed(2)}</h2>
               <p style={{margin:0, color:'#fbbf24', fontSize: '1rem'}}>Crore</p>
            </div>

            <button 
              disabled={isLeading || data.isSold}
              onClick={handleBid}
              style={{ width: '100%', maxWidth: '350px', padding: '20px', borderRadius: '15px', border: 'none', background: isLeading ? '#1a1a1a' : '#e11d48', color: '#fff', fontSize: '1.6rem', fontWeight: '900', transition: 'all 0.2s' }}
            >
              {isLeading ? "YOU ARE HIGH BIDDER" : `BID ${(data.highBidder ? data.highBid + 0.25 : data.highBid).toFixed(2)} Cr`}
            </button>
            <div style={{marginTop:'15px', color:'#444', fontSize:'0.8rem'}}>SLOTS REMAINING: {slotsRemaining}</div>
          </div>
        ) : <h2 style={{color:'#333'}}>READY FOR THE NEXT ROUND?</h2>}
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        body { margin: 0; padding: 0; background: #050505; }
      `}</style>
    </div>
  );
}
