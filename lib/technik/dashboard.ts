/**
 * Agregados para el Home operativo (cobranza / agenda).
 * Fuente: Project.installments (paidAt / dueDate / amount).
 */

import {
  DEFAULT_ISR_RETENTION_RATE,
  DEFAULT_TAX_RATE,
} from "./company"
import { MONTH_SHORT_ES, isoDay, todayLocalIso } from "./dates"
import {
  installmentIsPaid,
  internalEconomy,
  lineTotalMxn,
  projectBillingSummary,
  roundMxn,
  type CatalogItem,
  type Project,
  type ProjectInstallment,
  type PublicQuoteItem,
  type Quotation,
} from "./data"

function inYearMonth(iso: string, year: number, month: number): boolean {
  const day = isoDay(iso)
  if (!day || day.length < 7) return false
  const y = Number(day.slice(0, 4))
  const m = Number(day.slice(5, 7))
  return y === year && m === month
}

function addDaysIso(iso: string, days: number): string {
  const day = isoDay(iso) || iso
  const [y, m, d] = day.split("-").map(Number)
  if (!y || !m || !d) return day
  const dt = new Date(y, m - 1, d + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T12:00:00`).getTime()
  const b = new Date(`${endIso}T12:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

/** Etiqueta corta para el eje X (SEP/01/2026 no cabe y aplasta la gráfica). */
function formatChartTick(iso: string, bucket: "day" | "week" | "month"): string {
  const day = isoDay(iso) || iso
  if (bucket === "month") {
    const [y, m] = day.split("-")
    const mi = Number(m)
    const mon = Number.isInteger(mi) && mi >= 1 && mi <= 12 ? MONTH_SHORT_ES[mi - 1] : m
    return `${mon}/${y ?? ""}`
  }
  if (bucket === "week") {
    const d = Number(day.slice(8, 10))
    const mi = Number(day.slice(5, 7))
    const mon = Number.isInteger(mi) && mi >= 1 && mi <= 12 ? MONTH_SHORT_ES[mi - 1] : day.slice(5, 7)
    return `${mon} ${d}`
  }
  return String(Number(day.slice(8, 10)) || day.slice(8, 10))
}

function formatShortLabel(iso: string): string {
  return formatChartTick(iso, "day")
}

function inInclusiveRange(iso: string, startIso: string, endIso: string): boolean {
  const day = isoDay(iso)
  return !!day && day >= startIso && day <= endIso
}

/** Inicio del rango “últimos N días” (incluye hoy). */
export function rangeStartForDays(
  days: number,
  todayIso = todayLocalIso(),
): string {
  return addDaysIso(todayIso, -(days - 1))
}

/** Cuotas cobradas (`paidAt`) en el mes calendario. */
export function sumPaidInMonth(projects: Project[], year: number, month: number): number {
  let sum = 0
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (inst.paidAt && inYearMonth(inst.paidAt, year, month)) {
        sum += inst.amount || 0
      }
    }
  }
  return roundMxn(sum)
}

/**
 * Cuotas pendientes con `dueDate` en el mes, solo proyectos no completados.
 * Es el dinero que se espera cobrar ese mes.
 */
export function sumExpectedInMonth(projects: Project[], year: number, month: number): number {
  let sum = 0
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (!installmentIsPaid(inst) && inYearMonth(inst.dueDate, year, month)) {
        sum += inst.amount || 0
      }
    }
  }
  return roundMxn(sum)
}

export type CashflowPoint = {
  date: string
  label: string
  cobrado: number
  esperado: number
}

/** Cobrado (`paidAt`) dentro de [startIso, endIso]. */
export function sumPaidInRange(
  projects: Project[],
  startIso: string,
  endIso: string,
): number {
  let sum = 0
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (inst.paidAt && inInclusiveRange(inst.paidAt, startIso, endIso)) {
        sum += inst.amount || 0
      }
    }
  }
  return roundMxn(sum)
}

/**
 * Pendiente por cobrar: todas las cuotas no pagadas (incluye taller completado).
 */
export function sumExpectedInRange(
  projects: Project[],
  _startIso?: string,
  _endIso?: string,
): number {
  let sum = 0
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (installmentIsPaid(inst)) continue
      const amount = Number(inst.amount) || 0
      if (amount > 0) sum += amount
    }
  }
  return roundMxn(sum)
}

/**
 * Serie diaria de los últimos `days` días (incluye hoy).
 */
