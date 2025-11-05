// src/pages/VoteThanks.jsx
export default function VoteThanks(){
  const s = {
    page:{ minHeight:"100vh", background:"#f3f4f6", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", display:"grid", placeItems:"center", padding:"24px 16px" },
    card:{ maxWidth:420, width:"100%", background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:24, textAlign:"center", boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    title:{ fontSize:20, fontWeight:700, marginTop:6 },
    cap:{ fontSize:14, color:"#6b7280", margin:"6px 0 16px" },
    btn:{ display:"inline-block", width:"100%", padding:"12px 16px", borderRadius:12, border:"1px solid #2563eb", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer", textDecoration:"none" }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{fontSize:40}}>🙌</div>
        <div style={s.title}>Tu voto ha sido registrado</div>
        <div style={s.cap}>Dios bendiga tu servicio a la iglesia.</div>
        <a href="/" style={s.btn}>Terminar</a>
      </div>
    </div>
  )
}
