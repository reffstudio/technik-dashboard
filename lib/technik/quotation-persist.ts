import { getSupabaseBrowser } from "@/lib/supabase/browser"
import type {
  ClientResponse,
  Project,
  PublicQuoteItem,
  Quotation,
  QuoteEvent,
  QuoteLine,
  QuoteStatus,
  User,
  VisitPhoto,
  WorkDepartment,
} from "./data"
import { quotationTrashExpired } from "./data"
import { visitPhotoUrl } from "./visit-photos"

const OPS_BACKUP_KEY = "technik-ops-backup-v1"

type QuoteRow = {
  id: string
  reference: string
  client_id: string
  title: string
  status: QuoteStatus
  department_ids: string[] | null
  created_by: string
  notes: string | null
  comments: string | null
  terms: string | null
  tax_rate: number | string | null
  isr_retention_rate: number | string | null
  client_response: ClientResponse | null
  client_sent_at: string | null
  supplier_sent_at: string | null
  supplier_id: string | null
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

type LineRow = {
  quotation_id: string
  catalog_item_id: string
  quantity: number | string
  unit_price: number | string | null
  sort_order: number
}

type PublicRow = {
  id: string
  quotation_id: string
  quantity: number | string
  title: string
  description: string
  unit_price: number | string
  image_path: string | null
  sort_order: number
}

type EventRow = {
  quotation_id: string
  actor_id: string | null
  action: string
  created_at: string
}

type PhotoRow = {
  id: string
  quotation_id: string
  storage_path: string
  thumb_path: string | null
  caption: string | null
  mime: "image/jpeg" | "image/webp"
  bytes: number
  thumb_bytes: number | null
  width: number
  height: number
  taken_at: string
  uploaded_by: string | null
}

export type OpsBackup = {
  at: number
  quotations: Quotation[]
  projects: Project[]
}

function num(value: number | string | null | undefined, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function authorOf(createdBy: string, users: User[]) {
  const u = users.find((x) => x.authId === createdBy || x.id === createdBy)
  if (u) return { createdBy: u.name, createdById: u.id }
  return { createdBy: "Colaborador", createdById: createdBy }
}

function eventKey(at: string, action: string) {
  return `${at}|${action}`
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  )
}

async function persistQuoteImage(
  quotationId: string,
  itemId: string,
  imageUrl: string | undefined,
): Promise<string | null> {
  if (!imageUrl) return null
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i)
    if (!match) return null
    const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase()
    const raw = match[2]
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : "jpg"
    const safeId = itemId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "item"
    const path = `${quotationId}/${safeId}.${ext}`
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.storage.from("quote-images").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    })
    if (error) {
      console.warn("[technik] No se pudo subir imagen de cotización", error.message)
      return null
    }
    return path
  }
  const publicMarker = "/object/public/quote-images/"
  const idx = imageUrl.indexOf(publicMarker)
  if (idx >= 0) return decodeURIComponent(imageUrl.slice(idx + publicMarker.length).split("?")[0])
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl
  return imageUrl
}

function storagePublicUrl(path: string | null | undefined, bucket: string) {
  if (!path) return ""
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("/")) return path
  const supabase = getSupabaseBrowser()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export function quotesSignature(list: Quotation[]) {
  return list
    .map(
      (q) =>
        `${q.id}:${q.updatedAt}:${q.status}:${q.deletedAt ?? ""}:${q.lines.length}:${q.history?.length ?? 0}:${q.publicItems?.length ?? 0}:${q.visitPhotos?.length ?? 0}:${q.clientResponse ?? ""}:${q.comments ?? ""}`,
    )
    .sort()
    .join("|")
}

export function readOpsBackup(): { quotations: Quotation[]; projects: Project[] } {
  if (typeof window === "undefined") return { quotations: [], projects: [] }
  try {
    const raw = window.localStorage.getItem(OPS_BACKUP_KEY)
    if (!raw) return { quotations: [], projects: [] }
    const parsed = JSON.parse(raw) as Partial<OpsBackup>
    const quotations = Array.isArray(parsed.quotations) ? parsed.quotations : []
    const projects = Array.isArray(parsed.projects) ? (parsed.projects as Project[]) : []
    return {
      quotations: quotations.filter((q) => q?.id && q?.reference && !quotationTrashExpired(q)),
      projects: projects.filter((p) => p?.id),
    }
  } catch {
    return { quotations: [], projects: [] }
  }
}