export function cashflowSeries(
  projects: Project[],
  days = 14,
  todayIso = todayLocalIso(),
): CashflowPoint[] {
  const start = rangeStartForDays(days, todayIso)
  return cashflowSeriesInRange(projects, start, todayIso)
}

/**
 * Serie en un rango inclusive.
 * ≤ 60 días: puntos diarios. ≤ 180: semanales. > 180: mensuales.
 */
export function cashflowSeriesInRange(
  projects: Project[],
  startIso: string,
  endIso: string,
): CashflowPoint[] {
  if (!startIso || !endIso || startIso > endIso) return []

  const span = daysBetween(startIso, endIso) + 1
  const bucket: "day" | "week" | "month" =
    span <= 60 ? "day" : span <= 180 ? "week" : "month"

  const map = new Map<string, { cobrado: number; esperado: number; label: string }>()

  function bucketKey(iso: string): string {
    if (bucket === "day") return iso
    if (bucket === "week") {
      // lunes de esa semana
      const d = new Date(`${iso}T12:00:00`)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      return d.toISOString().slice(0, 10)
    }
    return iso.slice(0, 7) // YYYY-MM
  }

  function bucketLabel(key: string): string {
    return formatChartTick(key, bucket)
  }

  if (bucket === "day") {
    for (let i = 0; i < span; i++) {
      const date = addDaysIso(startIso, i)
      map.set(date, { cobrado: 0, esperado: 0, label: formatShortLabel(date) })
    }
  }

  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (inst.paidAt && inInclusiveRange(inst.paidAt, startIso, endIso)) {
        const key = bucketKey(isoDay(inst.paidAt) || inst.paidAt)
        const row = map.get(key) ?? { cobrado: 0, esperado: 0, label: bucketLabel(key) }
        row.cobrado += inst.amount || 0
        map.set(key, row)
      }
      if (installmentIsPaid(inst)) continue
      const due = isoDay(inst.dueDate)
      const amount = Number(inst.amount) || 0
      if (amount <= 0) continue
      const plot = !due
        ? startIso
        : due < startIso
          ? startIso
          : due > endIso
            ? endIso
            : due
      const key = bucketKey(plot)
      const row = map.get(key) ?? { cobrado: 0, esperado: 0, label: bucketLabel(key) }
      row.esperado += amount
      map.set(key, row)
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      label: v.label,
      cobrado: roundMxn(v.cobrado),
      esperado: roundMxn(v.esperado),
    }))
}

export type UpcomingCollection = {
  projectId: string
  installmentId: string
  amount: number
  dueDate: string
  note?: string
  overdue: boolean
  installment: ProjectInstallment
}

/** Cuotas pendientes (vencidas primero). Incluye proyectos ya entregados. */
export function upcomingCollections(
  projects: Project[],
  limit?: number,
  todayIso = todayLocalIso(),
): UpcomingCollection[] {
  const rows: UpcomingCollection[] = []
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (installmentIsPaid(inst)) continue
      const due = isoDay(inst.dueDate) || inst.dueDate || ""
      rows.push({
        projectId: p.id,
        installmentId: inst.id,
        amount: inst.amount,
        dueDate: due,
        note: inst.note,
        overdue: Boolean(due) && due < todayIso,
        installment: inst,
      })
    }
  }
  rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
  })
  return limit != null ? rows.slice(0, limit) : rows
}

/** Σ saldos abiertos (total PDF o totalDue − pagado), también si el taller ya cerró. */
export function openBalancesTotal(
  projects: Project[],
  totalDueByProjectId: Record<string, number>,
): number {
  let sum = 0
  for (const p of projects) {
    const due = totalDueByProjectId[p.id] ?? p.totalDue ?? 0
    sum += projectBillingSummary(p, due).balance
  }
  return roundMxn(sum)
}

export type PaymentLedgerRow = {
  projectId: string
  installmentId: string
  amount: number
  /** Fecha relevante: paidAt si cobrada, dueDate si pendiente */
  date: string
  paid: boolean
  overdue: boolean
  note?: string
  invoiceUuid?: string
  paymentComplement?: ProjectInstallment["paymentComplement"]
  method?: ProjectInstallment["method"]
}

