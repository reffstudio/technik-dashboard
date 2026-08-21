export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error"

export type PersistResult = { ok: true } | { ok: false; error?: string }

const RETRY_MS = [400, 1200, 2400]

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export async function runWithRetries(
  job: () => Promise<PersistResult>,
  attempts = 3,
): Promise<PersistResult> {
  let last: PersistResult = { ok: false, error: "No se pudo guardar." }
  for (let i = 0; i < attempts; i++) {
    if (isOffline()) return { ok: false, error: "offline" }
    try {
      const res = await job()
      if (res.ok) return res
      last = res.error ? res : { ok: false, error: "No se pudo guardar." }
    } catch (err) {
      last = {
        ok: false,
        error: err instanceof Error ? err.message : "No se pudo guardar.",
      }
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS[i] ?? 2400))
    }
  }
  return last
}

export function persistFailedOffline(res: PersistResult) {
  return (!res.ok && res.error === "offline") || isOffline()
}
