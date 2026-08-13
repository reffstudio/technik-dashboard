/**
 * Tesorería mensual (reemplazo del Balance General Excel).
 * Ingresos = cobros de proyectos; egresos = captura manual.
 */

import {
  installmentIsPaid,
  projectTitle,
  roundMxn,
  type ApartadoMovement,
  type CashChannel,
  type Client,
  type ExpenseEntry,
  type PaymentMethod,
  type Project,
  type Quotation,
  type TreasuryMonth,
  type TreasurySeparado,
} from "./data"
export function yearMonthFromIso(iso: string): string {
  return iso.slice(0, 7)
}

export function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const year = Number(yearMonth.slice(0, 4))
  const month = Number(yearMonth.slice(5, 7))
  return { year, month }
}

export function monthBounds(yearMonth: string): { start: string; end: string } {
  const { year, month } = parseYearMonth(yearMonth)
  const start = `${yearMonth}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const { year, month } = parseYearMonth(yearMonth)
  const d = new Date(year, month - 1 + delta, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export function formatYearMonthLabel(yearMonth: string): string {
  const { year, month } = parseYearMonth(yearMonth)
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** efectivo → efectivo; resto (o sin method) → banco. */
export function channelFromPaymentMethod(
  method: PaymentMethod | undefined,
): CashChannel {
  return method === "efectivo" ? "efectivo" : "banco"
}

export type TreasuryIncomeRow = {
  kind: "income"
  id: string
  projectId: string
  installmentId: string
  date: string
  description: string
  amount: number
  channel: CashChannel
  method?: PaymentMethod
}

export type TreasuryExpenseRow = {
  kind: "expense"
  id: string
  expenseId: string
  date: string
  description: string
  amount: number
  channel: CashChannel
}

export type TreasuryLedgerRow = TreasuryIncomeRow | TreasuryExpenseRow

function inYearMonthIso(iso: string, yearMonth: string): boolean {
  return !!iso && iso.length >= 7 && iso.slice(0, 7) === yearMonth
}

export function monthIncomeRows(
  projects: Project[],
  quotations: Quotation[],
  clients: Client[],
  yearMonth: string,
): TreasuryIncomeRow[] {
  const quoteById = new Map(quotations.map((q) => [q.id, q]))
  const clientById = new Map(clients.map((c) => [c.id, c]))
  const rows: TreasuryIncomeRow[] = []

  for (const p of projects) {
    const quote = p.quotationId ? quoteById.get(p.quotationId) : undefined
    const clientId = quote?.clientId ?? p.clientId
    const client = clientId ? clientById.get(clientId) : undefined
    const title = projectTitle(p, quote?.title)
    const company = client?.company?.trim()

    for (const inst of p.installments ?? []) {
      if (!installmentIsPaid(inst) || !inst.paidAt) continue
      if (!inYearMonthIso(inst.paidAt, yearMonth)) continue
      const channel = channelFromPaymentMethod(inst.method)
      const note = inst.note?.trim()
      const description = note
        ? note
        : company
          ? `Pago ${company} · ${title}`
          : `Pago proyecto ${title}`
      rows.push({
        kind: "income",
        id: `inc-${p.id}-${inst.id}`,
        projectId: p.id,
        installmentId: inst.id,
        date: inst.paidAt,
        description,
        amount: inst.amount,
        channel,
        method: inst.method,
      })
    }
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return rows
}

export function monthExpenseRows(
  expenses: ExpenseEntry[],
  yearMonth: string,
): TreasuryExpenseRow[] {
  const rows: TreasuryExpenseRow[] = expenses
    .filter((e) => inYearMonthIso(e.date, yearMonth))
    .map((e) => ({
      kind: "expense" as const,
      id: `exp-${e.id}`,
      expenseId: e.id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      channel: e.channel,
    }))
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return rows
}

/** Libro unificado ordenado por fecha (ingresos + egresos). */
export function monthLedger(
  projects: Project[],
  quotations: Quotation[],
  clients: Client[],
  expenses: ExpenseEntry[],
  yearMonth: string,
): TreasuryLedgerRow[] {
  const rows: TreasuryLedgerRow[] = [
    ...monthIncomeRows(projects, quotations, clients, yearMonth),
    ...monthExpenseRows(expenses, yearMonth),
  ]
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.kind !== b.kind) return a.kind === "income" ? -1 : 1
    return a.description.localeCompare(b.description, "es")
  })
  return rows
}

export type MonthChannelFlows = {
  incomeBank: number
  incomeCash: number
  expenseBank: number
  expenseCash: number
}

export type MonthCashSummary = MonthChannelFlows & {
  openingBank: number
  openingCash: number
  availableBank: number
  availableCash: number
  availableTotal: number
  /** Mes del que se traspasó el cierre; `null` si hay apertura fijada o es el primer mes. */
  openingCarriedFrom: string | null
}

export function getTreasuryMonth(
  months: TreasuryMonth[],
  yearMonth: string,
): TreasuryMonth {
  return (
    months.find((m) => m.yearMonth === yearMonth) ?? {
      yearMonth,
      openingBank: 0,
      openingCash: 0,
    }
  )
}

export function monthChannelFlows(
  projects: Project[],
  quotations: Quotation[],
  clients: Client[],
  expenses: ExpenseEntry[],
  yearMonth: string,
): MonthChannelFlows {
  const incomes = monthIncomeRows(projects, quotations, clients, yearMonth)
  const expenseRows = monthExpenseRows(expenses, yearMonth)

  let incomeBank = 0
  let incomeCash = 0
  for (const row of incomes) {
    if (row.channel === "banco") incomeBank += row.amount
    else incomeCash += row.amount
  }

  let expenseBank = 0
  let expenseCash = 0
  for (const row of expenseRows) {
    if (row.channel === "banco") expenseBank += row.amount
    else expenseCash += row.amount
  }

  return {
    incomeBank: roundMxn(incomeBank),
    incomeCash: roundMxn(incomeCash),
    expenseBank: roundMxn(expenseBank),
    expenseCash: roundMxn(expenseCash),
  }
}

function earliestCashYearMonth(
  projects: Project[],
  expenses: ExpenseEntry[],
  treasuryMonths: TreasuryMonth[],
  throughYm: string,
): string {
  let min = throughYm
  for (const m of treasuryMonths) {
    if (m.yearMonth && m.yearMonth < min) min = m.yearMonth
  }
  for (const p of projects) {
    for (const inst of p.installments ?? []) {
      if (inst.paidAt && inst.paidAt.length >= 7) {
        const ym = inst.paidAt.slice(0, 7)
        if (ym < min) min = ym
      }
    }
  }
  for (const e of expenses) {
    if (e.date && e.date.length >= 7) {
      const ym = e.date.slice(0, 7)
      if (ym < min) min = ym
    }
  }
  return min
}

function storedOpening(
  treasuryMonths: TreasuryMonth[],
  yearMonth: string,
): { bank: number; cash: number } | null {
  const tm = treasuryMonths.find((m) => m.yearMonth === yearMonth)
  if (!tm) return null
  return { bank: tm.openingBank ?? 0, cash: tm.openingCash ?? 0 }
}

/**
 * Resumen de caja mes a mes. El cierre (último día natural) de un mes
 * se traspasa como saldo inicial del siguiente, salvo que ese mes tenga
 * una apertura fijada en `treasuryMonths`.
 */
export function monthCashSummaryMap(
  projects: Project[],
  quotations: Quotation[],
  clients: Client[],
  expenses: ExpenseEntry[],
  treasuryMonths: TreasuryMonth[],
  fromYm: string,
  toYm: string,
): Map<string, MonthCashSummary> {
  const map = new Map<string, MonthCashSummary>()
  const months = yearMonthsInclusive(fromYm, toYm)
  let carryBank = 0
  let carryCash = 0
  let prevYm: string | null = null

  for (const ym of months) {
    const stored = storedOpening(treasuryMonths, ym)
    const carried = !stored && prevYm !== null
    const openingBank = stored ? stored.bank : carryBank
    const openingCash = stored ? stored.cash : carryCash
    const flows = monthChannelFlows(projects, quotations, clients, expenses, ym)
    const availableBank = roundMxn(openingBank + flows.incomeBank - flows.expenseBank)
    const availableCash = roundMxn(openingCash + flows.incomeCash - flows.expenseCash)
    map.set(ym, {
      ...flows,
      openingBank,
      openingCash,
      availableBank,
      availableCash,
      availableTotal: roundMxn(availableBank + availableCash),
      openingCarriedFrom: carried ? prevYm : null,
    })
    carryBank = availableBank
    carryCash = availableCash
    prevYm = ym
  }
  return map
}

export function monthCashSummary(
  projects: Project[],
  quotations: Quotation[],
  clients: Client[],
  expenses: ExpenseEntry[],
  treasuryMonths: TreasuryMonth[],
  yearMonth: string,
): MonthCashSummary {
  const fromYm = earliestCashYearMonth(projects, expenses, treasuryMonths, yearMonth)
  const map = monthCashSummaryMap(
    projects,
    quotations,
    clients,
    expenses,
    treasuryMonths,
    fromYm,
    yearMonth,
  )
  return (
    map.get(yearMonth) ?? {
      incomeBank: 0,
      incomeCash: 0,
      expenseBank: 0,
      expenseCash: 0,
      openingBank: 0,
      openingCash: 0,
      availableBank: 0,
      availableCash: 0,
      availableTotal: 0,
      openingCarriedFrom: null,
    }
  )
}

/** Monto del apartado para un mes: % sobre ingresos o monto fijo. */
export function resolveSeparadoAmount(
  separado: TreasurySeparado,
  monthIncomeTotal: number,
): number {
  if (separado.kind === "percent") {
    return roundMxn(monthIncomeTotal * (separado.value / 100))
  }
  return roundMxn(separado.value)
}

export function yearMonthsInclusive(fromYm: string, toYm: string): string[] {
  if (!fromYm || !toYm || fromYm > toYm) return fromYm === toYm && fromYm ? [fromYm] : []
  const out: string[] = []
  let cur = fromYm
  let guard = 0
  while (cur <= toYm && guard < 240) {
    out.push(cur)
    cur = shiftYearMonth(cur, 1)
    guard += 1
  }
  return out
}

/** Ingresos (banco+efectivo) por mes en el rango. */
export function monthIncomeTotalsMap(
  projects: Project[],
  quotations: Quotation[],
  clients: Client[],
  expenses: ExpenseEntry[],
  _treasuryMonths: TreasuryMonth[],
  fromYm: string,
  toYm: string,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const ym of yearMonthsInclusive(fromYm, toYm)) {
    const s = monthChannelFlows(projects, quotations, clients, expenses, ym)
    map.set(ym, roundMxn(s.incomeBank + s.incomeCash))
  }
  return map
}

export function movementsForApartado(
  movements: ApartadoMovement[],
  apartadoId: string,
  throughDate?: string,
): ApartadoMovement[] {
  return movements
    .filter((m) => {
      if (m.apartadoId !== apartadoId) return false
      if (throughDate && m.date > throughDate) return false
      return true
    })
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date)
      if (d !== 0) return d
      return b.createdAt.localeCompare(a.createdAt)
    })
}

export function netMovementsAmount(movements: ApartadoMovement[]): number {
  let net = 0
  for (const m of movements) {
    net += m.kind === "in" ? m.amount : -m.amount
  }
  return roundMxn(net)
}

/** Acumulación de la regla mes a mes desde la creación hasta `throughYearMonth`. */
export function apartadoAccrualThrough(
  separado: TreasurySeparado,
  throughYearMonth: string,
  incomeByMonth: Map<string, number>,
): number {
  const fromYm = yearMonthFromIso(separado.createdAt.slice(0, 10) || throughYearMonth)
  const start = fromYm <= throughYearMonth ? fromYm : throughYearMonth
  let total = 0
  for (const ym of yearMonthsInclusive(start, throughYearMonth)) {
    total += resolveSeparadoAmount(separado, incomeByMonth.get(ym) ?? 0)
  }
  return roundMxn(total)
}

export type ResolvedSeparado = TreasurySeparado & {
  /** Apartado generado por la regla en el mes visto. */
  monthAmount: number
  /** Saldo reservado tras movimientos (hasta fin del mes visto). */
  balance: number
  movementNet: number
}

/** Reservas creadas por el admin (sin apartado fiscal automático). */
export function resolveMonthSeparados(
  separados: TreasurySeparado[],
  yearMonth: string,
  monthIncomeTotal: number,
  movements: ApartadoMovement[] = [],
  incomeByMonth?: Map<string, number>,
): ResolvedSeparado[] {
  const endDate = monthBounds(yearMonth).end
  const incomeMap =
    incomeByMonth ?? new Map<string, number>([[yearMonth, monthIncomeTotal]])

  return [...separados]
    .filter((s) => s.category === "custom" && !s.yearMonth)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((s) => {
      const monthAmount = resolveSeparadoAmount(s, monthIncomeTotal)
      const movs = movementsForApartado(movements, s.id, endDate)
      const movementNet = netMovementsAmount(movs)
      const accrual = apartadoAccrualThrough(s, yearMonth, incomeMap)
      const balance = roundMxn(Math.max(0, accrual + movementNet))
      return {
        ...s,
        monthAmount,
        movementNet,
        balance,
      }
    })
}

export type ApartadoHistoryLine = {
  id: string
  kind: "accrual" | "in" | "out"
  amount: number
  date: string
  label: string
  movementId?: string
  expenseId?: string
}

/** Historial: acumulaciones por mes (sintéticas) + movimientos reales. */
export function buildApartadoHistory(
  separado: TreasurySeparado,
  throughYearMonth: string,
  incomeByMonth: Map<string, number>,
  movements: ApartadoMovement[],
): ApartadoHistoryLine[] {
  const endDate = monthBounds(throughYearMonth).end
  const lines: ApartadoHistoryLine[] = []

  const fromYm = yearMonthFromIso(separado.createdAt.slice(0, 10) || throughYearMonth)
  const start = fromYm <= throughYearMonth ? fromYm : throughYearMonth
  for (const ym of yearMonthsInclusive(start, throughYearMonth)) {
    const amt = resolveSeparadoAmount(separado, incomeByMonth.get(ym) ?? 0)
    if (amt <= 0) continue
    lines.push({
      id: `accrual-${separado.id}-${ym}`,
      kind: "accrual",
      amount: amt,
      date: `${ym}-01`,
      label:
        separado.kind === "percent"
          ? `Acumulación ${separado.value}% · ${formatYearMonthLabel(ym)}`
          : `Acumulación fija · ${formatYearMonthLabel(ym)}`,
    })
  }

  for (const m of movementsForApartado(movements, separado.id, endDate)) {
    lines.push({
      id: m.id,
      kind: m.kind,
      amount: m.amount,
      date: m.date,
      label:
        m.note?.trim() ||
        (m.kind === "in" ? "Entrada / abono" : "Salida / adelanto"),
      movementId: m.id,
      expenseId: m.expenseId,
    })
  }

  return lines.sort((a, b) => {
    const d = b.date.localeCompare(a.date)
    if (d !== 0) return d
    return b.id.localeCompare(a.id)
  })
}

export function sumReservedOpen(resolved: ResolvedSeparado[]): number {
  return roundMxn(
    resolved.filter((s) => s.status === "open").reduce((sum, s) => sum + s.balance, 0),
  )
}

export function sumReservedPaid(resolved: ResolvedSeparado[]): number {
  return roundMxn(
    resolved.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.balance, 0),
  )
}

export function disponibleTrasApartados(
  availableTotal: number,
  reservedOpen: number,
): number {
  return roundMxn(availableTotal - reservedOpen)
}

