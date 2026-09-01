import type { Quotation } from "./data"
import { formatDisplayDate } from "./dates"

export type AppNotificationKind =
  | "review_queue"
  | "waiting_client"
  | "overdue_installment"
  | "pending_complement"
  | "activity"

export type AppNotification = {
  id: string
  kind: AppNotificationKind
  title: string
  body: string
  at: string
  /** Destino de navegación opcional */
  href?: {
    name: "review" | "project" | "quotations" | "billing" | "finanzas"
    id?: string
    section?: "facturacion" | "balances"
  }
}

/** Evento de bandeja (cotización enviada, cobro, etc.) — no se deriva del estado actual. */
export type InboxEvent = AppNotification

/** Timestamp de actividad más reciente de una cotización (historial > updatedAt). */
export function quotationActivityAt(q: Quotation): string {
  const last = q.history?.[q.history.length - 1]?.at
  if (last) return last
  return q.updatedAt || q.createdAt
}

/**
 * Cuándo entró a la cola de revisión, en ms.
 * Bandeja primero (marca ISO real del envío); si no hay, historial de
 * «envió a revisión». No usa `updatedAt`: el sync lo pisa y sube cotizaciones viejas.
 */
export function quotationReviewQueuedMs(
  q: Quotation,
  inboxEvents: InboxEvent[] = [],
): number {
  let inboxBest = 0
  for (const e of inboxEvents) {
    if (e.kind !== "review_queue") continue
    const matches =
      e.href?.id === q.id ||
      e.href?.id === q.reference ||
      e.id === `review-${q.id}` ||
      e.id === `review-${q.reference}` ||
      e.id.startsWith(`review-${q.id}-`) ||
      e.id.startsWith(`review-${q.reference}-`)
    if (!matches) continue
    inboxBest = Math.max(inboxBest, parseActivityMs(e.at))
  }
  if (inboxBest > 0) return inboxBest

  let historyBest = 0
  for (const h of q.history ?? []) {
    if (!/envi/i.test(h.action) || !/revisi[oó]n/i.test(h.action)) continue
    historyBest = Math.max(historyBest, parseActivityMs(h.at))
  }
  if (historyBest > 0) return historyBest
  return parseActivityMs(q.createdAt)
}

/** ISO, `YYYY-MM-DD HH:mm` o fecha sola → epoch ms (0 si no se puede leer). */
export function parseActivityMs(raw: string | undefined): number {
  if (!raw) return 0
  const t = raw.trim()
  if (!t) return 0
  if (t.includes("T")) {
    const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(t) ? t : `${t}Z`
    const n = Date.parse(withZone)
    return Number.isNaN(n) ? 0 : n
  }
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) {
    const n = Date.parse(t)
    return Number.isNaN(n) ? 0 : n
  }
  const day = m[1]
  const hh = m[2] ?? "00"
  const mm = m[3] ?? "00"
  const ss = m[4] ?? "00"
  const n = Date.parse(`${day}T${hh}:${mm}:${ss}`)
  return Number.isNaN(n) ? 0 : n
}

/** Relativo corto para la campana: ahora / hace N min / hace N h / ayer / SEP/01/2026. */
export function formatNotificationWhen(at: string | undefined, nowMs = Date.now()): string {
  const ms = parseActivityMs(at)
  if (!ms) return ""
  const diff = Math.max(0, nowMs - ms)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const then = new Date(ms)
  const now = new Date(nowMs)
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  if (startToday - startThen === 86_400_000) return "ayer"
  return formatDisplayDate(at) || formatDisplayDate(then.toISOString())
}

/**
 * Campana = solo eventos reales (envío a revisión, cobro, etapa…).
 * No inventa alertas a partir del estado seed (cuotas vencidas / en espera del cliente).
 */
export function buildAppNotifications(input: {
  inboxEvents?: InboxEvent[]
}): AppNotification[] {
  const items = input.inboxEvents ?? []

  const byId = new Map<string, AppNotification>()
  for (const item of items) {
    const prev = byId.get(item.id)
    if (!prev || parseActivityMs(prev.at) < parseActivityMs(item.at)) byId.set(item.id, item)
  }

  return Array.from(byId.values()).sort((a, b) => {
    const delta = parseActivityMs(b.at) - parseActivityMs(a.at)
    if (delta !== 0) return delta
    return (b.id ?? "").localeCompare(a.id ?? "")
  })
}

const SEEN_KEY_PREFIX = "technik-notif-seen:"

export function loadSeenNotificationIds(userId: string | undefined): Set<string> {
  if (typeof window === "undefined" || !userId) return new Set()
  try {
    const raw = window.localStorage.getItem(`${SEEN_KEY_PREFIX}${userId}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function persistSeenNotificationIds(userId: string | undefined, ids: Set<string>) {
  if (typeof window === "undefined" || !userId) return
  try {
    window.localStorage.setItem(`${SEEN_KEY_PREFIX}${userId}`, JSON.stringify([...ids]))
  } catch {
    // ignore quota
  }
}
