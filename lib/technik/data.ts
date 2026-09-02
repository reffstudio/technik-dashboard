// ─── Technik Solutions — Modelo de dominio ──────────────────────

import {
  LABOR_BURDEN_RATE,
  MATERIAL_PUBLIC_MARKUP,
  INTERNAL_PROFIT_RATE,
  ANNUAL_BONUS_RATE,
} from "./company"

export type Role = "admin" | "empleado"

export type QuoteStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "closed"

export type CatalogKind = "material" | "labor" | "extra"

export type MaterialCategory = "Material" | "Componente" | "Consumible"
export type ExtraCategory = "Extra" | "Viático" | "Flete" | "Otro"
export type CatalogCategory = MaterialCategory | "Mano de obra" | ExtraCategory

export type SupplierChannel = "email" | "whatsapp" | "both"

/** ID de departamento de trabajo (dinámico; ej. maquinados, TKS-D-004). */
export type WorkDepartment = string

/**
 * Respuesta del cliente a la cotización enviada
 * (columna "Notas" del Excel: En espera / Aprobada / Rechazada).
 */
export type ClientResponse = "en_espera" | "aprobada" | "rechazada"

export interface User {
  /** Username único — también es el ID del usuario (ej. iochoa) */
  id: string
  /** UUID de Auth / profiles.id. Ausente en usuarios solo locales. */
  authId?: string
  username: string
  name: string
  email: string
  role: Role
  password: string
  /** ID del departamento de trabajo asignado */
  department: WorkDepartment
  location: string
  since: string
  active: boolean
  /** true mientras no ha creado su contraseña (invitación pendiente) */
  invitePending?: boolean
  /** URL pública, data URL o ruta de foto de perfil */
  avatarUrl?: string
}

export interface Client {
  id: string
  company: string
  /** RFC fiscal (persona moral o física) */
  rfc: string
  contact: string
  email: string
  phone: string
  /** Copias fijas (supervisores, socio, etc.) al enviar cotizaciones. */
  ccEmails: string[]
  industry: string
  location: string
  since: string
}

export interface Supplier {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  whatsapp: string
  preferredChannel: SupplierChannel
  specialty: string
  location: string
}

export interface CatalogItem {
  id: string
  kind: CatalogKind
  name: string
  /** Código de fabricante / referencia comercial */
  sku: string
  category: CatalogCategory
  unit: string
  unitCost: number
  supplierId?: string
}

export interface QuoteLine {
  itemId: string
  quantity: number
  unitPrice?: number
}

/** Línea visible en la cotización PDF al cliente (no es material/mano de obra interna). */
export type PublicQuoteItem = {
  id: string
  quantity: number
  title: string
  description: string
  unitPrice: number
  /** Data URL opcional — imagen de referencia */
  imageUrl?: string
}

/** Tope de la descripción pública de cada ítem (PDF + revisión). */
export const PUBLIC_ITEM_DESCRIPTION_MAX = 1000

/**
 * Foto de visita (contexto de campo).
 * Solo metadatos en la cotización / DB; los bytes viven en storage
 * (`visit-photos/{quotationId}/{id}.jpg`) y se sirven por URL.
 */
export type VisitPhoto = {
  id: string
  quotationId: string
  url: string
  thumbUrl: string
  caption?: string
  takenAt: string
  uploadedById: string
  uploadedBy: string
  mime: "image/jpeg" | "image/webp"
  bytes: number
  thumbBytes: number
  width: number
  height: number
}

export interface QuoteEvent {
  at: string
  by: string
  action: string
}

/** Etapa operativa de un proyecto (post-aprobación del cliente). */
export type ProjectStage =
  | "procesando_solicitud"
  | "listo_para_iniciar"
  | "en_proceso"
  | "atrasado"
  | "completado"

export interface ProjectEvent {
  at: string
  by: string
  action: string
}

/** Evento de cobro append-only (espejo de payment_events en Supabase). */
export type PaymentEventKind = "collected" | "correction_note"

export type PaymentEvent = {
  id: string
  projectId: string
  installmentId: string
  kind: PaymentEventKind
  amount: number
  method?: PaymentMethod
  paidAt?: string
  note?: string
  at: string
  by: string
}

export type PaymentMethod =
  | "transferencia"
  | "efectivo"
  | "cheque"
  | "tarjeta"
  | "otro"

/**
 * Método de pago CFDI (cómo se factura al cliente).
 * En el Excel del admin aparece como “Método de pago”.
 */
export type PaymentMode = "unico" | "abonos"

/** Estado del complemento de pago CFDI (parcialidades). */
export type PaymentComplementStatus = "na" | "pending" | "sent"

export type BillingStatus = "sin_pagos" | "parcial" | "pagado" | "vencido"

/**
 * Cuota / factura del plan de cobro (una fila ≈ una factura del Excel).
 * Puede estar solo programada (dueDate) o ya cobrada (paidAt).
 */
