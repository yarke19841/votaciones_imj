import { createClient } from '@supabase/supabase-js'

export const isQaEnvironment = import.meta.env.VITE_APP_ENV === 'qa' && import.meta.env.VITE_SUPABASE_URL === 'https://mldaqivoqhneqldjuryj.supabase.co'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON
)
