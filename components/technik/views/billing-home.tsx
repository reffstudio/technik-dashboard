"use client"

import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Clock3,
  Hourglass,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
} from "lucide-react"
import {
  ANNUAL_BONUS_RATE,
  INTERNAL_PROFIT_RATE,
  LABOR_BURDEN_RATE,
  MATERIAL_PUBLIC_MARKUP,
} from "@/lib/technik/company"
import {
  currencyMxn,
  currencyPrecise,
  PAYMENT_METHOD_LABEL,
  projectIsHidden,
  projectTitle,
} from "@/lib/technik/data"
import { formatDisplayDate, todayLocalIso } from "@/lib/technik/dates"
import {
  aggregateInternalEconomy,
  aggregatePublicTaxTotals,
  aggregateTaxOnPaidInRange,
  openBalancesTotal,
  paymentLedger,
  upcomingCollections,
  quotationsForBillingEconomy,
  sumExpectedInRange,
  sumPaidInRange,
} from "@/lib/technik/dashboard"
import { formatYearMonthLabel, monthBounds } from "@/lib/technik/treasury"
import { quoteClientDue, useTechnik } from "@/lib/technik/store"
import { SearchField, Stat } from "../ui"
import type { View } from "../app-shell"

const EASE = [0.16, 1, 0.3, 1] as const