export type ProjectInstallment = {
  id: string
  amount: number
  /** Fecha programada de cobro / recordatorio (YYYY-MM-DD) */
  dueDate: string
  note?: string
  /** UUID del CFDI (ID factura SAT) */
  invoiceUuid?: string
  /** Día en que se generó la factura (YYYY-MM-DD) */
  invoiceDate?: string
  /** Complemento de pago: N/A · pendiente · hecho y enviado */
  paymentComplement?: PaymentComplementStatus
  /** Si existe, la cuota ya fue cobrada (YYYY-MM-DD) */
  paidAt?: string
  /** Medio de cobro (transferencia, efectivo…) — distinto del método CFDI */
  method?: PaymentMethod
}

/** Canal de caja para el libro de tesorería (Excel banco / efectivo). */
export type CashChannel = "banco" | "efectivo"

/** Egreso capturado a mano en Facturación → Balance general. */
export type ExpenseEntry = {
  id: string
  amount: number
  /** YYYY-MM-DD */
  date: string
  description: string
  channel: CashChannel
  createdAt: string
}

/** Aperturas del mes calendario (YYYY-MM). */
export type TreasuryMonth = {
  yearMonth: string
  openingBank: number
  openingCash: number
}

/** Separado / apartado de caja (reserva creada por el admin). */
export type SeparadoKind = "percent" | "amount"
/** `iva` / `isr` son legado del apartado fiscal automático; ya no se crean. */
export type ApartadoCategory = "custom" | "iva" | "isr"
export type ApartadoStatus = "open" | "paid"
/** Entrada (abono) o salida (adelanto / retiro) del apartado. */
export type ApartadoMovementKind = "in" | "out"

export type ApartadoMovement = {
  id: string
  apartadoId: string
  kind: ApartadoMovementKind
  amount: number
  /** YYYY-MM-DD */
  date: string
  note?: string
  /** Si la salida generó egreso de tesorería. */
  expenseId?: string
  createdAt: string
  createdById?: string
}

export type TreasurySeparado = {
  id: string
  name: string
  category: ApartadoCategory
  kind: SeparadoKind
  /**
   * Si `percent`: porcentaje 0–100 (ej. 10 = 10%).
   * Si `amount`: pesos MXN (override efectivo para impuestos).
   */
  value: number
  /** Solo impuestos: monto sugerido del motor fiscal (no pisa override en `value`). */
  suggestedAmount?: number
  status: ApartadoStatus
  /** Egreso de tesorería que liquidó la obligación. */
  paidExpenseId?: string
  /** Obligaciones fiscales son del mes; custom es plantilla global (sin yearMonth). */
  yearMonth?: string
  /** Si true, el admin ya fijó `value` y no se resetea al refrescar la sugerencia. */
  amountOverridden?: boolean
  /** Stock de arranque (lo que ya tenían apartado). No es un movimiento del mes. */
  openingBalance?: number
  createdAt: string
}

/** Reserva manual (no el IVA/ISR que se generaba solo por mes). */
export function isManualReserve(s: Pick<TreasurySeparado, "category" | "yearMonth">): boolean {
  return (s.category ?? "custom") === "custom" && !s.yearMonth
}

/** Normaliza snapshots viejos sin category/status. */
export function normalizeTreasurySeparado(
  raw: Partial<TreasurySeparado> & Pick<TreasurySeparado, "id" | "name" | "kind" | "value" | "createdAt">,
): TreasurySeparado {
  const category = raw.category ?? "custom"
  return {
    id: raw.id,
    name: raw.name,
    category,
    kind: raw.kind,
    value: raw.value,
    suggestedAmount: raw.suggestedAmount,
    status: raw.status ?? "open",
    paidExpenseId: raw.paidExpenseId,
    yearMonth: raw.yearMonth,
    amountOverridden: raw.amountOverridden,
    openingBalance: Number.isFinite(raw.openingBalance) ? Math.max(0, raw.openingBalance!) : 0,
    createdAt: raw.createdAt,
  }
}

export function normalizeApartadoMovement(
  raw: Partial<ApartadoMovement> &
    Pick<ApartadoMovement, "id" | "apartadoId" | "kind" | "amount" | "date" | "createdAt">,
): ApartadoMovement {
  return {
    id: raw.id,
    apartadoId: raw.apartadoId,
    kind: raw.kind === "out" ? "out" : "in",
    amount: Number.isFinite(raw.amount) ? raw.amount : 0,
    date: raw.date,
    note: raw.note?.trim() || undefined,
    expenseId: raw.expenseId,
    createdAt: raw.createdAt,
    createdById: raw.createdById,
  }
}

export const CASH_CHANNEL_LABEL: Record<CashChannel, string> = {
  banco: "Banco",
  efectivo: "Efectivo",
}

/**
 * Proyecto de seguimiento.
 * Folio (`id`): si viene de cotización = mismo `TKS-Q-…`; si es N/A = `TKS-P-…`.
 * Si hay `quotationId`, cliente/título/totales salen de la cotización.
 * Sin cotización (N/A en Excel): usar `title`, `clientId`, `totalDue`.
 */