/** Movimientos de cobranza (cobrados + pendientes), más recientes / urgentes primero. */
export function paymentLedger(
  projects: Project[],
  todayIso = todayLocalIso(),
): PaymentLedgerRow[] {
  const rows: PaymentLedgerRow[] = []
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      const paid = installmentIsPaid(inst)
      rows.push({
        projectId: p.id,
        installmentId: inst.id,
        amount: inst.amount,
        date: paid ? isoDay(inst.paidAt) || (inst.paidAt as string) : isoDay(inst.dueDate) || inst.dueDate,
        paid,
        overdue: !paid && isoDay(inst.dueDate) < todayIso,
        note: inst.note,
        invoiceUuid: inst.invoiceUuid,
        paymentComplement: inst.paymentComplement,
        method: inst.method,
      })
    }
  }
  rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    if (a.paid !== b.paid) return a.paid ? 1 : -1
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  })
  return rows
}

/** Cobrado en el mes calendario actual vs el mes anterior (para deltas tipo banco). */
export function monthPaidDelta(
  projects: Project[],
  todayIso = todayLocalIso(),
): { current: number; previous: number } {
  const y = Number(todayIso.slice(0, 4))
  const m = Number(todayIso.slice(5, 7))
  const prevY = m === 1 ? y - 1 : y
  const prevM = m === 1 ? 12 : m - 1
  return {
    current: sumPaidInMonth(projects, y, m),
    previous: sumPaidInMonth(projects, prevY, prevM),
  }
}

/**
 * Cotizaciones ligadas a proyectos, opcionalmente filtradas por `createdAt` en el periodo.
 * Base para ventas / ganancia / bono en Facturación.
 */
export function quotationsForBillingEconomy(
  projects: Project[],
  quotations: Quotation[],
  startIso?: string,
  endIso?: string,
): Quotation[] {
  const ids = new Set(
    projects
      .filter((p) => !p.deletedAt)
      .map((p) => p.quotationId)
      .filter((id): id is string => Boolean(id)),
  )
  return quotations.filter((q) => {
    if (q.deletedAt) return false
    if (!ids.has(q.id)) return false
    if (startIso && endIso) {
      return inInclusiveRange(q.createdAt, startIso, endIso)
    }
    return true
  })
}

export type EconomyAggregate = {
  quoteCount: number
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
  /** Suma de totales a enviar al cliente (fórmula interna). */
  salesTotal: number
}

/** Suma la economía interna de varias cotizaciones (mismas fórmulas que revisión). */
export function aggregateInternalEconomy(
  quotations: Quotation[],
  catalog: CatalogItem[],
): EconomyAggregate {
  let laborHours = 0
  let laborBase = 0
  let laborBurden = 0
  let laborLoaded = 0
  let materialCost = 0
  let materialPublicSuggested = 0
  let extrasCost = 0
  let extrasPublicSuggested = 0
  let profit = 0
  let annualBonus = 0
  let salesTotal = 0

  for (const q of quotations) {
    const e = internalEconomy(q, catalog)
    laborHours += e.laborHours
    laborBase += e.laborBase
    laborBurden += e.laborBurden
    laborLoaded += e.laborLoaded
    materialCost += e.materialCost
    materialPublicSuggested += e.materialPublicSuggested
    extrasCost += e.extrasCost
    extrasPublicSuggested += e.extrasPublicSuggested
    profit += e.profit
    annualBonus += e.annualBonus
    salesTotal += e.loadedCostTotal
  }

  return {
    quoteCount: quotations.length,
    laborHours: Number(laborHours.toFixed(2)),
    laborBase: roundMxn(laborBase),
    laborBurden: roundMxn(laborBurden),
    laborLoaded: roundMxn(laborLoaded),
    materialCost: roundMxn(materialCost),
    materialPublicSuggested: roundMxn(materialPublicSuggested),
    extrasCost: roundMxn(extrasCost),
    extrasPublicSuggested: roundMxn(extrasPublicSuggested),
    profit: roundMxn(profit),
    annualBonus: roundMxn(annualBonus),
    salesTotal: roundMxn(salesTotal),
  }
}

export type TaxTotalsAggregate = {
  quoteCount: number
  subtotal: number
  tax: number
  isrRetention: number
  total: number
}

/** Misma fórmula que `publicQuoteTotals` (PDF al cliente), sin depender del store. */
function pdfTotals(
  items: PublicQuoteItem[],
  taxRate = DEFAULT_TAX_RATE,
  isrRetentionRate = DEFAULT_ISR_RETENTION_RATE,
) {
  const rateIva = Number.isFinite(taxRate) ? taxRate : 0
  const rateIsr = Number.isFinite(isrRetentionRate) ? isrRetentionRate : 0
  const partial = roundMxn(
    items.reduce((sum, it) => sum + lineTotalMxn(it.quantity, it.unitPrice), 0),
  )
  const subtotal = partial
  const tax = roundMxn(subtotal * rateIva)
  const isrRetention = roundMxn(subtotal * rateIsr)
  const total = roundMxn(subtotal + tax - isrRetention)
  return { subtotal, tax, isrRetention, total }
}

