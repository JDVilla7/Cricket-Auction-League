export default function Home() {
  return (
    <div style={{ backgroundColor: '#111', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#e11d48', fontSize: '3rem' }}>Cricket Auction League</h1>
      <p style={{ fontSize: '1.2rem' }}>System status: <span style={{ color: '#22c55e' }}>ONLINE</span></p>
      <div style={{ marginTop: '20px' }}>
        <a href="/login" style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
          Owner Login
        </a>
      </div>
    </div>
  )
}