export interface Project {
  /** Folio público (cotización o serie P para N/A) */
  id: string
  /** Cotización origen; ausente = proyecto/cobro sin cotización */
  quotationId?: string
  /** Snapshot cuando no hay cotización */
  title?: string
  clientId?: string
  departments?: WorkDepartment[]
  /** Total a cobrar (con IVA) cuando no hay cotización */
  totalDue?: number
  createdById?: string
  stage: ProjectStage
  /** Fecha compromiso de entrega (YYYY-MM-DD) */
  dueDate?: string
  /** Fecha de entrega real (YYYY-MM-DD) */
  deliveredAt?: string
  notes?: string
  /** Pago en una exhibición o en parcialidades (método CFDI) */
  paymentMode?: PaymentMode
  /** Plan de cuotas / facturas (programados y/o cobrados) */
  installments: ProjectInstallment[]
  createdAt: string
  updatedAt: string
  history: ProjectEvent[]
  /** Portada del listado (1 foto). */
  coverImageUrl?: string
  /**
   * En papelera. Si está definido, no aparece en la mesa operativa;
   * se borra del todo a los 15 días (salvo cobros ya registrados).
   */
  deletedAt?: string
}

export interface Quotation {
  /** Igual a reference: TKS-Q-YYYY-#### */
  id: string
  reference: string
  clientId: string
  title: string
  status: QuoteStatus
  /** Departamentos de fabricación / servicio (multi) */
  departments: WorkDepartment[]
  /** Materiales y mano de obra — uso interno / proveedores */
  lines: QuoteLine[]
  /** Ítems que ve el cliente en el PDF */
  publicItems: PublicQuoteItem[]
  createdBy: string
  createdById: string
  createdAt: string
  updatedAt: string
  notes?: string
  /** Fotos de la visita (metadatos; blobs en /api/quotes/:id/photos) */
  visitPhotos?: VisitPhoto[]
  /** Comentarios operativos (columna Comentarios del Excel) */
  comments?: string
  /** Condiciones comerciales del PDF al cliente */
  terms?: string
  /** IVA (fracción, ej. 0.16) */
  taxRate?: number
  /** Retención ISR (fracción) */
  isrRetentionRate?: number
  /**
   * Respuesta del cliente tras el envío.
   * Solo aplica con sentido cuando ya se envió PDF (`clientSentAt`).
   */
  clientResponse?: ClientResponse
  /** Fecha en que se envió PDF al cliente (Fecha de envío) */
  clientSentAt?: string
  supplierSentAt?: string
  supplierId?: string
  /**
   * En papelera. Si está definido, no aparece en la mesa operativa;
   * se borra del todo a los 15 días.
   */
  deletedAt?: string
  /** Foto que el admin eligió mostrar en el PDF (no se toma sola de la visita). */
  coverImageUrl?: string
  history: QuoteEvent[]
}

/** Foto de fondo del pill de resumen — portada por defecto si no hay imagen. */
export const DEFAULT_COVER_IMAGE = "/brand/overview-hero.png"

function pushCover(out: string[], seen: Set<string>, url?: string) {
  const u = url?.trim()
  if (!u || seen.has(u)) return
  seen.add(u)
  out.push(u)
}

function isVisitPhotoCoverUrl(url: string) {
  return (
    /\/object\/sign\/visit-photos\//.test(url) ||
    /\/object\/public\/visit-photos\//.test(url) ||
    /\/api\/quotes\/[^/]+\/photos\//.test(url)
  )
}

/**
 * La portada elegida desde fotos de visita se guarda como URL firmada o ruta de API.
 * Las firmadas caducan; si la foto sigue en la cotización, usamos su URL vigente.
 */
export function resolvedCoverUrl(
  stored?: string,
  visitPhotos?: VisitPhoto[] | null,
): string | undefined {
  const url = stored?.trim()
  if (!url) return undefined
  const match = (visitPhotos ?? []).find(
    (p) => url === p.url || url === p.thumbUrl || (p.id && url.includes(p.id)),
  )
  if (match) return match.url || match.thumbUrl
  if (isVisitPhotoCoverUrl(url)) return undefined
  return url
}

/** Solo la foto que el admin agregó explícitamente a la cotización. */
export function quotationCoverUrl(
  q: Pick<Quotation, "coverImageUrl" | "visitPhotos">,
) {
  return resolvedCoverUrl(q.coverImageUrl, q.visitPhotos)
}

/** Candidatos de portada: proyecto → cotización → imagen por defecto. */
export function projectCoverSources(
  project?: Pick<Project, "coverImageUrl"> | null,
  quote?: Pick<Quotation, "coverImageUrl" | "visitPhotos"> | null,
): string[] {
  const photos = quote?.visitPhotos
  const seen = new Set<string>()
  const out: string[] = []
  pushCover(out, seen, resolvedCoverUrl(project?.coverImageUrl, photos))
  pushCover(out, seen, resolvedCoverUrl(quote?.coverImageUrl, photos))
  pushCover(out, seen, DEFAULT_COVER_IMAGE)
  return out
}

export function quotationCoverSources(
  q?: Pick<Quotation, "coverImageUrl" | "visitPhotos"> | null,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  pushCover(out, seen, resolvedCoverUrl(q?.coverImageUrl, q?.visitPhotos))
  pushCover(out, seen, DEFAULT_COVER_IMAGE)
  return out
}

export function projectCoverUrl(
  project: Pick<Project, "coverImageUrl">,
  quote?: Pick<Quotation, "coverImageUrl" | "visitPhotos">,
) {
  return projectCoverSources(project, quote)[0] ?? DEFAULT_COVER_IMAGE
}

