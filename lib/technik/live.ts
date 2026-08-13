import type {
  CatalogItem,
  Client,
  DepartmentConfig,
  ExpenseEntry,
  ApartadoMovement,
  PaymentEvent,
  Project,
  Quotation,
  Supplier,
  TreasuryMonth,
  TreasurySeparado,
  User,
} from "./data"
import { parseActivityMs, type InboxEvent } from "./notifications"

export const LIVE_CHANNEL = "technik-live-v1"
export const WORKSPACE_STORAGE_KEY = "technik-workspace-v1"

export type WorkspaceSettings = {
  /** Mostrar badge de notificaciones en el header */
  showNotificationBadge: boolean
}

/** Quién debe ver el ticker en vivo junto a la campana. Empleados nunca ven avisos. */
export type LiveNoticeAudience = "all" | "admin" | "employee" | "except_self"

export type LivePulse = {
  message: string
  audience: LiveNoticeAudience
  originId: string
  at: number
  /** Rev del snapshot que originó este aviso (evita re-mostrar en saves posteriores). */
  rev: number
}

export type WorkspaceSnapshot = {
  rev: number
  users: User[]
  clients: Client[]
  suppliers: Supplier[]
  catalog: CatalogItem[]
  quotations: Quotation[]
  projects: Project[]
  departments: DepartmentConfig[]
  paymentEvents?: PaymentEvent[]
  /** Bandeja admin (envíos a revisión, cobros, hitos). */
  inboxEvents?: InboxEvent[]
  /** Egresos del libro de tesorería (banco / efectivo). */
  expenses?: ExpenseEntry[]
  /** Aperturas por mes calendario. */
  treasuryMonths?: TreasuryMonth[]
  /** Separados de caja (nombre + % o monto). */
  treasurySeparados?: TreasurySeparado[]
  /** Movimientos (entradas/salidas) de apartados. */
  apartadoMovements?: ApartadoMovement[]
  settings?: WorkspaceSettings
  /** Último aviso en vivo (para sync por localStorage entre pestañas). */
  lastLive?: LivePulse
}

export type LiveNotice = {
  id: string
  text: string
  at: number
}

export type LiveEnvelope = {
  type: "workspace"
  originId: string
  actorName?: string
  message?: string
  /** Destinatarios del mensaje en vivo. Por defecto: admins. */
  audience?: LiveNoticeAudience
  snapshot: WorkspaceSnapshot
}

/**
 * Empleados: nunca.
 * `except_self`: otros admins (no la pestaña que originó el cambio).
 * `admin` / `all`: cualquier admin.
 * `employee`: legacy, desactivado (nadie).
 */
export function liveNoticeVisibleToRole(
  role: "admin" | "empleado" | undefined,
  audience: LiveNoticeAudience | undefined,
  isOrigin: boolean,
): boolean {
  if (role !== "admin") return false
  const target = audience ?? "admin"
  if (target === "employee") return false
  if (target === "except_self") return !isOrigin
  return true
}

export function createOriginId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadWorkspace(): WorkspaceSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkspaceSnapshot
    if (!parsed || typeof parsed.rev !== "number" || !Array.isArray(parsed.projects)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch (err) {
    console.warn("[technik-live] No se pudo guardar workspace (¿cuota localStorage?)", err)
  }
}

function preferByUpdatedAt<T extends { updatedAt?: string; id: string }>(a: T, b: T): T {
  const aAt = a.updatedAt ?? ""
  const bAt = b.updatedAt ?? ""
  if (aAt !== bAt) return aAt >= bAt ? a : b
  return b
}

function mergeVisitPhotos(
  left: Quotation["visitPhotos"],
  right: Quotation["visitPhotos"],
): Quotation["visitPhotos"] {
  const map = new Map<string, NonNullable<Quotation["visitPhotos"]>[number]>()
  for (const p of left ?? []) map.set(p.id, p)
  for (const p of right ?? []) map.set(p.id, p)
  if (map.size === 0) return left ?? right
  return Array.from(map.values()).sort((a, b) => a.takenAt.localeCompare(b.takenAt))
}

function quotePipelineRank(status: Quotation["status"]) {
  if (status === "closed") return 4
  if (status === "approved") return 3
  if (status === "pending_review") return 2
  if (status === "draft") return 0
  return 1
}

/**
 * Un envío a revisión no puede perder contra un borrador “más nuevo”
 * (autosave, fotos de visita con timestamp UTC, etc.).
 */
