import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON
)

/*

import { createClient } from '@supabase/supabase-js'

// ⚠️ SOLO PRUEBA. NO DEJAR EN PRODUCCIÓN.
const URL = 'https://fepcnvcvgzxbjaoxnbcc.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcGNudmN2Z3p4Ymphb3huYmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3OTY2NDQsImV4cCI6MjA3MDM3MjY0NH0.XU27bFFiJKDFddeTK15q8lXBrOVvQtpQkycx9TEjJPE'
export const supabase = createClient(URL, KEY)

  */