// ─── Helpers ────────────────────────────────────────────────────

/** @deprecated Prefer MATERIAL_PUBLIC_MARKUP / suggestedPublicUnitPrice */
export const DEFAULT_LABOR_MARGIN = 0
/** @deprecated Prefer MATERIAL_PUBLIC_MARKUP / suggestedPublicUnitPrice */
export const DEFAULT_MARGIN = MATERIAL_PUBLIC_MARKUP

export type StatusIconId =
  | "draft"
  | "review"
  | "approved"
  | "closed"
  | "sent"
  | "in_progress"
  | "dispatched"
  | "supplier"
  | "waiting"
  | "rejected"
  | "stage_process"
  | "stage_ready"
  | "stage_active"
  | "stage_late"
  | "stage_done"

export const PROJECT_STAGE_META: Record<
  ProjectStage,
  { label: string; tone: string; icon: StatusIconId }
> = {
  procesando_solicitud: {
    label: "Procesando solicitud",
    tone: "amber",
    icon: "stage_process",
  },
  listo_para_iniciar: {
    label: "Listo para iniciar",
    tone: "azure",
    icon: "stage_ready",
  },
  en_proceso: {
    label: "En proceso",
    tone: "teal",
    icon: "stage_active",
  },
  atrasado: {
    /** Retraso operativo / entrega en taller — no es estado de cobro. */
    label: "Retraso en taller",
    tone: "loss",
    icon: "stage_late",
  },
  completado: {
    label: "Completado",
    tone: "gain",
    icon: "stage_done",
  },
}

export const PROJECT_STAGES: ProjectStage[] = [
  "procesando_solicitud",
  "listo_para_iniciar",
  "en_proceso",
  "atrasado",
  "completado",
]

/** Fecha compromiso vencida y aún no completado. */
export function projectIsOverdue(p: Project, todayIso = new Date().toISOString().slice(0, 10)): boolean {
  if (p.stage === "completado" || !p.dueDate) return false
  return p.dueDate < todayIso
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  cheque: "Cheque",
  tarjeta: "Tarjeta",
  otro: "Otro",
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  "transferencia",
  "efectivo",
  "cheque",
  "tarjeta",
  "otro",
]

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  unico: "Pago en una sola exhibición",
  abonos: "Pago en parcialidades o diferido",
}

export const PAYMENT_COMPLEMENT_LABEL: Record<PaymentComplementStatus, string> = {
  na: "N/A",
  pending: "Pendiente",
  sent: "Hecho y enviado",
}

export const PAYMENT_COMPLEMENTS: PaymentComplementStatus[] = ["na", "pending", "sent"]

export const BILLING_STATUS_META: Record<
  BillingStatus,
  { label: string; tone: string }
> = {
  sin_pagos: { label: "Sin pagos", tone: "neutral" },
  parcial: { label: "Pago parcial", tone: "amber" },
  pagado: { label: "Pagado", tone: "gain" },
  /** Solo facturación — independiente de la etapa del taller. */
  vencido: { label: "Cobro vencido", tone: "loss" },
}

export function defaultPaymentComplement(mode?: PaymentMode): PaymentComplementStatus {
  return mode === "abonos" ? "pending" : "na"
}

/** Título visible del proyecto (cotización o snapshot manual). */
export function projectTitle(p: Project, quoteTitle?: string): string {
  return quoteTitle || p.title || p.id
}

/** Normaliza proyectos viejos (folio interno → descartado; CFDI vive en la cuota). */
export function normalizeProject(
  raw: Project & { invoiceFolio?: string; invoiceDate?: string },
): Project {
  const legacyFolio = raw.invoiceFolio
  const legacyDate = raw.invoiceDate
  const looksLikeUuid =
    !!legacyFolio &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      legacyFolio.trim(),
    )

  const {
    invoiceFolio: _dropFolio,
    invoiceDate: _dropDate,
    ...rest
  } = raw

  const installments = (rest.installments ?? []).map((inst, index) => {
    const complement =
      inst.paymentComplement ?? defaultPaymentComplement(rest.paymentMode)
    const migrateUuid =
      index === 0 && looksLikeUuid && !inst.invoiceUuid ? legacyFolio!.trim() : undefined
    return {
      ...inst,
      invoiceUuid: inst.invoiceUuid ?? migrateUuid,
      invoiceDate: inst.invoiceDate ?? (index === 0 ? legacyDate : undefined),
      paymentComplement: complement,
    }
  })

  // Folio único: proyectos viejos TKS-P-* ligados a cotización adoptan el folio Q
  const quotationId = rest.quotationId || undefined
  const id =
    quotationId && rest.id !== quotationId && rest.id.startsWith("TKS-P-")
      ? quotationId
      : rest.id

  return {
    ...rest,
    id,
    quotationId,
    installments,
    deletedAt: rest.deletedAt,
  }
}

export function installmentIsPaid(inst: ProjectInstallment): boolean {
  return !!inst.paidAt
}

export function projectPaidTotal(p: Project): number {
  return roundMxn(
    (p.installments ?? [])
      .filter(installmentIsPaid)
      .reduce((sum, inst) => sum + (inst.amount || 0), 0),
  )
}

