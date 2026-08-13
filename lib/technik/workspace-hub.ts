import {
  SEED_CATALOG,
  SEED_CLIENTS,
  SEED_DEPARTMENTS,
  SEED_EXPENSES,
  SEED_PROJECTS,
  SEED_QUOTATIONS,
  SEED_SUPPLIERS,
  SEED_TREASURY_MONTHS,
  SEED_TREASURY_SEPARADOS,
  SEED_USERS,
  normalizeDepartmentColorId,
  normalizeProject,
  normalizeTreasurySeparado,
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

function seedSnapshot(): WorkspaceSnapshot {
  return {
    rev: Date.now(),
    users: SEED_USERS.map((u) => ({ ...u })),
    clients: SEED_CLIENTS.map((c) => ({ ...c, rfc: c.rfc ?? "" })),
    suppliers: SEED_SUPPLIERS.map((s) => ({ ...s })),
    catalog: SEED_CATALOG.map((i) => ({ ...i })),
    quotations: SEED_QUOTATIONS.map((q) => ({
      ...q,
      departments: quotationDepartments(q),
    })),
    projects: SEED_PROJECTS.map((p) => normalizeProject(p)),
    departments: SEED_DEPARTMENTS.filter((d) => d.id !== "soldadura_maquinados").map((d) => ({
      ...d,
      colorId: normalizeDepartmentColorId(d.colorId),
    })),
    paymentEvents: [],
    inboxEvents: [],
    expenses: SEED_EXPENSES.map((e) => ({ ...e })),
    treasuryMonths: SEED_TREASURY_MONTHS.map((m) => ({ ...m })),
    treasurySeparados: SEED_TREASURY_SEPARADOS.map((s) => normalizeTreasurySeparado(s)),
    apartadoMovements: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

type HubState = {
  snapshot: WorkspaceSnapshot
}

const globalKey = "__technik_workspace_hub_v1__"

function getHub(): HubState {
  const g = globalThis as typeof globalThis & { [globalKey]?: HubState }
  if (!g[globalKey]) {
    g[globalKey] = { snapshot: seedSnapshot() }
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
  const incoming = input.snapshot
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

/** Solo pruebas: reinicia el hub a seeds. */
export function resetWorkspaceHub(): WorkspaceSnapshot {
  const hub = getHub()
  hub.snapshot = seedSnapshot()
  return hub.snapshot
}
