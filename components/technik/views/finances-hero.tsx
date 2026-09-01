"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  CircleDollarSign,
  Landmark,
  Wallet,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { currencyMxn, projectIsHidden } from "@/lib/technik/data"
import {
  cashflowSeriesInRange,
  sumExpectedInRange,
  sumPaidInRange,
} from "@/lib/technik/dashboard"
import {
  formatYearMonthLabel,
  monthBounds,
  monthCashSummary,
  shiftYearMonth,
} from "@/lib/technik/treasury"
import { useTechnik } from "@/lib/technik/store"

export type FinancesSection = "facturacion" | "balances"

const EASE = [0.16, 1, 0.3, 1] as const
const SLIDE_MS = 7000

export function FinancesHero({ yearMonth }: { yearMonth: string }) {
  const { projects, quotations, clients, expenses, treasuryMonths } = useTechnik()
  const { start, end } = monthBounds(yearMonth)
  const liveProjects = useMemo(
    () => projects.filter((p) => !projectIsHidden(p, quotations)),
    [projects, quotations],
  )

  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => {
      setSlide((s) => (s === 0 ? 1 : 0))
    }, SLIDE_MS)
    return () => window.clearInterval(t)
  }, [paused, slide])

  const series = useMemo(
    () => cashflowSeriesInRange(liveProjects, start, end),
    [liveProjects, start, end],
  )
  const paidInRange = useMemo(
    () => sumPaidInRange(liveProjects, start, end),
    [liveProjects, start, end],
  )
  const expectedInRange = useMemo(
    () => sumExpectedInRange(liveProjects, start, end),
    [liveProjects, start, end],
  )
  const prevBounds = monthBounds(shiftYearMonth(yearMonth, -1))
  const prevPaid = useMemo(
    () => sumPaidInRange(liveProjects, prevBounds.start, prevBounds.end),
    [liveProjects, prevBounds.start, prevBounds.end],
  )
  const monthChangePct =
    prevPaid > 0
      ? ((paidInRange - prevPaid) / prevPaid) * 100
      : paidInRange > 0
        ? 100
        : 0

  const balances = useMemo(
    () =>
      monthCashSummary(
        liveProjects,
        quotations,
        clients,
        expenses,
        treasuryMonths,
        yearMonth,
      ),
    [liveProjects, quotations, clients, expenses, treasuryMonths, yearMonth],
  )

  const monthLabel = formatYearMonthLabel(yearMonth)
  const chartEmpty = series.every((p) => p.cobrado === 0 && p.esperado === 0)

  function goTo(index: number) {
    setSlide(index)
  }

  return (
    <section
      className="rounded-[1.75rem] surface-card overflow-hidden mb-4 relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false)
      }}
    >
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-0.5 backdrop-blur-sm"
        role="tablist"
        aria-label="Vista del resumen"
      >
        {(
          [
            { id: 0, label: "F", title: "Facturación" },
            { id: 1, label: "B", title: "Balances" },
          ] as const
        ).map((tab) => {
          const active = slide === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.title}
              title={tab.title}
              onClick={() => goTo(tab.id)}
              className={`flex size-7 items-center justify-center rounded-md text-[11px] font-bold tracking-wide transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="relative h-[340px] sm:h-[380px]">
        <AnimatePresence initial={false} mode="sync">
          {slide === 0 ? (
            <motion.div
              key="cobranza"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="absolute inset-0 flex flex-col p-5 sm:p-6 pr-16 sm:pr-20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2 shrink-0">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5">
                    <CircleDollarSign className="size-3.5 text-primary" />
                    Flujo de cobranza
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {monthLabel} · Facturación
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" />
                    Cobrado {currencyMxn(paidInRange)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-chart-3" />
                    Por cobrar {currencyMxn(expectedInRange)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4 mb-2 shrink-0">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cobrado en el mes
                  </p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold tracking-tighter text-primary">
                    {currencyMxn(paidInRange)}
                  </p>
                </div>
                {(prevPaid > 0 || paidInRange > 0) && (
                  <p
                    className={`text-xs font-semibold pb-1 ${
                      monthChangePct >= 0 ? "text-fin-gain" : "text-destructive"
                    }`}
                  >
                    {monthChangePct >= 0 ? "+" : ""}
                    {monthChangePct.toFixed(0)}% vs mes anterior
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 w-full">
                {chartEmpty ? (
                  <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                    Sin movimientos de cobranza en este mes.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="finHeroCobrado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="finHeroEsperado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        tickFormatter={(v) =>
                          v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(value: number, name: string) => [
                          currencyMxn(value),
                          name === "cobrado" ? "Cobrado" : "Por cobrar",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cobrado"
                        stroke="var(--primary)"
                        fill="url(#finHeroCobrado)"
                        strokeWidth={2}
                        name="cobrado"
                      />
                      <Area
                        type="monotone"
                        dataKey="esperado"
                        stroke="var(--chart-3)"
                        fill="url(#finHeroEsperado)"
                        strokeWidth={2}
                        name="esperado"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="balances"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="absolute inset-0 flex flex-col p-5 sm:p-6 pr-16 sm:pr-20"
            >
              <div className="mb-3 shrink-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5">
                  <Landmark className="size-3.5 text-primary" />
                  Totales de balances
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {monthLabel} · Disponible banco y efectivo
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3 mb-4 shrink-0">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Wallet className="size-3" />
                    Disponible total
                  </p>
                  <p className="font-mono text-3xl sm:text-4xl font-bold tracking-tighter text-primary mt-1">
                    {currencyMxn(balances.availableTotal)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 shrink-0">
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Banco
                  </p>
                  <p className="font-mono text-lg font-bold mt-1">
                    {currencyMxn(balances.availableBank)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Efectivo
                  </p>
                  <p className="font-mono text-lg font-bold mt-1">
                    {currencyMxn(balances.availableCash)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-3 col-span-2 lg:col-span-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Flujo del mes
                  </p>
                  <p className="text-xs mt-1.5">
                    <span className="text-fin-gain font-semibold">
                      +{currencyMxn(balances.incomeBank + balances.incomeCash)}
                    </span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-destructive font-semibold">
                      −{currencyMxn(balances.expenseBank + balances.expenseCash)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-4">
                <div className="rounded-lg bg-fin-gain/10 px-2.5 py-2">
                  <p className="text-muted-foreground">Ing. banco</p>
                  <p className="font-mono font-bold text-fin-gain">
                    {currencyMxn(balances.incomeBank)}
                  </p>
                </div>
                <div className="rounded-lg bg-destructive/10 px-2.5 py-2">
                  <p className="text-muted-foreground">Egr. banco</p>
                  <p className="font-mono font-bold text-destructive">
                    {currencyMxn(balances.expenseBank)}
                  </p>
                </div>
                <div className="rounded-lg bg-fin-gain/10 px-2.5 py-2">
                  <p className="text-muted-foreground">Ing. efectivo</p>
                  <p className="font-mono font-bold text-fin-gain">
                    {currencyMxn(balances.incomeCash)}
                  </p>
                </div>
                <div className="rounded-lg bg-destructive/10 px-2.5 py-2">
                  <p className="text-muted-foreground">Egr. efectivo</p>
                  <p className="font-mono font-bold text-destructive">
                    {currencyMxn(balances.expenseCash)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border/60">
        <motion.div
          key={`${slide}-${paused}`}
          className="h-full bg-primary/70 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: paused ? 0 : 1 }}
          transition={{ duration: paused ? 0 : SLIDE_MS / 1000, ease: "linear" }}
        />
      </div>
    </section>
  )
}
