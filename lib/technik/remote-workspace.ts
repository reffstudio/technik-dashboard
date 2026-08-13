import type { LiveEnvelope, LiveNoticeAudience, WorkspaceSnapshot } from "./live"

export type RemoteWorkspaceResponse = {
  ok: boolean
  snapshot?: WorkspaceSnapshot
  envelope?: LiveEnvelope
  error?: string
}

async function parseJson(res: Response): Promise<RemoteWorkspaceResponse> {
  try {
    return (await res.json()) as RemoteWorkspaceResponse
  } catch {
    return { ok: false, error: `Respuesta no JSON (${res.status})` }
  }
}

/** Lee el workspace compartido del servidor de prototipo. */
export async function fetchRemoteWorkspace(): Promise<RemoteWorkspaceResponse> {
  try {
    const res = await fetch("/api/workspace", {
      method: "GET",
      cache: "no-store",
    })
    const data = await parseJson(res)
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
    return data
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sin conexión al hub",
    }
  }
}

/** Publica cambios al workspace compartido (merge en servidor). */
export async function pushRemoteWorkspace(input: {
  snapshot: WorkspaceSnapshot
  originId: string
  actorName?: string
  message?: string
  audience?: LiveNoticeAudience
}): Promise<RemoteWorkspaceResponse> {
  try {
    const res = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    })
    const data = await parseJson(res)
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
    return data
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sin conexión al hub",
    }
  }
}