export function BillingHome({
  navigate,
  yearMonth,
}: {
  navigate: (v: View) => void
  yearMonth: string
}) {
  const { projects, quotations, clients, catalog, user } = useTechnik()
  const [agendaQuery, setAgendaQuery] = useState("")
  const [paidQuery, setPaidQuery] = useState("")

  const todayIso = todayLocalIso()
  const { start: monthStart, end: monthEnd } = monthBounds(yearMonth)
  const monthLabel = formatYearMonthLabel(yearMonth)

  const totalDueByProject = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of projects) {
      if (p.quotationId) {
        const q = quotations.find((x) => x.id === p.quotationId)
        map[p.id] = q ? quoteClientDue(q, catalog).total : p.totalDue ?? 0
      } else {
        map[p.id] = p.totalDue ?? 0
      }
    }
    return map
  }, [projects, quotations, catalog])

  const rangeBounds = useMemo(
    () => ({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd],
  )

  const liveProjects = useMemo(
    () => projects.filter((p) => !projectIsHidden(p, quotations)),
    [projects, quotations],
  )
  const paidInRange = useMemo(
    () => sumPaidInRange(liveProjects, rangeBounds.start, rangeBounds.end),
    [liveProjects, rangeBounds],
  )
  const expectedInRange = useMemo(
    () => sumExpectedInRange(liveProjects, rangeBounds.start, rangeBounds.end),
    [liveProjects, rangeBounds],
  )
  const activeProjects = useMemo(
    () => liveProjects.filter((p) => p.stage !== "completado"),
    [liveProjects],
  )
  const openBalance = useMemo(
    () => openBalancesTotal(activeProjects, totalDueByProject),
    [activeProjects, totalDueByProject],
  )
  const agenda = useMemo(
    () => upcomingCollections(activeProjects, undefined, todayIso),
    [activeProjects, todayIso],
  )
  const ledger = useMemo(() => paymentLedger(liveProjects, todayIso), [liveProjects, todayIso])
  const monthPaid = useMemo(
    () => ledger.filter((r) => r.paid && r.date >= monthStart && r.date <= monthEnd),
    [ledger, monthStart, monthEnd],
  )
  const overdueCount = agenda.filter((r) => r.overdue).length

  const filteredAgenda = useMemo(() => {
    const q = agendaQuery.trim().toLowerCase()
    if (!q) return agenda
    return agenda.filter((row) => {
      const meta = (() => {
        const p = projects.find((x) => x.id === row.projectId)
        if (!p) return { title: row.projectId, company: "", folio: row.projectId }
        const quote = p.quotationId
          ? quotations.find((x) => x.id === p.quotationId)
          : undefined
        const client = clients.find((c) => c.id === (quote?.clientId ?? p.clientId))
        return {
          title: projectTitle(p, quote?.title),
          company: client?.company ?? "",
          folio: p.id,
        }
      })()
      return (
        meta.company.toLowerCase().includes(q) ||
        meta.folio.toLowerCase().includes(q) ||
        meta.title.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q) ||
        String(row.amount).includes(q)
      )
    })
  }, [agenda, agendaQuery, projects, quotations, clients])

  const filteredPaid = useMemo(() => {
    const q = paidQuery.trim().toLowerCase()
    const source = q ? monthPaid : monthPaid.slice(0, 10)
    if (!q) return source
    return source.filter((row) => {
      const p = projects.find((x) => x.id === row.projectId)
      const quote = p?.quotationId
        ? quotations.find((x) => x.id === p.quotationId)
        : undefined
      const client = clients.find((c) => c.id === (quote?.clientId ?? p?.clientId))
      const company = (client?.company ?? "").toLowerCase()
      const folio = (p?.id ?? row.projectId).toLowerCase()
      const title = p ? projectTitle(p, quote?.title).toLowerCase() : ""
      const method = row.method ? PAYMENT_METHOD_LABEL[row.method].toLowerCase() : ""
      return (
        company.includes(q) ||
        folio.includes(q) ||
        title.includes(q) ||
        method.includes(q) ||
        String(row.amount).includes(q)
      )
    })
  }, [paidQuery, monthPaid, projects, quotations, clients])

  const economyQuotes = useMemo(
    () => quotationsForBillingEconomy(projects, quotations),
    [projects, quotations],
  )
  const economy = useMemo(
    () => aggregateInternalEconomy(economyQuotes, catalog),
    [economyQuotes, catalog],
  )
  const taxPortfolio = useMemo(
    () => aggregatePublicTaxTotals(economyQuotes),
    [economyQuotes],
  )
  const taxOnPaid = useMemo(
    () =>
      aggregateTaxOnPaidInRange(
        liveProjects,
        quotations,
        rangeBounds.start,
        rangeBounds.end,
      ),
    [liveProjects, quotations, rangeBounds],
  )
  const profitMarginPct =
    economy.salesTotal > 0 ? (economy.profit / economy.salesTotal) * 100 : 0
  const profitTone =
    economy.profit > 0
      ? "text-emerald-500"
      : economy.profit < 0
        ? "text-destructive"
        : "text-amber-500"

  const economyHint =
    economy.quoteCount === 0
      ? "Sin proyectos con cotización"
      : `${economy.quoteCount} cotizaci${economy.quoteCount === 1 ? "ón" : "ones"} de proyecto`

  function projectMeta(projectId: string) {
    const p = projects.find((x) => x.id === projectId)
    if (!p) return { title: projectId, company: "—" }
    const quote = p.quotationId
      ? quotations.find((q) => q.id === p.quotationId)
      : undefined
    const client = clients.find((c) => c.id === (quote?.clientId ?? p.clientId))
    return {
      title: projectTitle(p, quote?.title),
      company: client?.company ?? "—",
      folio: p.id,
    }
  }

  if (user?.role !== "admin") {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Finanzas es solo para administración.
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="block mx-auto mt-4 text-primary"
        >
          Volver al Resumen
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Agenda */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.08 }}
          className="rounded-[1.75rem] surface-card p-5 flex flex-col min-h-[360px]"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2">
              <Hourglass className="size-4 text-chart-3" />
              Agenda de cobros
            </h2>
            <span className="font-mono text-lg font-bold text-chart-3">
              {filteredAgenda.length}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Pendientes por cobrar · vencidos primero
          </p>
          <SearchField
            value={agendaQuery}
            onChange={setAgendaQuery}
            placeholder="Buscar cliente, folio o monto…"
            className="mb-3 py-1.5"
          />
          <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sin cobros pendientes. Programa un abono en el proyecto.
              </p>
            ) : filteredAgenda.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Ningún cobro coincide con la búsqueda.
              </p>
            ) : (
              filteredAgenda.map((row) => {
                const meta = projectMeta(row.projectId)
                return (
                  <button
                    key={row.installmentId}
                    type="button"
                    onClick={() => navigate({ name: "project", id: row.projectId })}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      row.overdue
                        ? "border-destructive/35 bg-destructive/5 hover:border-destructive/50"
                        : "border-border bg-muted/30 hover:border-primary/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold">
                          {currencyMxn(row.amount)}
                        </span>
                        {row.overdue && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-destructive">
                            <AlertTriangle className="size-3" />
                            Vencido
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {meta.company} · {meta.folio}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDisplayDate(row.dueDate)}
                        {row.note ? ` · ${row.note}` : ""}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        </motion.section>

        {/* Cobros del mes */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
          className="rounded-[1.75rem] surface-card p-5 flex flex-col min-h-[360px]"
        >
          <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2 mb-1">
            <Receipt className="size-4 text-primary" />
            Cobros del mes
          </h2>
          <p className="text-[11px] text-muted-foreground mb-3">
            Ya marcados como pagados en {monthLabel}
          </p>
          <SearchField
            value={paidQuery}
            onChange={setPaidQuery}
            placeholder="Buscar cliente, folio o monto…"
            className="mb-3 py-1.5"
          />
          <div className="flex flex-col gap-2">
            {monthPaid.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sin cobros registrados en este mes.
              </p>
            ) : filteredPaid.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Ningún cobro coincide con la búsqueda.
              </p>
            ) : (
              filteredPaid.map((row) => {
                const meta = projectMeta(row.projectId)
                return (
                  <button
                    key={row.installmentId}
                    type="button"
                    onClick={() => navigate({ name: "project", id: row.projectId })}
                    className="flex items-center gap-3 rounded-xl border border-fin-gain/25 bg-fin-gain/5 px-3 py-2.5 text-left hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold text-fin-gain">
                        +{currencyMxn(row.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {meta.company} · {formatDisplayDate(row.date)}
                      </p>
                      {row.method && (
                        <p className="text-[11px] text-muted-foreground">
                          {PAYMENT_METHOD_LABEL[row.method]}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                )
              })
            )}
          </div>
        </motion.section>
      </div>
      {/* KPIs tipo banco */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat
          label="Cobrado en el mes"
          value={currencyMxn(paidInRange)}
          hint={monthLabel}
          tone="teal"
          icon={Banknote}
        />
        <Stat
          label="Por cobrar (plan)"
          value={currencyMxn(expectedInRange)}
          hint="Todos los abonos pendientes"
          tone="amber"
          icon={Clock3}
        />
        <Stat
          label="Saldo abierto"
          value={currencyMxn(openBalance)}
          hint="Proyectos activos · total − pagado"
          tone="azure"
          icon={Scale}
        />
        <Stat
          label="Cobros vencidos"
          value={String(overdueCount)}
          hint="Pendientes con fecha pasada"
          tone={overdueCount > 0 ? "loss" : "neutral"}
          icon={AlertTriangle}
        />
      </div>

      {/* Economía interna — estadísticas de fórmula */}
      <div className="mb-2">
        <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2 mb-3">
          <PiggyBank className="size-4 text-primary" />
          Estadísticas · economía interna
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <Stat
            label="Ventas totales"
            value={currencyPrecise(economy.salesTotal)}
            hint={economyHint}
            tone="teal"
          />
          <Stat
            label="Ganancias"
            value={currencyPrecise(economy.profit)}
            hint={`${Math.round(INTERNAL_PROFIT_RATE * 100)}% × (MO base + materiales +${Math.round(MATERIAL_PUBLIC_MARKUP * 100)}%)`}
            tone={economy.profit > 0 ? "gain" : economy.profit < 0 ? "loss" : "amber"}
          />
          <Stat
            label="Suma bono anual"
            value={currencyPrecise(economy.annualBonus)}
            hint={`${Math.round(ANNUAL_BONUS_RATE * 100)}% × (ganancia + materiales cargados)`}
            tone="azure"
          />
        </div>
      </div>

      {/* Desglose de fórmulas */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="rounded-[1.75rem] surface-card p-5 sm:p-6 mb-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em]">
              Desglose · fórmulas
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suma de cotizaciones ligadas a proyectos. Mismas fórmulas que en revisión. IVA e ISR
              del PDF están en Impuestos, abajo.
            </p>
          </div>
          <p className={`font-mono text-sm font-bold ${profitTone}`}>
            Margen ganancia {profitMarginPct.toFixed(2)}%
          </p>
        </div>

        {economy.quoteCount === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-2xl">
            No hay proyectos con cotización para calcular la economía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">Concepto</th>
                  <th className="pb-2 pr-3 font-semibold">Fórmula</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="py-3 pr-3 font-medium">Mano de obra</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    {economy.laborHours} h · base {currencyPrecise(economy.laborBase)} + IMSS{" "}
                    {Math.round(LABOR_BURDEN_RATE * 100)}% (
                    {currencyPrecise(economy.laborBurden)})
                  </td>
                  <td className="py-3 text-right font-mono font-semibold">
                    {currencyPrecise(economy.laborLoaded)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium">Materiales</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    base {currencyPrecise(economy.materialCost)} +{" "}
                    {Math.round(MATERIAL_PUBLIC_MARKUP * 100)}%
                  </td>
                  <td className="py-3 text-right font-mono font-semibold">
                    {currencyPrecise(economy.materialPublicSuggested)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium">Extras</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    base {currencyPrecise(economy.extrasCost)} +{" "}
                    {Math.round(MATERIAL_PUBLIC_MARKUP * 100)}%
                  </td>
                  <td className="py-3 text-right font-mono font-semibold">
                    {currencyPrecise(economy.extrasPublicSuggested)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium">Ganancia</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    {Math.round(INTERNAL_PROFIT_RATE * 100)}% × (MO base{" "}
                    {currencyPrecise(economy.laborBase)} + mat.{" "}
                    {currencyPrecise(economy.materialPublicSuggested)} + ext.{" "}
                    {currencyPrecise(economy.extrasPublicSuggested)})
                  </td>
                  <td className={`py-3 text-right font-mono font-semibold ${profitTone}`}>
                    {currencyPrecise(economy.profit)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 font-medium">Bono anual</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    {Math.round(ANNUAL_BONUS_RATE * 100)}% × (ganancia{" "}
                    {currencyPrecise(economy.profit)} + mat.{" "}
                    {currencyPrecise(economy.materialPublicSuggested)} + ext.{" "}
                    {currencyPrecise(economy.extrasPublicSuggested)})
                  </td>
                  <td className="py-3 text-right font-mono font-semibold">
                    {currencyPrecise(economy.annualBonus)}
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="pt-3 pr-3 font-bold" colSpan={2}>
                    Ventas totales (suma a enviar)
                  </td>
                  <td className="pt-3 text-right font-mono text-base font-bold text-primary">
                    {currencyPrecise(economy.salesTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      {/* Impuestos · estadísticas del mes (solo lectura) */}
      <div className="mb-2 mt-2">
        <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2 mb-1">
          <Percent className="size-4 text-primary" />
          Estadísticas · impuestos
        </h2>
        <p className="text-[11px] text-muted-foreground mb-3">
          Estimados sobre cobros del mes. Si quieres reservar IVA o ISR, créalo
          en Balances → Apartados con el porcentaje que uses.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <Stat
            label="IVA estimado en cobros"
            value={currencyPrecise(taxOnPaid.tax)}
            hint={`Prorrateo según total PDF · ${monthLabel}`}
            tone="amber"
          />
          <Stat
            label="ISR retenido estimado"
            value={currencyPrecise(taxOnPaid.isrRetention)}
            hint={`${taxOnPaid.isrPctOfPaid.toFixed(1)}% de lo cobrado en el mes`}
            tone="azure"
          />
          <Stat
            label="Entrada neta estimada"
            value={currencyPrecise(taxOnPaid.netEntry)}
            hint="Cobrado − IVA + ISR (subtotal prorrateado)"
            tone="teal"
          />
        </div>
      </div>

      {/* Desglose IVA / ISR */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.03 }}
        className="rounded-[1.75rem] surface-card p-5 sm:p-6 mb-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em]">
              Desglose · IVA / ISR
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Solo analytics de cobranza: cartera = PDF; cobros = prorrata del mes. Para
              reservar un % ve a Balances → Apartados.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {taxOnPaid.paid > 0 && (
              <p className="font-mono text-sm font-bold text-chart-3">
                Impuestos {taxOnPaid.taxAndIsrPctOfPaid.toFixed(1)}% de la entrada
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate({ name: "finanzas", section: "balances" })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Crear reserva en Apartados
              <ArrowUpRight className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold">Concepto</th>
                <th className="pb-2 pr-3 text-right font-semibold">Cartera (proyectos)</th>
                <th className="pb-2 text-right font-semibold">Estimado en cobros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-3 pr-3 font-medium">Subtotal</td>
                <td className="py-3 pr-3 text-right font-mono">
                  {currencyPrecise(taxPortfolio.subtotal)}
                </td>
                <td className="py-3 text-right font-mono">
                  {currencyPrecise(taxOnPaid.subtotal)}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-medium">IVA</td>
                <td className="py-3 pr-3 text-right font-mono">
                  {currencyPrecise(taxPortfolio.tax)}
                </td>
                <td className="py-3 text-right font-mono font-semibold text-chart-3">
                  {currencyPrecise(taxOnPaid.tax)}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-medium">Retención ISR</td>
                <td className="py-3 pr-3 text-right font-mono">
                  {currencyPrecise(taxPortfolio.isrRetention)}
                </td>
                <td className="py-3 text-right font-mono font-semibold text-chart-2">
                  {currencyPrecise(taxOnPaid.isrRetention)}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="pt-3 pr-3 font-bold">Total / cobrado</td>
                <td className="pt-3 pr-3 text-right font-mono font-bold">
                  {currencyPrecise(taxPortfolio.total)}
                </td>
                <td className="pt-3 text-right font-mono font-bold text-primary">
                  {currencyPrecise(taxOnPaid.paid > 0 ? taxOnPaid.paid : paidInRange)}
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-3 text-muted-foreground">% impuestos sobre entrada</td>
                <td className="py-3 pr-3 text-right font-mono text-muted-foreground">—</td>
                <td className="py-3 text-right font-mono font-semibold">
                  {taxOnPaid.paid > 0
                    ? `${taxOnPaid.taxAndIsrPctOfPaid.toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {taxPortfolio.quoteCount === 0 && taxOnPaid.paid === 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Sin cartera con cotización ni cobros en el mes para desglosar.
          </p>
        )}
      </motion.section>

    </div>
  )
}