function preferQuote(a: Quotation, b: Quotation): Quotation {
  const aRank = quotePipelineRank(a.status)
  const bRank = quotePipelineRank(b.status)
  let winner = a
  if (aRank !== bRank) {
    winner = aRank > bRank ? a : b
  } else {
    const aMs = parseActivityMs(a.updatedAt ?? a.createdAt)
    const bMs = parseActivityMs(b.updatedAt ?? b.createdAt)
    if (aMs !== bMs) winner = aMs >= bMs ? a : b
    else {
      const aHist = a.history?.length ?? 0
      const bHist = b.history?.length ?? 0
      winner = aHist >= bHist ? a : b
    }
  }
  const history =
    (a.history?.length ?? 0) >= (b.history?.length ?? 0) ? a.history : b.history
  return {
    ...winner,
    history: history ?? winner.history,
    visitPhotos: mergeVisitPhotos(a.visitPhotos, b.visitPhotos),
  }
}

/** Si la campana ya registró el envío, el borrador pasa a cola de revisión. */
export function promoteInboxQueuedDrafts(
  quotations: Quotation[],
  inboxEvents: InboxEvent[] | undefined,
): Quotation[] {
  if (!inboxEvents?.length) return quotations
  return quotations.map((q) => {
    if (q.status !== "draft") return q
    const queued = inboxEvents.some((e) => {
      if (e.kind !== "review_queue") return false
      return (
        e.href?.id === q.id ||
        e.href?.id === q.reference ||
        e.id === `review-${q.id}` ||
        e.id === `review-${q.reference}` ||
        e.id.startsWith(`review-${q.id}-`) ||
        e.id.startsWith(`review-${q.reference}-`)
      )
    })
    if (!queued) return q
    return { ...q, status: "pending_review" }
  })
}

function mergeById<T extends { id: string }>(
  left: T[] | null | undefined,
  right: T[] | null | undefined,
  prefer: (a: T, b: T) => T,
): T[] {
  const map = new Map<string, T>()
  for (const item of left ?? []) map.set(item.id, item)
  for (const item of right ?? []) {
    const prev = map.get(item.id)
    map.set(item.id, prev ? prefer(prev, item) : item)
  }
  return Array.from(map.values())
}

/**
 * Une dos snapshots para que una pestaña con estado viejo no borre
 * cotizaciones/proyectos creados en otra pestaña.
 */
