import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabaseReady = !!(url && key)

export const supabase = url && key
  ? createClient(url, key)
  : null

export const USER_ID = import.meta.env.VITE_USER_ID || 'michael'
