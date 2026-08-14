import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { readSupabasePublicEnv } from "./public-env"

function cleanEnv(value: string | undefined) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim()
}

export function supabaseAdminEnv() {
  // Referencias literales: Turbopack/Vercel las tienen que ver en el bundle.
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_KEY,
  )
  return { url, key }
}

export function isServiceRoleKey(key: string) {
  if (!key || key.length < 20) return false
  if (key.startsWith("http") || key.includes("/rest/")) return false
  if (key.startsWith("sb_publishable_") || key.startsWith("sb_anon_")) return false
  return key.startsWith("sb_secret_") || key.startsWith("eyJ") || key.length >= 32
}

export function isSupabaseAdminConfigured() {
  const { url, key } = supabaseAdminEnv()
  return Boolean(url && isServiceRoleKey(key))
}

export function getSupabaseAdmin(): SupabaseClient {
  const { url, key } = supabaseAdminEnv()
  if (!url || !isServiceRoleKey(key)) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en el servidor.")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cliente con el JWT del usuario (RLS de admin). No requiere service role. */
export function getSupabaseAuthed(accessToken: string): SupabaseClient {
  const { url, key } = readSupabasePublicEnv()
  if (!url || !key) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o la publishable key.")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
