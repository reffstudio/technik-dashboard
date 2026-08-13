export type SupabasePublicConfig = {
  url: string
  key: string
}

let override: SupabasePublicConfig | null = null

export function readSupabasePublicEnv(): SupabasePublicConfig {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim()
  return { url, key }
}

export function setSupabasePublicConfig(config: SupabasePublicConfig) {
  override = {
    url: config.url.trim(),
    key: config.key.trim(),
  }
}

export function supabasePublicEnv(): SupabasePublicConfig {
  if (override?.url && override?.key) return override
  return readSupabasePublicEnv()
}

export function isSupabaseConfigured() {
  const { url, key } = supabasePublicEnv()
  return Boolean(url && key)
}
