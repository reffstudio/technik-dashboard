"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  isSupabaseConfigured,
  setSupabasePublicConfig as applySupabasePublicConfig,
  supabasePublicEnv,
  type SupabasePublicConfig,
} from "./public-env"

export { isSupabaseConfigured, supabasePublicEnv, type SupabasePublicConfig }

let client: SupabaseClient | null = null

export function setSupabasePublicConfig(config: SupabasePublicConfig) {
  applySupabasePublicConfig(config)
  client = null
}

export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client
  const { url, key } = supabasePublicEnv()
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o la publishable key.")
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
