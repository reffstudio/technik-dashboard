const STORAGE_KEY = "technik_must_set_password"
export const CALLBACK_CAPTURE_KEY = "technik_auth_callback"
export const PASSWORD_SETUP_PATH = "/auth/callback"

export function passwordSetupRedirect(origin: string) {
  return `${origin.replace(/\/$/, "")}${PASSWORD_SETUP_PATH}`
}

export function isPasswordSetupPath(pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  return pathname === PASSWORD_SETUP_PATH || pathname.startsWith(`${PASSWORD_SETUP_PATH}/`)
}

export function urlAsksPasswordSetup() {
  if (typeof window === "undefined") return false
  if (isPasswordSetupPath()) return true
  const blob = `${window.location.hash}${window.location.search}`
  return /access_token=|refresh_token=|[?&#]code=|token_hash=|type=invite|type=recovery|type=signup|type=magiclink|setup=password/.test(
    blob,
  )
}

export function capturePasswordSetupHintFromLocation() {
  if (typeof window === "undefined") return false
  const fromUrl = urlAsksPasswordSetup()
  if (fromUrl) {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
  }
  try {
    return fromUrl || sessionStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return fromUrl
  }
}

export function readStoredPasswordSetupHint() {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1" || isPasswordSetupPath()
  } catch {
    return isPasswordSetupPath()
  }
}

export function userMustSetPassword(user?: {
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
} | null) {
  return (
    user?.user_metadata?.must_set_password === true ||
    user?.app_metadata?.must_set_password === true
  )
}

export function clearPasswordSetupHint() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(CALLBACK_CAPTURE_KEY)
  } catch {
    /* ignore */
  }
}

export function readCapturedAuthCallback(): { search: string; hash: string } {
  if (typeof window === "undefined") return { search: "", hash: "" }
  let search = window.location.search || ""
  let hash = window.location.hash || ""
  try {
    const raw = sessionStorage.getItem(CALLBACK_CAPTURE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { s?: string; h?: string }
      if (parsed.s) search = parsed.s
      if (parsed.h) hash = parsed.h
    }
  } catch {
    /* ignore */
  }
  return { search, hash }
}

export function clearCapturedAuthCallback() {
  try {
    sessionStorage.removeItem(CALLBACK_CAPTURE_KEY)
  } catch {
    /* ignore */
  }
}

export function stripAuthParamsFromUrl() {
  if (typeof window === "undefined") return
  try {
    const url = new URL(window.location.href)
    url.hash = ""
    for (const key of ["code", "token_hash", "type", "error", "error_description", "error_code"]) {
      url.searchParams.delete(key)
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}`)
  } catch {
    /* ignore */
  }
}

export function clearPasswordSetupUrl() {
  clearPasswordSetupHint()
}
