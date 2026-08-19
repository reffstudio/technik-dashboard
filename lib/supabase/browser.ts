"use client"

import {
  capturePasswordSetupHintFromLocation,
  clearCapturedAuthCallback,
  readCapturedAuthCallback,
  stripAuthParamsFromUrl,
} from "@/lib/technik/password-setup"
import { createClient, type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js"
import {
  isSupabaseConfigured,
  setSupabasePublicConfig as applySupabasePublicConfig,
  supabasePublicEnv,
  type SupabasePublicConfig,
} from "./public-env"

export { isSupabaseConfigured, supabasePublicEnv, type SupabasePublicConfig }

let client: SupabaseClient | null = null
let establishing: Promise<boolean> | null = null

export function setSupabasePublicConfig(config: SupabasePublicConfig) {
  applySupabasePublicConfig(config)
  client = null
}

export function getSupabaseBrowser(): SupabaseClient {
  if (typeof window !== "undefined") capturePasswordSetupHintFromLocation()
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
      flowType: "implicit",
    },
  })
  return client
}

function otpType(raw: string | null): EmailOtpType {
  if (
    raw === "invite" ||
    raw === "recovery" ||
    raw === "signup" ||
    raw === "magiclink" ||
    raw === "email_change" ||
    raw === "email"
  ) {
    return raw
  }
  return "recovery"
}

/** Confirma el enlace de invitación / recovery aunque PKCE no tenga verifier. */
export async function establishAuthSessionFromUrl(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (establishing) return establishing
  establishing = (async () => {
    const supabase = getSupabaseBrowser()
    const existing = (await supabase.auth.getSession()).data.session
    if (existing?.user) return true

    const { search, hash } = readCapturedAuthCallback()
    const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    const hashQuery = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)

    const tokenHash = query.get("token_hash") || hashQuery.get("token_hash")
    const type = otpType(query.get("type") || hashQuery.get("type"))
    const accessToken = hashQuery.get("access_token")
    const refreshToken = hashQuery.get("refresh_token")
    const code = query.get("code")

    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (!error) {
        clearCapturedAuthCallback()
        stripAuthParamsFromUrl()
        return true
      }
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (!error) {
        clearCapturedAuthCallback()
        stripAuthParamsFromUrl()
        return true
      }
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        clearCapturedAuthCallback()
        stripAuthParamsFromUrl()
        return true
      }
    }

    const session = (await supabase.auth.getSession()).data.session
    if (session?.user) {
      clearCapturedAuthCallback()
      stripAuthParamsFromUrl()
      return true
    }
    return false
  })()
  try {
    return await establishing
  } finally {
    establishing = null
  }
}
