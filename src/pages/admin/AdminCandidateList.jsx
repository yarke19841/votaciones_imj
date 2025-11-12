// src/pages/admin/AdminCandidateList.jsx
import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase.js"

const BUCKET = "candidate-photo" // Debe existir y ser público

function ImgWithFallback({ src, alt }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div style={{
        width:40, height:40, borderRadius:10, background:"#f3f4f6",
        display:"grid", placeItems:"center", border:"1px solid #e5e7eb"
      }}>👤</div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{width:40, height:40, borderRadius:10, objectFit:"cover", border:"1px solid #e5e7eb"}}
      onError={()=>setBroken(true)}
    />
  )
}

export default function AdminCandidateList(){
  const [elections, setElections] = useState([])
  const [selElection, setSelElection] = useState("")
  const [candidates, setCandidates] = useState([])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")

  // pool: "simulacro" | "oficial" | "*"(todos)
  const [pool, setPool] = useState("*")
  const [form, setForm] = useState({
    full_name: "",
    gender: "M",
    photo_url: "",
    description: "",
    active: true,
    pool: "oficial"
  })

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")

  const s = {
    page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
    wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
    row:{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    headerRow:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #e5e7eb" },
    headerTitle:{ fontWeight:800 },
    cardBody:{ padding:16 },
    input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none" },
    textarea:{ width:"100%", minHeight:80, padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none", resize:"vertical" },
    btn:(kind="primary")=>{
      const map={
        primary: { background:"#2563eb", border:"#2563eb", color:"#fff" },
        ghost:   { background:"#fff",   border:"#d1d5db", color:"#111827" },
        danger:  { background:"#e11d48",border:"#e11d48", color:"#fff" },
        success: { background:"#16a34a",border:"#16a34a", color:"#fff" },
      }
      const x = map[kind] || map.primary
      return {
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        padding:"10px 12px", borderRadius:12, border:`1px solid ${x.border}`,
        background:x.background, color:x.color, fontWeight:700, cursor:"pointer"
      }
    },
    tabs:{ display:"inline-flex", gap:8, alignItems:"center" },
    tab:(active)=>({
      padding:"8px 12px", borderRadius:999, fontWeight:800,
      border:`1px solid ${active ? "#2563eb" : "#e5e7eb"}`,
      background: active ? "#2563eb" : "#fff",
      color: active ? "#fff" : "#111827",
      cursor:"pointer"
    }),
    grid:{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))" },
    item:{ border:"1px solid #e5e7eb", borderRadius:14, padding:14, background:"#fff" },
    meta:{ fontSize:12, color:"#6b7280" },
    tag:(tone="neutral")=>{
      const tones = {
        neutral: { bg:"#f3f4f6", b:"#d1d5db", c:"#111827" },
        sim:     { bg:"#ecfeff", b:"#a5f3fc", c:"#0e7490" },
        off:     { bg:"#ecfdf5", b:"#a7f3d0", c:"#065f46" }
      }
      const t = tones[tone] || tones.neutral
      return { display:"inline-flex", padding:"2px 8px", borderRadius:999, fontSize:12,
               border:`1px solid ${t.b}`, background:t.bg, color:t.c, fontWeight:700 }
    },
    err:{ color:"#e11d48", fontSize:13, marginTop:8 },
    ok:{ color:"#065f46", fontSize:13, marginTop:8 },
    overlay:{
      position:"fixed", inset:0, background:"rgba(255,255,255,.6)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, fontWeight:800
    }
  }

  // INIT elecciones
  useEffect(()=>{ init() },[])
  async function init(){
    try{
      setLoading(true); setError(""); setMsg("")
      const { data, error } = await supabase
        .from("election")
        .select("id, title, status, required_male, required_female, created_at, closed_at, active_pool")
        .order("created_at", { ascending:false })
      if (error) throw error

      setElections(data || [])
      const firstOpen = (data || []).find(e => (e.status||"").toLowerCase()==="abierta")?.id
                      ?? (data?.[0]?.id ?? "")
      setSelElection(firstOpen)

      // No pisar "*" con active_pool
      const found = (data || []).find(e => e.id === firstOpen)
      if (found?.active_pool && pool !== "*") {
        setPool(found.active_pool)                  // 'simulacro' | 'oficial'
        setForm(f => ({ ...f, pool: found.active_pool }))
      }
    }catch(err){
      console.error(err)
      setError("No se pudieron cargar las elecciones.")
    }finally{
      setLoading(false)
    }
  }

  // Carga por elección/pool
  useEffect(()=>{ if(selElection) loadCandidates() }, [selElection, pool])

  // Realtime: refresca en insert/update/delete de candidate de esta elección
  useEffect(()=>{
    if (!selElection) return
    const channel = supabase
      .channel(`candidate_changes_${selElection}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidate', filter: `election_id=eq.${selElection}` },
        () => setTimeout(()=>{ loadCandidates() }, 0)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selElection, pool])

  async function loadCandidates(){
    setBusy(true); setError(""); setMsg("")
    try{
      let q = supabase
        .from("candidate")
        .select("id, created_at, active, full_name, gender, photo_url, description, pool, election_id")
        .eq("election_id", selElection)
        .order("created_at", { ascending:false })

      if (pool === "*") q = q.in("pool", ["simulacro","oficial"])
      else q = q.eq("pool", pool)

      const { data, error } = await q
      if (error) throw error

      setCandidates(data || [])
      setMsg(`Se cargaron ${data?.length || 0} candidatos.`)
    }catch(err){
      console.error(err)
      setError("Error al cargar candidatos.")
      setCandidates([])
    }finally{
      setBusy(false)
    }
  }

  function updateForm(field, value){ setForm(prev => ({ ...prev, [field]: value })) }
  function handleFileChange(e){
    const f = e.target.files?.[0] || null
    setFile(f); setPreview(f ? URL.createObjectURL(f) : "")
  }
  function slugify(txt){
    return (txt || "candidato").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)+/g,"")
  }

  async function uploadPhotoInternal({ file, electionId, fullName }){
    const ext = (file?.name?.split(".").pop() || "jpg").toLowerCase()
    const safeName = slugify(fullName)
    const path = `${electionId}/${safeName}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase
      .storage.from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = data?.publicUrl
    if (!publicUrl) throw new Error("No se pudo obtener la URL pública")
    return publicUrl
  }

  async function uploadPhoto(){
    if (!file){ setError("Selecciona una imagen primero."); return }
    if (!selElection){ setError("Selecciona una elección."); return }
    setError(""); setMsg(""); setBusy(true)
    try {
      const url = await uploadPhotoInternal({ file, electionId: selElection, fullName: form.full_name })
      setForm(prev => ({ ...prev, photo_url: url }))
      setMsg("✅ Foto subida correctamente.")
    } catch (err) {
      console.error(err); setError("No se pudo subir la foto. Revisa el bucket o el archivo.")
    } finally { setBusy(false) }
  }

  async function createCandidate(e){
    e?.preventDefault?.()
    setError(""); setMsg("")
    if (!selElection){ setError("Selecciona una elección."); return }
    if (!form.full_name.trim()){ setError("El nombre completo es obligatorio."); return }
    if (!["M","F"].includes(form.gender)){ setError("Género inválido."); return }
    if (!["simulacro","oficial"].includes(form.pool)){ setError("Lista inválida."); return }

    setBusy(true)
    try {
      let photoUrl = form.photo_url?.trim() || ""
      if (!photoUrl && file){
        const url = await uploadPhotoInternal({ file, electionId: selElection, fullName: form.full_name })
        photoUrl = url
        setForm(prev => ({ ...prev, photo_url: url }))
      }

      const payload = {
        election_id: selElection,
        full_name: form.full_name.trim(),
        gender: form.gender,
        photo_url: photoUrl || null,
        description: form.description?.trim() || null,
        active: !!form.active,
        pool: form.pool
      }

      const { error: insertError } = await supabase.from("candidate").insert(payload)
      if (insertError) throw insertError

      setMsg("✅ Candidato creado.")
      setForm({ full_name:"", gender:"M", photo_url:"", description:"", active:true, pool })
      setFile(null); setPreview("")
      await loadCandidates()
    } catch (err){
      console.error(err); setError("Ocurrió un error guardando el candidato.")
    } finally { setBusy(false) }
  }

  async function removeCandidate(c){
    if (!confirm(`¿Quitar a "${c.full_name}"?`)) return
    setError(""); setMsg(""); setBusy(true)
    try{
      const { error } = await supabase.from("candidate").delete().eq("id", c.id)
      if (error) throw error
      setMsg("Candidato eliminado.")
      await loadCandidates()
    }catch(err){
      console.error(err); setError("Error eliminando candidato.")
    }finally{
      setBusy(false)
    }
  }

  // UPDATE robusto: verifica filas afectadas y refresca
 async function moveCandidatePool(c, target){
  if (c.pool === target) return
  setBusy(true); setError(""); setMsg("")
  try{
    const { error } = await supabase
      .from("candidate")
      .update({ pool: target })
      .eq("id", c.id)     // ← sin .select()

    if (error) {
      console.error("[UPDATE ERROR]", error)
      setError(`No se pudo mover: ${error.message}`)
      return
    }

    setMsg(`✅ "${c.full_name}" movido a ${target === "simulacro" ? "Simulacro" : "Oficial"}.`)
    await loadCandidates()
  } catch(err){
    console.error("[UPDATE CATCH]", err)
    setError("Error inesperado moviendo el candidato.")
  } finally { setBusy(false) }
}


  const counts = useMemo(()=>{
    const male = candidates.filter(c => c.gender === "M" && c.active).length
    const female = candidates.filter(c => c.gender === "F" && c.active).length
    return { male, female }
  }, [candidates])

  return (
    <div style={s.page}>
      <div style={s.wrap}>

        {/* ELECCIÓN */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Candidatos</div>
            <button onClick={()=>loadCandidates()} style={s.btn("ghost")}>Actualizar</button>
          </div>
          <div style={s.cardBody}>
            <div style={s.row}>
              <div style={{minWidth:260, flex:1}}>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Elección</div>
                <select
                  style={s.input}
                  value={selElection}
                  onChange={e=>setSelElection(e.target.value)}
                >
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.status})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{display:"flex", gap:12, alignItems:"center", flexWrap:"wrap"}}>
                <span style={s.tag()}>Act H: {counts.male}</span>
                <span style={s.tag()}>Act M: {counts.female}</span>
              </div>
            </div>

            {/* Tabs pool */}
            <div style={{marginTop:12, display:"flex", alignItems:"center", gap:12}}>
              <div style={s.tabs}>
                <button style={s.tab(pool==="simulacro")} onClick={()=>{ setPool("simulacro"); setForm(f=>({ ...f, pool:"simulacro" })) }}>
                  Simulacro
                </button>
                <button style={s.tab(pool==="oficial")} onClick={()=>{ setPool("oficial"); setForm(f=>({ ...f, pool:"oficial" })) }}>
                  Oficial
                </button>
                <button style={s.tab(pool==="*")} onClick={()=> setPool("*")}>
                  Todos
                </button>
              </div>
            </div>

            {loading && <div style={{color:"#6b7280", marginTop:8}}>Cargando…</div>}
            {error && <div style={s.err}>{error}</div>}
            {msg && <div style={s.ok}>{msg}</div>}
          </div>
        </div>

        {/* FORM */}
        <div style={{...s.card, marginTop:16}}>
          <div style={s.headerRow}><div style={s.headerTitle}>Crear candidato</div></div>
          <div style={s.cardBody}>
            <form onSubmit={createCandidate} style={{display:"grid", gap:12}}>
              <div>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Nombre completo</div>
                <input
                  style={s.input}
                  value={form.full_name}
                  onChange={e=>updateForm("full_name", e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                />
              </div>

              <div className="row" style={s.row}>
                <div style={{minWidth:160}}>
                  <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Género</div>
                  <select
                    style={s.input}
                    value={form.gender}
                    onChange={e=>updateForm("gender", e.target.value)}
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>

                <div style={{minWidth:180}}>
                  <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Lista</div>
                  <select
                    style={s.input}
                    value={form.pool}
                    onChange={e=>updateForm("pool", e.target.value)}
                  >
                    <option value="simulacro">Simulacro</option>
                    <option value="oficial">Oficial</option>
                  </select>
                </div>

                <div style={{flex:1, minWidth:260}}>
                  <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Foto (archivo)</div>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={s.input} />
                </div>

                <div style={{minWidth:120}}>
                  <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Estado</div>
                  <label style={{display:"inline-flex", alignItems:"center", gap:8}}>
                    <input type="checkbox" checked={form.active} onChange={e=>updateForm("active", e.target.checked)} />
                    Activo
                  </label>
                </div>
              </div>

              {(preview || form.photo_url) && (
                <div style={{display:"flex", alignItems:"center", gap:12}}>
                  <img
                    src={preview || form.photo_url}
                    alt="preview"
                    style={{width:80, height:80, objectFit:"cover", borderRadius:12, border:"1px solid #e5e7eb"}}
                    onError={(e)=>{ e.currentTarget.style.display='none' }}
                  />
                  <div style={{fontSize:12, color:"#6b7280"}}>
                    {form.photo_url ? "Foto subida" : "Previsualización local"}
                  </div>
                </div>
              )}

              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <button type="button" onClick={uploadPhoto} style={s.btn("ghost")} disabled={!file || busy || !selElection}>
                  {busy ? "Subiendo…" : "Subir foto"}
                </button>
                <button type="submit" style={s.btn("success")} disabled={busy || !selElection}>
                  {busy ? "Guardando…" : "Guardar candidato"}
                </button>
                <button
                  type="button"
                  style={s.btn("ghost")}
                  onClick={()=>{
                    setForm({ full_name:"", gender:"M", photo_url:"", description:"", active:true, pool })
                    setFile(null); setPreview("")
                  }}
                >
                  Limpiar
                </button>
              </div>

              <div>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Descripción</div>
                <textarea
                  style={s.textarea}
                  value={form.description}
                  onChange={e=>updateForm("description", e.target.value)}
                  placeholder="Breve reseña del candidato…"
                />
              </div>
            </form>
          </div>
        </div>

        {/* LISTADO */}
        <div style={{...s.card, marginTop:16}}>
          <div style={s.headerRow}><div style={s.headerTitle}>Candidatos de la elección</div></div>
          <div style={s.cardBody}>
            {!selElection ? (
              "Selecciona una elección."
            ) : candidates.length === 0 ? (
              "Aún no hay candidatos."
            ) : (
              <div style={s.grid}>
                {candidates.map(c => (
                  <div key={c.id} style={s.item}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
                      <div style={{display:"flex", alignItems:"center", gap:10}}>
                        <ImgWithFallback src={c.photo_url} alt={c.full_name} />
                        <div>
                          <div style={{fontWeight:800}}>{c.full_name}</div>
                          <div style={s.meta}>{c.description || "Sin descripción"}</div>
                        </div>
                      </div>
                      <div style={{display:"flex", gap:6, alignItems:"center"}}>
                        <span style={s.tag(c.pool==="simulacro" ? "sim" : "off")}>
                          {c.pool === "simulacro" ? "Simulacro" : "Oficial"}
                        </span>
                        <span style={s.tag()}>{c.gender}</span>
                      </div>
                    </div>

                    <div style={{display:"flex", gap:8, marginTop:10, flexWrap:"wrap"}}>
                      <span style={s.tag()}>{c.active ? "Activo" : "Inactivo"}</span>
                      <button style={s.btn("danger")} onClick={()=>removeCandidate(c)}>Quitar</button>

                      {c.pool === "simulacro" ? (
                        <button style={s.btn("ghost")} onClick={()=>moveCandidatePool(c, "oficial")}>
                          Mover a Oficial
                        </button>
                      ) : (
                        <button style={s.btn("ghost")} onClick={()=>moveCandidatePool(c, "simulacro")}>
                          Mover a Simulacro
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {(busy || loading) && (
        <div style={s.overlay}>{loading ? "Cargando…" : "Procesando…"}</div>
      )}
    </div>
  )
}
