import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authStorage } from './authStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase ist nicht konfiguriert')
  return supabase
}