/** Suma de totales PDF (subtotal, IVA, ISR, total) de cotizaciones de proyecto. */
export function aggregatePublicTaxTotals(quotations: Quotation[]): TaxTotalsAggregate {
  let subtotal = 0
  let tax = 0
  let isrRetention = 0
  let total = 0

  for (const q of quotations) {
    const t = pdfTotals(q.publicItems ?? [], q.taxRate, q.isrRetentionRate)
    subtotal += t.subtotal
    tax += t.tax
    isrRetention += t.isrRetention
    total += t.total
  }

  return {
    quoteCount: quotations.length,
    subtotal: roundMxn(subtotal),
    tax: roundMxn(tax),
    isrRetention: roundMxn(isrRetention),
    total: roundMxn(total),
  }
}

export type TaxOnPaidAggregate = {
  paid: number
  subtotal: number
  tax: number
  isrRetention: number
  /** Entrada neta ≈ subtotal prorrateado (cobrado − IVA + ISR). */
  netEntry: number
  taxPctOfPaid: number
  isrPctOfPaid: number
  taxAndIsrPctOfPaid: number
}

/**
 * Desglose fiscal estimado desde `totalDue`:
 * total = subtotal × (1 + iva − isr).
 */
function estimateTaxFromDue(
  due: number,
  taxRate = DEFAULT_TAX_RATE,
  isrRate = DEFAULT_ISR_RETENTION_RATE,
): { subtotal: number; tax: number; isrRetention: number; total: number } {
  const iva = Number.isFinite(taxRate) ? taxRate : 0
  const isr = Number.isFinite(isrRate) ? isrRate : 0
  const factor = 1 + iva - isr
  if (!due || due <= 0 || factor <= 0) {
    return { subtotal: 0, tax: 0, isrRetention: 0, total: roundMxn(due || 0) }
  }
  const subtotal = roundMxn(due / factor)
  const tax = roundMxn(subtotal * iva)
  const isrRetention = roundMxn(subtotal * isr)
  return { subtotal, tax, isrRetention, total: roundMxn(due) }
}

function projectTaxBreakdown(
  p: Project,
  quotations: Quotation[],
): { subtotal: number; tax: number; isrRetention: number; total: number } {
  if (p.quotationId) {
    const q = quotations.find((x) => x.id === p.quotationId)
    if (q) {
      const items = q.publicItems ?? []
      if (items.length > 0) {
        return pdfTotals(items, q.taxRate, q.isrRetentionRate)
      }
      if ((p.totalDue ?? 0) > 0) {
        return estimateTaxFromDue(p.totalDue ?? 0, q.taxRate, q.isrRetentionRate)
      }
    }
  }
  return estimateTaxFromDue(p.totalDue ?? 0)
}

/**
 * IVA / ISR estimados sobre cuotas cobradas en el periodo (prorrata vs total del proyecto).
 */
export function aggregateTaxOnPaidInRange(
  projects: Project[],
  quotations: Quotation[],
  startIso: string,
  endIso: string,
): TaxOnPaidAggregate {
  let paid = 0
  let subtotal = 0
  let tax = 0
  let isrRetention = 0

  for (const p of projects) {
    const breakdown = projectTaxBreakdown(p, quotations)
    const due = breakdown.total
    if (due <= 0) continue

    for (const inst of p.installments ?? []) {
      if (!inst.paidAt || !inInclusiveRange(inst.paidAt, startIso, endIso)) continue
      const amount = inst.amount || 0
      if (amount === 0) continue
      const share = amount / due
      paid += amount
      subtotal += breakdown.subtotal * share
      tax += breakdown.tax * share
      isrRetention += breakdown.isrRetention * share
    }
  }

  paid = roundMxn(paid)
  subtotal = roundMxn(subtotal)
  tax = roundMxn(tax)
  isrRetention = roundMxn(isrRetention)
  const netEntry = roundMxn(paid - tax + isrRetention)

  return {
    paid,
    subtotal,
    tax,
    isrRetention,
    netEntry,
    taxPctOfPaid: paid > 0 ? (tax / paid) * 100 : 0,
    isrPctOfPaid: paid > 0 ? (isrRetention / paid) * 100 : 0,
    taxAndIsrPctOfPaid: paid > 0 ? ((tax + isrRetention) / paid) * 100 : 0,
  }
}
