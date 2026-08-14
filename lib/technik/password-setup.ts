const STORAGE_KEY = "technik_must_set_password"
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
  return /access_token=|refresh_token=|[?&#]code=|type=invite|type=recovery|type=signup|type=magiclink|setup=password/.test(
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
  } catch {
    /* ignore */
  }
}

export function clearPasswordSetupUrl() {
  clearPasswordSetupHint()
}
