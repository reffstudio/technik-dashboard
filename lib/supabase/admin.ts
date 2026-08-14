import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function supabaseAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  return { url, key: key.trim() }
}

export function isSupabaseAdminConfigured() {
  const { url, key } = supabaseAdminEnv()
  return Boolean(url && key)
}

export function getSupabaseAdmin(): SupabaseClient {
  const { url, key } = supabaseAdminEnv()
  if (!url || !key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en el servidor.")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