export function projectScheduledTotal(p: Project): number {
  return roundMxn((p.installments ?? []).reduce((sum, inst) => sum + (inst.amount || 0), 0))
}

/** Próxima cuota pendiente (para cobro / recordatorio). */
export function projectNextInstallment(p: Project): ProjectInstallment | undefined {
  return [...(p.installments ?? [])]
    .filter((i) => !installmentIsPaid(i))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0]
}

export function projectHasOverdueInstallment(
  p: Project,
  todayIso = new Date().toISOString().slice(0, 10),
): boolean {
  return (p.installments ?? []).some(
    (i) => !installmentIsPaid(i) && i.dueDate < todayIso,
  )
}

export function projectBillingSummary(
  p: Project,
  totalDue: number,
  todayIso = new Date().toISOString().slice(0, 10),
): {
  totalDue: number
  paid: number
  balance: number
  scheduled: number
  status: BillingStatus
  nextDue?: string
} {
  const due = roundMxn(Math.max(0, totalDue))
  const paid = projectPaidTotal(p)
  const scheduled = projectScheduledTotal(p)
  const balance = roundMxn(Math.max(0, due - paid))
  const fullyPaid = due > 0 ? paid >= due - 0.009 : paid > 0 && balance <= 0.009
  const overdue = projectHasOverdueInstallment(p, todayIso)
  const next = projectNextInstallment(p)

  let status: BillingStatus
  if (fullyPaid && (due > 0 || paid > 0)) status = "pagado"
  else if (overdue) status = "vencido"
  else if (paid <= 0) status = "sin_pagos"
  else status = "parcial"

  return {
    totalDue: due,
    paid,
    balance,
    scheduled,
    status,
    nextDue: next?.dueDate,
  }
}

export const STATUS_META: Record<QuoteStatus, { label: string; tone: string; icon: StatusIconId }> = {
  draft: { label: "Borrador", tone: "neutral", icon: "draft" },
  pending_review: { label: "En revisión", tone: "amber", icon: "review" },
  approved: { label: "Aprobada", tone: "azure", icon: "approved" },
  closed: { label: "Rechazada", tone: "loss", icon: "rejected" },
}

/** Pasos visibles del pipeline (incluye envío al cliente, derivado de `clientSentAt`). */
export type QuotePipelineStatus = QuoteStatus | "sent_client"

export const PIPELINE_STATUS_META: Record<
  QuotePipelineStatus,
  { label: string; tone: string; icon: StatusIconId }
> = {
  draft: STATUS_META.draft,
  pending_review: STATUS_META.pending_review,
  sent_client: { label: "Enviada al cliente", tone: "gain", icon: "sent" },
  approved: STATUS_META.approved,
  closed: STATUS_META.closed,
}

export const QUOTE_PIPELINE_STATUSES: QuotePipelineStatus[] = [
  "draft",
  "pending_review",
  "sent_client",
  "approved",
  "closed",
]

export function quotePipelineStatus(
  q: Pick<Quotation, "status" | "clientSentAt">,
): QuotePipelineStatus {
  if (q.status === "draft") return "draft"
  if (q.status === "approved") return "approved"
  if (q.status === "closed") return "closed"
  if (q.clientSentAt) return "sent_client"
  return "pending_review"
}

export function isQuotationCreator(
  user: Pick<User, "id" | "authId"> | null | undefined,
  quotation: Pick<Quotation, "createdById"> | null | undefined,
): boolean {
  if (!user || !quotation) return false
  return user.id === quotation.createdById || Boolean(user.authId && user.authId === quotation.createdById)
}

/** Días en Eliminados antes del borrado permanente. */
export const TRASH_RETENTION_DAYS = 15
/** @deprecated usar TRASH_RETENTION_DAYS */
export const DRAFT_TRASH_DAYS = TRASH_RETENTION_DAYS

export function trashPurgeAt(deletedAt: string): number {
  const t = Date.parse(deletedAt)
  if (Number.isNaN(t)) return 0
  return t + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

export function trashDaysLeft(deletedAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((trashPurgeAt(deletedAt) - now) / (24 * 60 * 60 * 1000)))
}

export function trashExpired(deletedAt: string | undefined, now = Date.now()): boolean {
  if (!deletedAt) return false
  return trashPurgeAt(deletedAt) <= now
}

const TRASH_ACTION = /envi[oó] a eliminados/i
const RESTORE_ACTION = /recuper[oó] de eliminados/i

export function historyHasRestore(
  history: Array<{ action?: string }> | undefined,
): boolean {
  return (history ?? []).some((h) => RESTORE_ACTION.test(h.action ?? ""))
}

/** Si falta `deleted_at` en la fila, el último evento de papelera lo reconstruye. */
export function deletedAtFromHistory(
  history: Array<{ at?: string; action?: string }> | undefined,
): string | undefined {
  let stamp: string | undefined
  for (const h of history ?? []) {
    const action = h.action ?? ""
    if (TRASH_ACTION.test(action) && h.at) stamp = h.at
    if (RESTORE_ACTION.test(action)) stamp = undefined
  }
  return stamp
}

export function quotationIsTrashed(q: Pick<Quotation, "deletedAt">): boolean {
  return Boolean(q.deletedAt)
}

