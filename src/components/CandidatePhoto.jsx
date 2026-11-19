import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Storage checks the active round or administrator permission on each download.
export default function CandidatePhoto({ path, name = '', className = '' }) {
  const [source, setSource] = useState(null)
  useEffect(() => {
    let alive = true, objectUrl
    setSource(null)
    if (path && !/^https?:\/\//i.test(path)) {
      supabase.storage.from('voting-photos').download(path).then(({ data, error }) => {
        if (!alive || error || !data) return
        objectUrl = URL.createObjectURL(data)
        setSource(objectUrl)
      }).catch(() => {})
    }
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path])
  return source
    ? <img className={className} src={source} alt={`Foto de ${name}`} onError={() => setSource(null)}/>
    : <div className={`photo-placeholder ${className}`} role="img" aria-label={`Foto no disponible: ${name}`}>Foto no disponible</div>
}