/** Nunca guarda un array vacío encima de un backup con datos. */
export function writeOpsBackup(quotations: Quotation[], projects: Project[] = []) {
  if (typeof window === "undefined") return
  try {
    const prev = readOpsBackup()
    if (quotations.length === 0 && prev.quotations.length > 0) return
    const body: OpsBackup = {
      at: Date.now(),
      quotations,
      projects: projects.length > 0 ? projects : prev.projects,
    }
    window.localStorage.setItem(OPS_BACKUP_KEY, JSON.stringify(body))
  } catch (err) {
    console.warn("[technik] No se pudo guardar el backup local de cotizaciones", err)
  }
}

function quoteFromRow(
  row: QuoteRow,
  lines: QuoteLine[],
  publicItems: PublicQuoteItem[],
  history: QuoteEvent[],
  visitPhotos: VisitPhoto[],
  users: User[],
): Quotation {
  const author = authorOf(row.created_by, users)
  return {
    id: row.id,
    reference: row.reference || row.id,
    clientId: row.client_id,
    title: row.title,
    status: row.status,
    departments: (row.department_ids ?? []) as WorkDepartment[],
    lines,
    publicItems,
    createdBy: author.createdBy,
    createdById: author.createdById,
    createdAt: (row.created_at ?? "").slice(0, 10),
    updatedAt: row.updated_at?.slice(0, 16).replace("T", " ") ?? row.created_at,
    notes: row.notes || undefined,
    comments: row.comments || undefined,
    terms: row.terms || undefined,
    taxRate: num(row.tax_rate, 0.16),
    isrRetentionRate: num(row.isr_retention_rate, 0),
    clientResponse: row.client_response ?? undefined,
    clientSentAt: row.client_sent_at ?? undefined,
    supplierSentAt: row.supplier_sent_at ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    visitPhotos,
    history,
  }
}

export async function loadQuotations(users: User[]): Promise<
  { ok: true; quotations: Quotation[] } | { ok: false; error: string }
> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, reference, client_id, title, status, department_ids, created_by, notes, comments, terms, tax_rate, isr_retention_rate, client_response, client_sent_at, supplier_sent_at, supplier_id, deleted_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })

  let rows = (data ?? []) as QuoteRow[]
  if (error && /deleted_at/i.test(error.message)) {
    const retry = await supabase
      .from("quotations")
      .select(
        "id, reference, client_id, title, status, department_ids, created_by, notes, comments, terms, tax_rate, isr_retention_rate, client_response, client_sent_at, supplier_sent_at, supplier_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
    if (retry.error) return { ok: false, error: retry.error.message }
    rows = (retry.data ?? []) as QuoteRow[]
  } else if (error) {
    return { ok: false, error: error.message }
  }

  if (rows.length === 0) return { ok: true, quotations: [] }

  const ids = rows.map((r) => r.id)
  const [linesRes, publicRes, eventsRes, photosRes] = await Promise.all([
    supabase.from("quotation_lines").select("quotation_id, catalog_item_id, quantity, unit_price, sort_order").in("quotation_id", ids),
    supabase.from("quotation_public_items").select("id, quotation_id, quantity, title, description, unit_price, image_path, sort_order").in("quotation_id", ids),
    supabase.from("quotation_events").select("quotation_id, actor_id, action, created_at").in("quotation_id", ids).order("created_at"),
    supabase.from("quotation_visit_photos").select("id, quotation_id, storage_path, thumb_path, caption, mime, bytes, thumb_bytes, width, height, taken_at, uploaded_by").in("quotation_id", ids),
  ])

  const linesByQuote = new Map<string, QuoteLine[]>()
  for (const row of (linesRes.data ?? []) as LineRow[]) {
    const list = linesByQuote.get(row.quotation_id) ?? []
    list.push({
      itemId: row.catalog_item_id,
      quantity: num(row.quantity, 1),
      unitPrice: row.unit_price == null ? undefined : num(row.unit_price),
    })
    linesByQuote.set(row.quotation_id, list)
  }

  const publicByQuote = new Map<string, PublicQuoteItem[]>()
  for (const row of (publicRes.data ?? []) as PublicRow[]) {
    const list = publicByQuote.get(row.quotation_id) ?? []
    list.push({
      id: row.id,
      quantity: num(row.quantity, 1),
      title: row.title,
      description: row.description ?? "",
      unitPrice: num(row.unit_price),
      imageUrl: row.image_path ? storagePublicUrl(row.image_path, "quote-images") : undefined,
    })
    publicByQuote.set(row.quotation_id, list)
  }

  const eventsByQuote = new Map<string, QuoteEvent[]>()
  for (const row of (eventsRes.data ?? []) as EventRow[]) {
    const actor = row.actor_id ? authorOf(row.actor_id, users) : null
    const list = eventsByQuote.get(row.quotation_id) ?? []
    list.push({
      at: (row.created_at ?? "").slice(0, 16).replace("T", " "),
      by: actor?.createdBy ?? "Sistema",
      action: row.action,
    })
    eventsByQuote.set(row.quotation_id, list)
  }

  const photosByQuote = new Map<string, VisitPhoto[]>()
  for (const row of (photosRes.data ?? []) as PhotoRow[]) {
    const actor = row.uploaded_by ? authorOf(row.uploaded_by, users) : null
    const list = photosByQuote.get(row.quotation_id) ?? []
    list.push({
      id: row.id,
      quotationId: row.quotation_id,
      url: visitPhotoUrl(row.quotation_id, row.id),
      thumbUrl: visitPhotoUrl(row.quotation_id, row.id, true),
      caption: row.caption || undefined,
      takenAt: row.taken_at,
      uploadedById: actor?.createdById ?? row.uploaded_by ?? "",
      uploadedBy: actor?.createdBy ?? "Colaborador",
      mime: row.mime,
      bytes: row.bytes,
      thumbBytes: row.thumb_bytes ?? 0,
      width: row.width,
      height: row.height,
    })
    photosByQuote.set(row.quotation_id, list)
  }

  return {
    ok: true,
    quotations: rows
      .map((row) =>
        quoteFromRow(
          row,
          linesByQuote.get(row.id) ?? [],
          publicByQuote.get(row.id) ?? [],
          eventsByQuote.get(row.id) ?? [],
          photosByQuote.get(row.id) ?? [],
          users,
        ),
      )
      .filter((q) => !quotationTrashExpired(q)),
  }
}