export function quotationTrashPurgeAt(deletedAt: string): number {
  return trashPurgeAt(deletedAt)
}

export function quotationTrashDaysLeft(deletedAt: string, now = Date.now()): number {
  return trashDaysLeft(deletedAt, now)
}

export function quotationTrashExpired(q: Pick<Quotation, "deletedAt">, now = Date.now()): boolean {
  return trashExpired(q.deletedAt, now)
}

export function projectIsTrashed(p: Pick<Project, "deletedAt">): boolean {
  return Boolean(p.deletedAt)
}

export function projectTrashExpired(p: Pick<Project, "deletedAt">, now = Date.now()): boolean {
  return trashExpired(p.deletedAt, now)
}

/** Proyecto oculto en listas operativas (él o su cotización están en Eliminados). */
export function projectIsHidden(
  p: Pick<Project, "deletedAt" | "quotationId">,
  quotations: Pick<Quotation, "id" | "deletedAt">[],
): boolean {
  if (projectIsTrashed(p)) return true
  if (!p.quotationId) return false
  const q = quotations.find((x) => x.id === p.quotationId)
  return Boolean(q && quotationIsTrashed(q))
}

export function canTrashQuotation(
  user: Pick<User, "id" | "authId" | "role"> | null | undefined,
  q: Pick<Quotation, "createdById" | "status" | "deletedAt">,
): boolean {
  if (!user || quotationIsTrashed(q)) return false
  if (user.role === "admin") return true
  if (!isQuotationCreator(user, q)) return false
  return q.status === "draft" || q.status === "pending_review"
}

export function canRestoreQuotation(
  user: Pick<User, "id" | "authId" | "role"> | null | undefined,
  q: Pick<Quotation, "createdById" | "status" | "deletedAt">,
): boolean {
  if (!user || !quotationIsTrashed(q)) return false
  if (user.role === "admin") return true
  if (!isQuotationCreator(user, q)) return false
  return q.status === "draft" || q.status === "pending_review"
}

export function canTrashProject(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "admin"
}

/** Status de envío al cliente (columna Status del Excel). */
export const SEND_STATUS_META = {
  en_proceso: { label: "En proceso", tone: "amber", icon: "in_progress" as StatusIconId },
  enviada: { label: "Enviada al cliente", tone: "gain", icon: "sent" as StatusIconId },
} as const

/**
 * Paleta de departamentos — NO usa amarillo / naranja / verde / rojo
 * (reservados para STATUS). Sin grises (casi no se notan).
 */
export type DepartmentColorId =
  | "azul"
  | "indigo"
  | "violeta"
  | "fucsia"
  | "cian"

export type DepartmentColorOption = {
  id: DepartmentColorId
  label: string
  /** Clases del badge (fondo / texto / borde) */
  badgeClass: string
  /** Color sólido para el swatch del selector */
  swatch: string
}

export const DEPARTMENT_COLOR_OPTIONS: DepartmentColorOption[] = [
  {
    id: "azul",
    label: "Azul",
    badgeClass: "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/30",
    swatch: "#60a5fa",
  },
  {
    id: "indigo",
    label: "Índigo",
    badgeClass: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    swatch: "#818cf8",
  },
  {
    id: "violeta",
    label: "Violeta",
    badgeClass: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/30",
    swatch: "#a78bfa",
  },
  {
    id: "fucsia",
    label: "Fucsia",
    badgeClass: "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
    swatch: "#e879f9",
  },
  {
    id: "cian",
    label: "Cian",
    badgeClass: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    swatch: "#22d3ee",
  },
]

/** Mapea colores retirados / de status a la paleta actual. */
const LEGACY_DEPARTMENT_COLOR: Record<string, DepartmentColorId> = {
  gris: "azul",
  acero: "azul",
  grafito: "indigo",
  ambar: "indigo",
  naranja: "fucsia",
  verde: "cian",
  rojo: "violeta",
}

export type DepartmentConfig = {
  id: WorkDepartment
  label: string
  short: string
  colorId: DepartmentColorId
}

/** Maquinados / Soldadura con colores no-status, fáciles de distinguir. */
export const SEED_DEPARTMENTS: DepartmentConfig[] = [
  { id: "maquinados", label: "Maquinados", short: "Maquinados", colorId: "indigo" },
  { id: "soldadura", label: "Soldadura", short: "Soldadura", colorId: "fucsia" },
]

export function normalizeDepartmentColorId(colorId: string | undefined): DepartmentColorId {
  if (!colorId) return "azul"
  if (LEGACY_DEPARTMENT_COLOR[colorId]) return LEGACY_DEPARTMENT_COLOR[colorId]!
  if (DEPARTMENT_COLOR_OPTIONS.some((c) => c.id === colorId)) {
    return colorId as DepartmentColorId
  }
  return "azul"
}

export function departmentColor(colorId: DepartmentColorId | string): DepartmentColorOption {
  const id = normalizeDepartmentColorId(colorId)
  return DEPARTMENT_COLOR_OPTIONS.find((c) => c.id === id) ?? DEPARTMENT_COLOR_OPTIONS[0]!
}

export function shortDepartmentLabel(label: string): string {
  const t = label.trim()
  if (t.length <= 18) return t
  return `${t.slice(0, 16)}…`
}


