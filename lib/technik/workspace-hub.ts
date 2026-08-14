import {
  normalizeDepartmentColorId,
  quotationDepartments,
} from "./data"
import {
  mergeWorkspaces,
  promoteInboxQueuedDrafts,
  type LiveEnvelope,
  type WorkspaceSnapshot,
} from "./live"
import { attachVisitPhotosToQuotations } from "./visit-photos-hub"

const DEFAULT_SETTINGS = { showNotificationBadge: true }

function emptySnapshot(): WorkspaceSnapshot {
  return {
    rev: Date.now(),
    users: [],
    clients: [],
    suppliers: [],
    catalog: [],
    quotations: [],
    projects: [],
    departments: [],
    paymentEvents: [],
    inboxEvents: [],
    expenses: [],
    treasuryMonths: [],
    treasurySeparados: [],
    apartadoMovements: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

type HubState = {
  snapshot: WorkspaceSnapshot
}

const globalKey = "__technik_workspace_hub_v2_empty__"

function getHub(): HubState {
  const g = globalThis as typeof globalThis & { [globalKey]?: HubState }
  if (!g[globalKey]) {
    g[globalKey] = { snapshot: emptySnapshot() }
  }
  return g[globalKey]
}

function withVisitPhotos(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const quotations = attachVisitPhotosToQuotations(
    promoteInboxQueuedDrafts(snapshot.quotations, snapshot.inboxEvents),
  )
  return { ...snapshot, quotations }
}

/** Snapshot actual del hub en memoria del servidor Next.js (compartido entre pestañas/dispositivos en el mismo server). */
export function readWorkspaceHub(): WorkspaceSnapshot {
  return withVisitPhotos(getHub().snapshot)
}

/**
 * Aplica un push desde un cliente: merge + nuevo rev.
 * Devuelve el snapshot canónico y el envelope para eco de avisos.
 */
export function writeWorkspaceHub(input: {
  snapshot: WorkspaceSnapshot
  originId: string
  actorName?: string
  message?: string
  audience?: LiveEnvelope["audience"]
}): { snapshot: WorkspaceSnapshot; envelope: LiveEnvelope } {
  const hub = getHub()
  const incoming: WorkspaceSnapshot = {
    ...input.snapshot,
    departments: (input.snapshot.departments ?? []).map((d) => ({
      ...d,
      colorId: normalizeDepartmentColorId(d.colorId),
    })),
    quotations: (input.snapshot.quotations ?? []).map((q) => ({
      ...q,
      departments: quotationDepartments(q),
    })),
  }
  const merged = mergeWorkspaces(hub.snapshot, incoming)
  const rev = Math.max(merged.rev, incoming.rev, Date.now())

  const lastLive = input.message
    ? {
        message: input.message,
        audience: input.audience ?? "admin",
        originId: input.originId,
        at: Date.now(),
        rev,
      }
    : merged.lastLive

  const snapshot: WorkspaceSnapshot = withVisitPhotos({
    ...merged,
    rev,
    lastLive,
  })
  hub.snapshot = snapshot

  return {
    snapshot,
    envelope: {
      type: "workspace",
      originId: input.originId,
      actorName: input.actorName,
      message: input.message,
      audience: input.audience,
      snapshot,
    },
  }
}

/** Reinicia el hub vacío. */
export function resetWorkspaceHub(): WorkspaceSnapshot {
  const hub = getHub()
  hub.snapshot = emptySnapshot()
  return hub.snapshot
}