async function persistChildren(q: Quotation, users: User[], isAdmin: boolean) {
  const supabase = getSupabaseBrowser()

  const { error: delLines } = await supabase.from("quotation_lines").delete().eq("quotation_id", q.id)
  if (delLines) return { ok: false as const, error: delLines.message }
  const lineRows = q.lines
    .filter((l) => l.itemId && l.quantity > 0)
    .map((l, i) => ({
      quotation_id: q.id,
      catalog_item_id: l.itemId,
      quantity: l.quantity,
      unit_price: l.unitPrice ?? null,
      sort_order: i,
    }))
  if (lineRows.length > 0) {
    const { error } = await supabase.from("quotation_lines").insert(lineRows)
    if (error) return { ok: false as const, error: error.message }
  }

  if (isAdmin) {
    await supabase.from("quotation_public_items").delete().eq("quotation_id", q.id)
    const publicRows: Record<string, unknown>[] = []
    for (const [i, item] of (q.publicItems ?? []).entries()) {
      const image = await persistQuoteImage(q.id, item.id || `item-${i}`, item.imageUrl)
      const row: Record<string, unknown> = {
        quotation_id: q.id,
        quantity: item.quantity,
        title: item.title,
        description: item.description ?? "",
        unit_price: item.unitPrice ?? 0,
        image_path: image,
        sort_order: i,
      }
      if (isUuid(item.id)) row.id = item.id
      publicRows.push(row)
    }
    if (publicRows.length > 0) {
      const { error } = await supabase.from("quotation_public_items").insert(publicRows)
      if (error) return { ok: false as const, error: error.message }
    }
  }

  const { data: existingEvents } = await supabase
    .from("quotation_events")
    .select("action, created_at")
    .eq("quotation_id", q.id)
  const seen = new Set(
    ((existingEvents ?? []) as { action: string; created_at: string }[]).map((e) =>
      eventKey((e.created_at ?? "").slice(0, 16).replace("T", " "), e.action),
    ),
  )
  const fresh = (q.history ?? []).filter((h) => !seen.has(eventKey(h.at, h.action)))
  if (fresh.length > 0) {
    const { error } = await supabase.from("quotation_events").insert(
      fresh.map((h) => {
        const parsed = new Date(h.at.includes("T") ? h.at : h.at.replace(" ", "T"))
        return {
          quotation_id: q.id,
          actor_id: users.find((u) => u.name === h.by || u.id === h.by)?.authId ?? null,
          action: h.action,
          created_at: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
        }
      }),
    )
    if (error) return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}

export async function persistQuotation(
  q: Quotation,
  ctx: { actorAuthId?: string; users: User[]; isAdmin: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseBrowser()
  const { data: existing } = await supabase
    .from("quotations")
    .select("id, created_by")
    .eq("id", q.id)
    .maybeSingle()

  const createdBy =
    (existing as { created_by?: string } | null)?.created_by ||
    ctx.actorAuthId ||
    ctx.users.find((u) => u.id === q.createdById || u.authId === q.createdById)?.authId

  if (!createdBy) {
    return { ok: false, error: "No hay sesión para guardar la cotización." }
  }

  const row: Record<string, unknown> = {
    id: q.id,
    reference: q.reference,
    client_id: q.clientId,
    title: q.title,
    status: q.status,
    department_ids: q.departments ?? [],
    created_by: createdBy,
    notes: q.notes ?? null,
    comments: q.comments ?? null,
    terms: q.terms ?? null,
    tax_rate: q.taxRate ?? 0.16,
    isr_retention_rate: q.isrRetentionRate ?? 0,
    client_response: q.clientResponse ?? null,
    client_sent_at: q.clientSentAt ?? null,
    supplier_sent_at: q.supplierSentAt ?? null,
    supplier_id: q.supplierId ?? null,
    deleted_at: q.deletedAt ?? null,
  }

  let { error } = await supabase.from("quotations").upsert(row)
  if (error && /deleted_at/i.test(error.message)) {
    delete row.deleted_at
    const retry = await supabase.from("quotations").upsert(row)
    error = retry.error
  }
  if (error) {
    const msg = error.message ?? ""
    if (error.code === "42501" || /row-level security/i.test(msg)) {
      return { ok: false, error: "No tienes permiso para guardar esta cotización." }
    }
    if (error.code === "23503") {
      return { ok: false, error: "Falta el cliente o un ítem de catálogo en el servidor." }
    }
    return { ok: false, error: "No se pudo guardar la cotización." }
  }

  const children = await persistChildren(q, ctx.users, ctx.isAdmin)
  if (!children.ok) return children
  return { ok: true }
}

export async function deleteQuotationRow(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("quotations").delete().eq("id", id)
  if (error) return { ok: false as const, error: "No se pudo eliminar la cotización." }
  return { ok: true as const }
}

const persistTail = new Map<string, Promise<unknown>>()

export function enqueuePersistQuotation(
  q: Quotation,
  ctx: { actorAuthId?: string; users: User[]; isAdmin: boolean },
) {
  const prev = persistTail.get(q.id) ?? Promise.resolve()
  const next = prev
    .catch(() => undefined)
    .then(() => persistQuotation(q, ctx))
  persistTail.set(q.id, next)
  return next
}