/** Expande el dept compuesto legado a Maquinados + Soldadura. */
function expandDepartmentId(id: WorkDepartment): WorkDepartment[] {
  if (id === "soldadura_maquinados") return ["soldadura", "maquinados"]
  return [id]
}

/** Departamentos de una cotización (soporta legado `department` string). */
export function quotationDepartments(
  q: Pick<Quotation, "departments"> | { departments?: WorkDepartment[]; department?: WorkDepartment },
): WorkDepartment[] {
  const multi = (q as { departments?: WorkDepartment[] }).departments
  const raw =
    Array.isArray(multi) && multi.length > 0
      ? multi
      : (() => {
          const legacy = (q as { department?: WorkDepartment }).department
          return legacy ? [legacy] : []
        })()
  const expanded = raw.flatMap(expandDepartmentId)
  return [...new Set(expanded)]
}

export function quotationHasDepartment(
  q: Pick<Quotation, "departments"> | { departments?: WorkDepartment[]; department?: WorkDepartment },
  dept: WorkDepartment,
): boolean {
  return quotationDepartments(q).includes(dept)
}

export const CLIENT_RESPONSE_META: Record<
  ClientResponse,
  { label: string; tone: string; icon: StatusIconId }
> = {
  en_espera: { label: "En espera", tone: "amber", icon: "waiting" },
  aprobada: { label: "Aprobada", tone: "gain", icon: "approved" },
  rechazada: { label: "Rechazada", tone: "loss", icon: "rejected" },
}

export const CHANNEL_LABEL: Record<SupplierChannel, string> = {
  email: "Correo",
  whatsapp: "WhatsApp",
  both: "Correo + WhatsApp",
}

export function currency(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n)
}