export function mergeWorkspaces(
  stored: WorkspaceSnapshot,
  incoming: WorkspaceSnapshot,
): WorkspaceSnapshot {
  const paymentEvents = mergeById(
    stored.paymentEvents,
    incoming.paymentEvents,
    (a, b) => ((a.at ?? "") >= (b.at ?? "") ? a : b),
  )

  const expenses = mergeById(
    stored.expenses,
    incoming.expenses,
    (a, b) => ((a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b),
  )

  const treasuryMonths = mergeTreasuryMonths(
    stored.treasuryMonths,
    incoming.treasuryMonths,
  )

  const lastLive =
    (incoming.lastLive?.at ?? 0) >= (stored.lastLive?.at ?? 0)
      ? incoming.lastLive ?? stored.lastLive
      : stored.lastLive ?? incoming.lastLive

  const inboxEvents = mergeById(stored.inboxEvents, incoming.inboxEvents, (a, b) =>
    (a.at ?? "") >= (b.at ?? "") ? a : b,
  )
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 80)

  return {
    rev: Math.max(stored.rev ?? 0, incoming.rev ?? 0),
    users: mergeById(stored.users, incoming.users, (a, b) => b),
    clients: mergeById(stored.clients, incoming.clients, preferByUpdatedAt),
    suppliers: mergeById(stored.suppliers, incoming.suppliers, (a, b) => b),
    catalog: mergeById(stored.catalog, incoming.catalog, (a, b) => b),
    quotations: promoteInboxQueuedDrafts(
      mergeById(stored.quotations, incoming.quotations, preferQuote),
      inboxEvents,
    ),
    projects: mergeById(stored.projects, incoming.projects, preferByUpdatedAt),
    departments: mergeById(stored.departments, incoming.departments, (a, b) => b),
    paymentEvents,
    inboxEvents,
    expenses,
    treasuryMonths,
    treasurySeparados: mergeById(
      stored.treasurySeparados,
      incoming.treasurySeparados,
      (a, b) => ((a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b),
    ),
    apartadoMovements: mergeById(
      stored.apartadoMovements,
      incoming.apartadoMovements,
      (a, b) => ((a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b),
    ),
    settings: incoming.settings ?? stored.settings,
    lastLive,
  }
}

function mergeTreasuryMonths(
  stored: TreasuryMonth[] | undefined,
  incoming: TreasuryMonth[] | undefined,
): TreasuryMonth[] {
  const map = new Map<string, TreasuryMonth>()
  for (const m of stored ?? []) map.set(m.yearMonth, m)
  for (const m of incoming ?? []) map.set(m.yearMonth, m)
  return Array.from(map.values()).sort((a, b) =>
    a.yearMonth < b.yearMonth ? 1 : a.yearMonth > b.yearMonth ? -1 : 0,
  )
}

type LiveHandler = (envelope: LiveEnvelope) => void

const handlers = new Set<LiveHandler>()
let bootstrapped = false
let channel: BroadcastChannel | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
/** Última rev aplicada/publicada en este JS realm (evita eco). */
let lastSeenRev = 0

export function markRevSeen(rev: number) {
  lastSeenRev = Math.max(lastSeenRev, rev)
}

function emitLocal(envelope: LiveEnvelope) {
  handlers.forEach((handler) => {
    try {
      handler(envelope)
    } catch (err) {
      console.warn("[technik-live] handler error", err)
    }
  })
}

function envelopeFromSnapshot(snapshot: WorkspaceSnapshot): LiveEnvelope {
  const pulse = snapshot.lastLive
  const pulseForThisRev = pulse && pulse.rev === snapshot.rev ? pulse : undefined
  return {
    type: "workspace",
    originId: pulseForThisRev?.originId ?? "storage",
    message: pulseForThisRev?.message,
    audience: pulseForThisRev?.audience,
    snapshot,
  }
}

function ingestSnapshot(snapshot: WorkspaceSnapshot) {
  if (snapshot.rev <= lastSeenRev) return
  lastSeenRev = snapshot.rev
  emitLocal(envelopeFromSnapshot(snapshot))
}

function onStorage(ev: StorageEvent) {
  if (ev.key !== WORKSPACE_STORAGE_KEY || !ev.newValue) return
  try {
    const snapshot = JSON.parse(ev.newValue) as WorkspaceSnapshot
    ingestSnapshot(snapshot)
  } catch {
    // ignore
  }
}

function pollWorkspace() {
  const snapshot = loadWorkspace()
  if (!snapshot) return
  ingestSnapshot(snapshot)
}

function ensureBus() {
  if (typeof window === "undefined" || bootstrapped) return
  bootstrapped = true

  try {
    channel = new BroadcastChannel(LIVE_CHANNEL)
    channel.onmessage = (ev: MessageEvent<LiveEnvelope>) => {
      const envelope = ev.data
      if (!envelope || envelope.type !== "workspace") return
      if (envelope.snapshot.rev <= lastSeenRev) return
      lastSeenRev = envelope.snapshot.rev
      emitLocal(envelope)
    }
  } catch {
    channel = null
  }

  window.addEventListener("storage", onStorage)
  pollTimer = setInterval(pollWorkspace, 600)
}

/** Suscribe una pestaña/react tree al bus en vivo. */
export function subscribeLive(handler: LiveHandler): () => void {
  ensureBus()
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/**
 * Persiste y difunde el workspace.
 * Devuelve el snapshot real guardado (tras merge) para que la pestaña
 * que publica actualice su React state — si no, marca lastSeenRev y el
 * poll ya nunca aplica las cotizaciones que venían solo del storage.
 */
export function publishLive(envelope: LiveEnvelope): WorkspaceSnapshot {
  if (typeof window === "undefined") return envelope.snapshot
  ensureBus()

  const previous = loadWorkspace()
  let snapshot: WorkspaceSnapshot = envelope.message
    ? {
        ...envelope.snapshot,
        lastLive: {
          message: envelope.message,
          audience: envelope.audience ?? "admin",
          originId: envelope.originId,
          at: Date.now(),
          rev: envelope.snapshot.rev,
        },
      }
    : {
        ...envelope.snapshot,
        lastLive: envelope.snapshot.lastLive ?? previous?.lastLive,
      }

  // Merge con lo ya persistido: evita que una pestaña stale borre cotizaciones ajenas.
  if (previous) {
    const merged = mergeWorkspaces(previous, snapshot)
    const rev = Math.max(merged.rev, snapshot.rev, Date.now())
    snapshot = {
      ...merged,
      rev,
      lastLive: snapshot.lastLive
        ? { ...snapshot.lastLive, rev }
        : merged.lastLive,
    }
  }

  markRevSeen(snapshot.rev)
  saveWorkspace(snapshot)

  const payload: LiveEnvelope = { ...envelope, snapshot }
  if (channel) {
    try {
      channel.postMessage(payload)
    } catch (err) {
      console.warn("[technik-live] BroadcastChannel post failed", err)
    }
  }

  return snapshot
}

export function formatMoneyShort(amount: number): string {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  })
}
