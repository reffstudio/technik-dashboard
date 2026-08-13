"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

export function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, key }
}

export function isSupabaseConfigured() {
  const { url, key } = supabasePublicEnv()
  return Boolean(url && key)
}

export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client
  const { url, key } = supabasePublicEnv()
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o la publishable key en .env.local")
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