export function currencyPrecise(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

/** Horas con decimales solo si hacen falta (ej. 20 o 20.5). */
function formatHours(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

/** Redondeo monetario MXN a 2 decimales (centavos). */
export function roundMxn(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Importe de línea: cantidad × precio unitario, redondeado. */
export function lineTotalMxn(quantity: number, unitPrice: number): number {
  return roundMxn((Number(quantity) || 0) * (Number(unitPrice) || 0))
}

/** Montos del PDF al cliente (pesos mexicanos). */
export function currencyMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMxn(n))
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * Precio unitario público sugerido (editable hasta envío al cliente).
 * Material / Extra: costo × (1 + markup). Mano de obra: tarifa $/h del catálogo.
 */
export function suggestedPublicUnitPrice(item: CatalogItem): number {
  if (item.kind === "labor") {
    return Number(item.unitCost.toFixed(2))
  }
  return Number((item.unitCost * (1 + MATERIAL_PUBLIC_MARKUP)).toFixed(2))
}

/** Alias de suggestedPublicUnitPrice (compat). */
export function suggestedPrice(item: CatalogItem): number {
  return suggestedPublicUnitPrice(item)
}

export type InternalEconomyRow = {
  id: string
  label: string
  /** Horas, % o monto base según la fila */
  basisLabel: string
  amount: number
  muted?: boolean
}

/**
 * Fórmula de economía interna (no va al PDF):
 * MO base = Σ (precio público $/h × horas); si no hay precio en línea → tarifa catálogo
 * MO cargada = MO base + IMSS 20%
 * Materiales / Extras = Σ (precio público × cant.); si no hay precio → costo × 1.10
 * Ganancia = (MO base + materiales + extras) × 60%
 * Bono anual = (ganancia + materiales + extras) × 10%
 *
 * El precio público de línea permite sobrecobrar a un cliente sin cambiar el catálogo.
 */
export function internalEconomy(
  q: Quotation,
  catalog: CatalogItem[],
): {
  laborHours: number
  laborBase: number
  laborBurden: number
  laborLoaded: number
  materialCost: number
  materialPublicSuggested: number
  extrasCost: number
  extrasPublicSuggested: number
  profit: number
  annualBonus: number
  loadedCostTotal: number
  rows: InternalEconomyRow[]
} {
  let laborHours = 0
  let laborBase = 0
  let materialCost = 0
  let materialPublic = 0
  let extrasCost = 0
  let extrasPublic = 0
  let materialsCustom = false
  let extrasCustom = false
  let laborCustom = false

  for (const line of q.lines) {
    const item = catalog.find((c) => c.id === line.itemId)
    if (!item) continue
    const qty = Number(line.quantity) || 0
    const suggested = suggestedPublicUnitPrice(item)
    const hasCustom =
      line.unitPrice != null &&
      Number.isFinite(line.unitPrice) &&
      Number(line.unitPrice) !== suggested
    const publicUnit =
      line.unitPrice != null && Number.isFinite(line.unitPrice)
        ? Number(line.unitPrice)
        : suggested

    if (item.kind === "labor") {
      laborHours += qty
      laborBase += publicUnit * qty
      if (hasCustom) laborCustom = true
    } else if (item.kind === "extra") {
      extrasCost += item.unitCost * qty
      extrasPublic += publicUnit * qty
      if (hasCustom) extrasCustom = true
    } else {
      materialCost += item.unitCost * qty
      materialPublic += publicUnit * qty
      if (hasCustom) materialsCustom = true
    }
  }

  laborBase = Number(laborBase.toFixed(2))
  materialCost = Number(materialCost.toFixed(2))
  extrasCost = Number(extrasCost.toFixed(2))
  const materialPublicSuggested = Number(materialPublic.toFixed(2))
  const extrasPublicSuggested = Number(extrasPublic.toFixed(2))
  const chargeBase = materialPublicSuggested + extrasPublicSuggested
  const laborBurden = Number((laborBase * LABOR_BURDEN_RATE).toFixed(2))
  const laborLoaded = Number((laborBase + laborBurden).toFixed(2))
  const profit = Number(((laborBase + chargeBase) * INTERNAL_PROFIT_RATE).toFixed(2))
  const annualBonus = Number(((profit + chargeBase) * ANNUAL_BONUS_RATE).toFixed(2))
  const loadedCostTotal = Number(
    (laborLoaded + materialPublicSuggested + extrasPublicSuggested + profit + annualBonus).toFixed(
      2,
    ),
  )

  const burdenPct = Math.round(LABOR_BURDEN_RATE * 100)
  const markupPct = Math.round(MATERIAL_PUBLIC_MARKUP * 100)
  const profitPct = Math.round(INTERNAL_PROFIT_RATE * 100)
  const bonusPct = Math.round(ANNUAL_BONUS_RATE * 100)

  const rows: InternalEconomyRow[] = [
    {
      id: "labor",
      label: "Mano de obra",
      basisLabel: laborCustom
        ? `${formatHours(laborHours)} h · tarifa pública (ajustada) ${currencyPrecise(laborBase)} + IMSS ${burdenPct}%`
        : `${formatHours(laborHours)} h · base ${currencyPrecise(laborBase)} + IMSS ${burdenPct}%`,
      amount: laborLoaded,
    },
    {
      id: "materials",
      label: "Materiales",
      basisLabel: materialsCustom
        ? `precio público (ajustado) · costo base ${currencyPrecise(materialCost)}`
        : `base ${currencyPrecise(materialCost)} + ${markupPct}%`,
      amount: materialPublicSuggested,
    },
    {
      id: "extras",
      label: "Extras",
      basisLabel: extrasCustom
        ? `precio público (ajustado) · costo base ${currencyPrecise(extrasCost)}`
        : `base ${currencyPrecise(extrasCost)} + ${markupPct}%`,
      amount: extrasPublicSuggested,
    },
    {
      id: "profit",
      label: "Ganancia",
      basisLabel: `${profitPct}% × (MO base ${currencyPrecise(laborBase)} + mat. ${currencyPrecise(materialPublicSuggested)} + ext. ${currencyPrecise(extrasPublicSuggested)})`,
      amount: profit,
    },
    {
      id: "annual_bonus",
      label: "Bono anual",
      basisLabel: `${bonusPct}% × (ganancia ${currencyPrecise(profit)} + mat. ${currencyPrecise(materialPublicSuggested)} + ext. ${currencyPrecise(extrasPublicSuggested)})`,
      amount: annualBonus,
    },
  ]

  return {
    laborHours,
    laborBase,
    laborBurden,
    laborLoaded,
    materialCost,
    materialPublicSuggested,
    extrasCost,
    extrasPublicSuggested,
    profit,
    annualBonus,
    loadedCostTotal,
    rows,
  }
}

/** Status operativo interno (revisión / precios / envíos). */
export function displayStatus(q: Quotation): { label: string; tone: string; icon: StatusIconId } {
  if (q.clientSentAt && q.supplierSentAt) {
    return {
      label: "Enviada a cliente y proveedor",
      tone: "teal",
      icon: "dispatched",
    }
  }
  if (q.clientSentAt) {
    return { label: "Enviada al cliente", tone: "gain", icon: "sent" }
  }
  if (q.supplierSentAt) {
    return { label: "Enviada al proveedor", tone: "teal", icon: "supplier" }
  }
  return STATUS_META[q.status]
}

/**
 * Estado de envío saliente (cliente / proveedor).
 * Un solo tag cuando ambos envíos están hechos.
 */
export function outboundSendStatus(
  q: Quotation,
): { label: string; tone: string; icon: StatusIconId } {
  if (q.clientSentAt && q.supplierSentAt) {
    return {
      label: "Enviada a cliente y proveedor",
      tone: "teal",
      icon: "dispatched",
    }
  }
  if (q.clientSentAt) {
    return { label: "Enviada al cliente", tone: "gain", icon: "sent" }
  }
  if (q.supplierSentAt) {
    return { label: "Enviada al proveedor", tone: "teal", icon: "supplier" }
  }
  return { ...SEND_STATUS_META.en_proceso }
}

/** Status de envío al cliente (como en el Excel). */
export function sendStatus(q: Quotation): { label: string; tone: string; icon: StatusIconId } {
  return q.clientSentAt ? SEND_STATUS_META.enviada : SEND_STATUS_META.en_proceso
}

/** Respuesta del cliente; vacío si aún no se envió. */
export function clientResponseOf(
  q: Quotation,
): { label: string; tone: string; icon: StatusIconId } | null {
  if (!q.clientSentAt) return null
  const key = q.clientResponse ?? "en_espera"
  return CLIENT_RESPONSE_META[key]
}
