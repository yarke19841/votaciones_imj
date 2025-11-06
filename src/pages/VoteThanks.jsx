export default function VoteThanks() {
  const s = {
    page:{ minHeight:"100vh", background:"#f3f4f6", display:"grid", placeItems:"center", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:32, textAlign:"center", boxShadow:"0 8px 24px rgba(0,0,0,.06)", maxWidth:420 },
    title:{ fontSize:22, fontWeight:700, marginBottom:12 },
    text:{ fontSize:15, color:"#374151", marginBottom:16 },
    emoji:{ fontSize:48, marginBottom:12 },
    footer:{ fontSize:12, color:"#6b7280", marginTop:16 }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.emoji}>🙏</div>
        <div style={s.title}>¡Gracias por tu voto!</div>
        <div style={s.text}>Tu participación ha sido registrada con éxito.</div>
        <div style={s.footer}>IGLESIA MINISTERIO JEZREEL · Elección 2025</div>
      </div>
    </div>
  )
}
