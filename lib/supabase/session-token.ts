"use client"

import { getSupabaseBrowser } from "./browser"

export async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseBrowser()
  let token = (await supabase.auth.getSession()).data.session?.access_token ?? ""
  if (!token) {
    token = (await supabase.auth.refreshSession()).data.session?.access_token ?? ""
  }
  return token
}

export async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
