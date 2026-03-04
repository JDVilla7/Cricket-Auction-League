export default function Home() {
  return (
    <div style={{ backgroundColor: '#111', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#e11d48', fontSize: '3rem' }}>Cricket Auction League</h1>
      <p>System status: <span style={{ color: '#22c55e' }}>ONLINE</span></p>
      <a href="/login" style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: '#e11d48', color: 'white', textDecoration: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
        Go to Owner Login
      </a>
    </div>
  );
}
