export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error"

export type PersistResult = { ok: true } | { ok: false; error?: string }

const RETRY_MS = [400]
const ATTEMPTS = 2
const JOB_MS = 12_000

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export function isNetworkPersistError(error?: string) {
  if (!error) return false
  const m = error.toLowerCase()
  return (
    error === "offline" ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("load failed") ||
    m.includes("fetch failed") ||
    m.includes("err_connection") ||
    m.includes("econnreset") ||
    m.includes("econnrefused")
  )
}

export function displayPersistError(error?: string) {
  if (!error) return "No se pudo guardar. Recarga e inténtalo de nuevo."
  if (isNetworkPersistError(error)) {
    return "No se pudo conectar. Reintenta; si sigue, recarga."
  }
  if (/cannot read propert/i.test(error)) {
    return "No se pudo guardar. Recarga e inténtalo de nuevo."
  }
  if (/^no se pudo guardar/i.test(error)) return error
  return `No se pudo guardar · ${error}`
}

function persistCaughtMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : ""
  return displayPersistError(msg)
}

function withTimeout(job: Promise<PersistResult>, ms: number): Promise<PersistResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: "El guardado tardó demasiado. Reintenta." })
    }, ms)
    job
      .then((res) => {
        clearTimeout(timer)
        resolve(
          res && typeof res.ok === "boolean"
            ? res
            : { ok: false, error: "No se pudo guardar." },
        )
      })
      .catch((err) => {
        clearTimeout(timer)
        resolve({ ok: false, error: persistCaughtMessage(err) })
      })
  })
}

export async function runWithRetries(
  job: () => Promise<PersistResult>,
  attempts = ATTEMPTS,
): Promise<PersistResult> {
  let last: PersistResult = { ok: false, error: "No se pudo guardar." }
  for (let i = 0; i < attempts; i++) {
    if (isOffline()) return { ok: false, error: "offline" }
    try {
      const res = await withTimeout(job(), JOB_MS)
      if (res.ok) return res
      last = res.error ? res : { ok: false, error: "No se pudo guardar." }
    } catch (err) {
      last = { ok: false, error: persistCaughtMessage(err) }
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS[i] ?? 400))
    }
  }
  return last
}

export function persistFailedOffline(res: PersistResult) {
  return (!res.ok && isNetworkPersistError(res.error)) || isOffline()
}
