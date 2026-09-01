"use client"

import { useEffect, useMemo, useState, type ElementType } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Hourglass,
  Inbox,
  Plus,
  Receipt,
  Send,
  Trash2,
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
import {
  currencyMxn,
  isQuotationCreator,
  projectIsHidden,
  projectNextInstallment,
  quotationIsTrashed,
  quotePipelineStatus,
  type Quotation,
} from "@/lib/technik/data"
import { formatDisplayDate, todayLocalIso } from "@/lib/technik/dates"
import {
  cashflowSeriesInRange,
  openBalancesTotal,
  sumExpectedInRange,
  sumPaidInRange,
  upcomingCollections,
} from "@/lib/technik/dashboard"
import {
  formatYearMonthLabel,
  monthBounds,
  monthCashSummary,
  yearMonthFromIso,
} from "@/lib/technik/treasury"
import { quotationReviewQueuedMs } from "@/lib/technik/notifications"
import { quoteClientDue, useTechnik } from "@/lib/technik/store"
import {
  ClientResponseBadge,
  DepartmentBadges,
  MonthSwitcher,
  ProjectStageBadge,
  QuoteAuthor,
  StatusBadge,
} from "../ui"
import type { View } from "../app-shell"

const EASE = [0.16, 1, 0.3, 1] as const

function greetingForHour(hour: number): string {
  if (hour < 12) return "Buenos días"
  if (hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

const SCRAMBLE_POOL = "0123456789"

function isScrambleableChar(char: string) {
  return /[0-9A-Za-z]/.test(char)
}

/** Números del slideshow: scramble de caracteres al montar / cambiar valor. */
function ScrambleText({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value)
      return
    }

    let frame = 0
    const chars = Array.from(value)
    const settleStart = 4
    const settleStep = 1
    const maxFrame = settleStart + chars.length * settleStep + 6

    setDisplay(
      chars
        .map((char) =>
          isScrambleableChar(char)
            ? SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)]!
            : char,
        )
        .join(""),
    )

    const id = window.setInterval(() => {
      frame += 1
      if (frame >= maxFrame) {
        setDisplay(value)
        window.clearInterval(id)
        return
      }
      setDisplay(
        chars
          .map((char, i) => {
            if (!isScrambleableChar(char)) return char
            if (frame >= settleStart + i * settleStep) return char
            return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)]!
          })
          .join(""),
      )
    }, 32)

    return () => window.clearInterval(id)
  }, [value])

  return (
    <span className={className} aria-label={value}>
      {display}
    </span>
  )
}

export function DashboardHome({ navigate }: { navigate: (v: View) => void }) {
  const { user } = useTechnik()
  if (!user) return null
  return user.role === "admin" ? (
    <AdminDashboard navigate={navigate} />
  ) : (
    <EmployeeDashboard navigate={navigate} />
  )
}

function AdminDashboard({ navigate }: { navigate: (v: View) => void }) {
  const {
    quotations,
    clients,
    catalog,
    user,
    projects,
    expenses,
    treasuryMonths,
    inboxEvents,
    purgeExpiredTrashedDrafts,
  } = useTechnik()

  useEffect(() => {
    purgeExpiredTrashedDrafts()
  }, [purgeExpiredTrashedDrafts])
  const [yearMonth, setYearMonth] = useState(() => yearMonthFromIso(todayLocalIso()))
  const [finanzasPane, setFinanzasPane] = useState<"F" | "B">("F")
  const [finanzasPaused, setFinanzasPaused] = useState(false)

  const now = new Date()
  const todayIso = todayLocalIso()
  const { start: monthStart, end: monthEnd } = monthBounds(yearMonth)
  const monthLabel = formatYearMonthLabel(yearMonth)

  useEffect(() => {
    if (finanzasPaused) return
    const t = window.setInterval(() => {
      setFinanzasPane((p) => (p === "F" ? "B" : "F"))
    }, 5000)
    return () => window.clearInterval(t)
  }, [finanzasPaused, finanzasPane])

  const pending = useMemo(
    () =>
      quotations
        .filter((q) => !quotationIsTrashed(q) && quotePipelineStatus(q) === "pending_review")
        .sort((a, b) => {
          const d = quotationReviewQueuedMs(b, inboxEvents) - quotationReviewQueuedMs(a, inboxEvents)
          if (d !== 0) return d
          return b.reference.localeCompare(a.reference)
        }),
    [quotations, inboxEvents],
  )
  const waiting = useMemo(
    () =>
      quotations.filter(
        (q) =>
          !quotationIsTrashed(q) &&
          quotePipelineStatus(q) === "sent_client" &&
          (q.clientResponse ?? "en_espera") === "en_espera",
      ),
    [quotations],
  )
  const liveProjects = useMemo(
    () => projects.filter((p) => !projectIsHidden(p, quotations)),
    [projects, quotations],
  )
  const activeProjects = useMemo(
    () => liveProjects.filter((p) => p.stage !== "completado"),
    [liveProjects],
  )

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

  const paidInRange = useMemo(
    () => sumPaidInRange(liveProjects, rangeBounds.start, rangeBounds.end),
    [liveProjects, rangeBounds],
  )
  const expectedInRange = useMemo(
    () => sumExpectedInRange(liveProjects, rangeBounds.start, rangeBounds.end),
    [liveProjects, rangeBounds],
  )
  const openBalance = useMemo(
    () => openBalancesTotal(activeProjects, totalDueByProject),
    [activeProjects, totalDueByProject],
  )
  const series = useMemo(
    () => cashflowSeriesInRange(liveProjects, rangeBounds.start, rangeBounds.end),
    [liveProjects, rangeBounds],
  )
  const agenda = useMemo(
    () => upcomingCollections(activeProjects, undefined, todayIso),
    [activeProjects, todayIso],
  )
  const treasuryYearMonth = yearMonth
  const balances = useMemo(
    () =>
      monthCashSummary(
        liveProjects,
        quotations,
        clients,
        expenses,
        treasuryMonths,
        treasuryYearMonth,
      ),
    [liveProjects, quotations, clients, expenses, treasuryMonths, treasuryYearMonth],
  )
  const balancesMonthLabel = formatYearMonthLabel(treasuryYearMonth)

  const firstName = user?.name.split(" ")[0] ?? "Admin"
  const greet = greetingForHour(now.getHours())

  const overdueCollections = agenda.filter((r) => r.overdue).length
  const slideshowSlides = useMemo(
    () => [
      {
        id: "nuevas",
        eyebrow: "Nuevas cotizaciones",
        title: String(pending.length),
        subtitle: "Pendientes de revisión interna",
        detail:
          pending.length === 0
            ? "Cola limpia"
            : `${pending[0] ? clients.find((c) => c.id === pending[0]!.clientId)?.company ?? "Cotización" : ""} en espera de revisión`,
        icon: Inbox,
        tone: "text-primary",
        onClick: () => navigate({ name: "quotations" }),
      },
      {
        id: "dinero",
        eyebrow: "Finanzas",
        title: currencyMxn(paidInRange),
        subtitle: `Facturación · ${monthLabel}`,
        detail: `Por cobrar ${currencyMxn(expectedInRange)} · Saldo abierto ${currencyMxn(openBalance)}`,
        icon: Wallet,
        tone: "text-primary",
        onClick: () => navigate({ name: "finanzas", section: "facturacion" }),
      },
      {
        id: "balances",
        eyebrow: "Finanzas",
        title: currencyMxn(balances.availableTotal),
        subtitle: `Balances · ${balancesMonthLabel}`,
        detail: `Banco ${currencyMxn(balances.availableBank)} · Efectivo ${currencyMxn(balances.availableCash)}`,
        icon: Wallet,
        tone: "text-primary",
        onClick: () => navigate({ name: "finanzas", section: "balances" }),
      },
      {
        id: "seguimiento_cobros",
        eyebrow: "Seguimiento y cobros",
        title: String(waiting.length + agenda.length),
        subtitle: `${waiting.length} cotiz. · ${agenda.length} cobros`,
        detail:
          overdueCollections > 0
            ? `${overdueCollections} cobro(s) vencido(s)`
            : waiting.length > 0
              ? `${waiting[0] ? clients.find((c) => c.id === waiting[0]!.clientId)?.company ?? "Cliente" : ""} esperando respuesta`
              : agenda[0]
                ? `Próximo cobro ${currencyMxn(agenda[0].amount)} · ${formatDisplayDate(agenda[0].dueDate)}`
                : "Sin pendientes de seguimiento ni cobro",
        icon: Hourglass,
        tone: overdueCollections > 0 ? "text-destructive" : "text-chart-3",
        onClick: () => navigate({ name: "quotations" }),
      },
      {
        id: "proyectos",
        eyebrow: "Proyectos",
        title: String(activeProjects.length),
        subtitle: "Activos en taller",
        detail:
          activeProjects.length === 0
            ? "Sin proyectos en curso"
            : `${activeProjects.filter((p) => p.stage === "atrasado").length} con retraso en taller`,
        icon: FolderKanban,
        tone: "text-primary",
        onClick: () => navigate({ name: "projects" }),
      },
    ],
    [
      paidInRange,
      expectedInRange,
      openBalance,
      monthLabel,
      balances,
      balancesMonthLabel,
      pending,
      waiting,
      activeProjects,
      agenda,
      overdueCollections,
      clients,
      navigate,
    ],
  )

  const [slideIndex, setSlideIndex] = useState(0)
  useEffect(() => {
    if (slideshowSlides.length <= 1) return
    const t = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % slideshowSlides.length)
    }, 4500)
    return () => window.clearInterval(t)
  }, [slideshowSlides.length])

  const slide = slideshowSlides[slideIndex] ?? slideshowSlides[0]!
  const SlideIcon = slide.icon

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="text-2xl sm:text-3xl font-bold font-display tracking-tight"
        >
          {greet}, {firstName}
        </motion.h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aquí tienes el resumen de lo que está sucediendo en el proceso de Technik Solutions.
        </p>
      </div>

      {/* Slideshow overview — mitad imagen + fade por máscara (sin corte duro) */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="rounded-[1.75rem] surface-card mb-4 relative overflow-hidden isolate min-h-[200px] sm:min-h-[220px]"
      >
        <div
          className="hero-mask-half pointer-events-none absolute inset-y-0 right-0 w-1/2 z-0"
          aria-hidden
        >
          <Image
            src="/brand/overview-hero.png"
            alt=""
            fill
            sizes="50vw"
            className="object-cover object-[62%_center]"
            priority
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between px-6 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-8 min-h-[200px] sm:min-h-[220px] w-full sm:w-[58%] lg:w-[55%]">
          <button
            type="button"
            onClick={() => slide.onClick()}
            className="w-full text-left group"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                  <SlideIcon className={`size-4 ${slide.tone}`} />
                  {slide.eyebrow}
                </p>
                <p
                  className={`text-5xl sm:text-6xl lg:text-7xl font-mono font-bold tracking-tighter tabular-nums mt-3 sm:mt-4 leading-none ${slide.tone}`}
                >
                  <ScrambleText value={slide.title} />
                </p>
                <p className="text-base sm:text-lg font-semibold text-foreground mt-3 sm:mt-4">
                  {slide.subtitle}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-snug">
                  {slide.detail}
                </p>
                <span
                  className={`mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${slide.tone} opacity-80 group-hover:opacity-100 transition-opacity`}
                >
                  Ver detalle
                  <ArrowUpRight className="size-3.5" />
                </span>
              </motion.div>
            </AnimatePresence>
          </button>
          <div className="flex items-center gap-2 mt-6">
            {slideshowSlides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Ver ${s.eyebrow}`}
                onClick={() => setSlideIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === slideIndex
                    ? "w-8 bg-primary"
                    : "w-2 bg-border hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* Pills fijas en 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Finanzas: Facturación / Balances (auto) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
        className="rounded-[1.75rem] surface-card p-5 sm:p-6 flex flex-col h-[420px] sm:h-[440px] group relative"
        onMouseEnter={() => setFinanzasPaused(true)}
        onMouseLeave={() => setFinanzasPaused(false)}
      >
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-0.5">
          {(
            [
              { id: "F" as const, title: "Facturación" },
              { id: "B" as const, title: "Balances" },
            ]
          ).map((tab) => {
            const active = finanzasPane === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.title}
                title={tab.title}
                onClick={() => setFinanzasPane(tab.id)}
                className={`flex size-7 items-center justify-center rounded-md text-[11px] font-bold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {tab.id}
              </button>
            )
          })}
        </div>

        {finanzasPane === "F" ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pr-16">
              <div>
                <button
                  type="button"
                  onClick={() => navigate({ name: "finanzas", section: "facturacion" })}
                  className="text-left"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
                    <Wallet className="size-3.5 text-primary" />
                    Finanzas
                    <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100" />
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Facturación</p>
                  <p className="text-3xl sm:text-4xl font-mono font-bold tracking-tight mt-1">
                    {currencyMxn(paidInRange)}
                  </p>
                </button>

                <MonthSwitcher
                  yearMonth={yearMonth}
                  onChange={setYearMonth}
                  className="mt-2"
                />
              </div>

              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Por cobrar en el mes</p>
                <p className="font-mono text-sm font-bold text-chart-3">
                  {currencyMxn(expectedInRange)}
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-0 w-full mb-3">
              {series.every((p) => p.cobrado === 0 && p.esperado === 0) ? (
                <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                  Sin movimientos de cobranza en este mes.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillCobrado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillEsperado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
                      width={56}
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
                      fill="url(#fillCobrado)"
                      strokeWidth={2}
                      name="cobrado"
                    />
                    <Area
                      type="monotone"
                      dataKey="esperado"
                      stroke="var(--chart-3)"
                      fill="url(#fillEsperado)"
                      strokeWidth={2}
                      name="esperado"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border pt-3 shrink-0">
              <div className="flex flex-wrap gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  Cobrado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-chart-3" />
                  Por cobrar (fecha plan)
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate({ name: "finanzas", section: "facturacion" })}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                Ver finanzas
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pr-16 mb-4">
              <button
                type="button"
                onClick={() => navigate({ name: "finanzas", section: "balances" })}
                className="text-left"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
                  <Wallet className="size-3.5 text-primary" />
                  Finanzas
                  <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100" />
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Balances</p>
                <p className="text-3xl sm:text-4xl font-mono font-bold tracking-tight mt-1 text-primary">
                  {currencyMxn(balances.availableTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disponible · {monthLabel}
                </p>
              </button>
              <MonthSwitcher
                yearMonth={yearMonth}
                onChange={setYearMonth}
                className="mt-2"
              />
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Wallet className="size-3" />
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
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] mt-auto">
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
            </div>

            <div className="flex items-center justify-end text-xs border-t border-border pt-3 shrink-0 mt-3">
              <button
                type="button"
                onClick={() => navigate({ name: "finanzas", section: "balances" })}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                Ver finanzas
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          </>
        )}
      </motion.section>

        {/* Nuevas cotizaciones */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
          className="rounded-[1.75rem] surface-card p-5 flex flex-col h-[420px] sm:h-[440px]"
        >
          <button
            type="button"
            onClick={() => navigate({ name: "quotations" })}
            className="flex items-start justify-between gap-3 mb-4 text-left w-full group shrink-0"
          >
            <div>
              <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2">
                <Inbox className="size-4 text-primary" />
                Nuevas cotizaciones
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pendientes de revisión interna
              </p>
            </div>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span className="text-3xl font-mono font-bold tracking-tight text-primary">
                {pending.length}
              </span>
              <ArrowUpRight className="size-4 text-primary opacity-70 group-hover:opacity-100" />
            </span>
          </button>
          <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
            {pending.length === 0 ? (
              <EmptyMini icon={CheckCircle2} text="Nada en cola. Buen momento." />
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {pending.slice(0, 5).map((q) => {
                  const client = clients.find((c) => c.id === q.clientId)
                  return (
                    <motion.button
                      key={q.id}
                      type="button"
                      layout
                      initial={{
                        opacity: 0,
                        y: -56,
                        scale: 0.92,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{ opacity: 0, y: 16, scale: 0.98 }}
                      transition={{
                        layout: { type: "spring", stiffness: 140, damping: 24, mass: 1.15 },
                        opacity: { duration: 0.85, ease: EASE },
                        y: { type: "spring", stiffness: 120, damping: 20, mass: 1.2 },
                        scale: { duration: 0.85, ease: EASE },
                      }}
                      onClick={() => navigate({ name: "review", id: q.id })}
                      className="relative flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-3 text-left transition-colors hover:bg-accent origin-top overflow-hidden"
                    >
                      {/* Flash de llegada: outline + glow cyan que se apaga */}
                      <motion.span
                        aria-hidden
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 2.4, ease: EASE, delay: 0.2 }}
                        className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary shadow-[0_0_0_1px_rgba(0,217,234,0.35),0_0_28px_rgba(0,217,234,0.45)]"
                      />
                      <motion.span
                        aria-hidden
                        initial={{ opacity: 0.95 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 2.2, ease: EASE, delay: 0.15 }}
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/25 via-primary/10 to-transparent"
                      />
                      <div className="relative shrink-0">
                        <QuoteAuthor quotation={q} layout="avatar" />
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate leading-tight">
                          {client?.company ?? "—"}
                        </p>
                        {q.title.trim() && q.title.trim() !== client?.company ? (
                          <p className="text-[11px] truncate text-muted-foreground mt-0.5">
                            {q.title}
                          </p>
                        ) : null}
                        <QuoteAuthor quotation={q} layout="name" className="mt-0.5" />
                      </div>
                      <span className="relative font-mono text-[10px] shrink-0 text-muted-foreground tabular-nums">
                        {q.reference.replace(/^TKS-Q-/, "")}
                      </span>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </motion.section>

        {/* Seguimiento + Agenda de cobros */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.12 }}
          className="rounded-[1.75rem] surface-card p-5 flex flex-col h-[420px] sm:h-[440px]"
        >
          <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
            <div>
              <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2">
                <Hourglass className="size-4 text-chart-3" />
                Seguimiento y cobros
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cotizaciones en espera y agenda de cobros
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cotiz.
                </span>
                <span className="font-mono text-xl font-bold text-chart-3 leading-none">
                  {waiting.length}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cobros
                </span>
                <span className="font-mono text-xl font-bold text-primary leading-none">
                  {agenda.length}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            <div className="min-h-0 flex-1 flex flex-col gap-1.5 overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shrink-0">
                Enviadas, esperando respuesta
              </p>
              <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                {waiting.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Ninguna en espera.</p>
                ) : (
                  waiting.slice(0, 3).map((q) => {
                    const client = clients.find((c) => c.id === q.clientId)
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => navigate({ name: "review", id: q.id })}
                        className="flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border px-2.5 py-2 text-left hover:border-primary/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{client?.company}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{q.title}</p>
                          <QuoteAuthor quotation={q} layout="row" className="mt-1" />
                        </div>
                        <ClientResponseBadge quotation={q} />
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="border-t border-border shrink-0" />

            <div className="min-h-0 flex-1 flex flex-col gap-1.5 overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shrink-0 flex items-center gap-1.5">
                <Receipt className="size-3 text-primary" />
                Agenda de cobros
              </p>
              <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
                {agenda.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sin cobros programados.</p>
                ) : (
                  agenda.map((row) => {
                    const project = projects.find((p) => p.id === row.projectId)
                    const quote = project?.quotationId
                      ? quotations.find((q) => q.id === project.quotationId)
                      : undefined
                    const client = clients.find(
                      (c) => c.id === (quote?.clientId ?? project?.clientId),
                    )
                    return (
                      <button
                        key={row.installmentId}
                        type="button"
                        onClick={() => navigate({ name: "project", id: row.projectId })}
                        className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                          row.overdue
                            ? "border-destructive/35 bg-destructive/5 hover:border-destructive/50"
                            : "border-border bg-muted/30 hover:border-primary/40"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold">
                              {currencyMxn(row.amount)}
                            </span>
                            {row.overdue && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-destructive">
                                <AlertTriangle className="size-2.5" />
                                Vencido
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {client?.company ?? "—"} · {formatDisplayDate(row.dueDate)}
                          </p>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Proyectos activos */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
          className="rounded-[1.75rem] surface-card p-5 flex flex-col h-[420px] sm:h-[440px]"
        >
          <button
            type="button"
            onClick={() => navigate({ name: "projects" })}
            className="flex items-start justify-between gap-3 mb-4 text-left w-full group shrink-0"
          >
            <div>
              <h2 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2">
                <FolderKanban className="size-4 text-primary" />
                Proyectos
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activos en taller
              </p>
            </div>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span className="text-3xl font-mono font-bold tracking-tight text-primary">
                {activeProjects.length}
              </span>
              <ArrowUpRight className="size-4 text-primary opacity-70 group-hover:opacity-100" />
            </span>
          </button>
          <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
            {activeProjects.length === 0 ? (
              <EmptyMini
                icon={FolderKanban}
                text="Sin proyectos activos. Se crean al aprobar el cliente."
              />
            ) : (
              [...activeProjects]
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
                .slice(0, 5)
                .map((p) => {
                  const quote = p.quotationId
                    ? quotations.find((q) => q.id === p.quotationId)
                    : undefined
                  const client = clients.find(
                    (c) => c.id === (quote?.clientId ?? p.clientId),
                  )
                  const next = projectNextInstallment(p)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate({ name: "project", id: p.id })}
                      className="rounded-2xl border border-border bg-muted/30 px-3 py-3 text-left hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-mono text-[11px] text-primary">{p.id}</span>
                        <ProjectStageBadge stage={p.stage} />
                      </div>
                      <p className="text-sm font-semibold truncate">
                        {quote?.title ?? p.title ?? "Sin título"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mb-2">
                        {client?.company ?? "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {quote ? (
                          <DepartmentBadges quotation={quote} />
                        ) : (
                          <DepartmentBadges departments={p.departments} />
                        )}
                        <span>
                          Cobro:{" "}
                          <span className="font-mono text-foreground">
                            {next
                              ? `${currencyMxn(next.amount)} · ${formatDisplayDate(next.dueDate)}`
                              : "—"}
                          </span>
                        </span>
                      </div>
                    </button>
                  )
                })
            )}
          </div>
        </motion.section>
      </div>
    </div>
  )
}

function EmployeeDashboard({ navigate }: { navigate: (v: View) => void }) {
  const {
    quotations,
    clients,
    user,
    deleteDraftQuotation,
    purgeExpiredTrashedDrafts,
  } = useTechnik()

  useEffect(() => {
    purgeExpiredTrashedDrafts()
  }, [purgeExpiredTrashedDrafts])

  const mine = useMemo(
    () =>
      quotations
        .filter(
          (q) =>
            isQuotationCreator(user, q) &&
            (q.status === "draft" || q.status === "pending_review") &&
            !quotationIsTrashed(q),
        )
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)),
    [quotations, user],
  )
  const drafts = mine.filter((q) => q.status === "draft")
  const sent = mine.filter((q) => q.status === "pending_review")
  const firstName = user?.name.split(" ")[0] ?? "Equipo"
  const greet = greetingForHour(new Date().getHours())
  const nextDraft = drafts[0]
  const nextDraftClient = nextDraft
    ? clients.find((c) => c.id === nextDraft.clientId)?.company
    : null

  function trashDraft(id: string, reference: string) {
    if (!window.confirm(`¿Mover ${reference} a Eliminados? Puedes recuperarla en 15 días.`)) return
    void deleteDraftQuotation(id).then((res) => {
      if (!res.ok) window.alert(res.error)
    })
  }

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="text-2xl sm:text-3xl font-bold font-display tracking-tight"
        >
          {greet}, {firstName}
        </motion.h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea nuevas cotizaciones para clientes y da seguimiento a borradores.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="rounded-[1.75rem] surface-card relative overflow-hidden isolate min-h-[220px] sm:min-h-[260px]"
        >
          <div
            className="hero-mask-two-fifths pointer-events-none absolute inset-y-0 right-0 w-2/5 z-0"
            aria-hidden
          >
            <Image
              src="/brand/overview-hero.png"
              alt=""
              fill
              sizes="25vw"
              className="object-cover object-[62%_center]"
              priority
            />
          </div>

          <div className="relative z-10 flex flex-col justify-between px-5 py-5 sm:px-6 sm:py-6 min-h-[220px] sm:min-h-[260px] w-full pr-[28%]">
            <div>
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                En tu mesa
              </p>
              <p className="text-4xl sm:text-5xl lg:text-6xl font-mono font-bold tracking-tighter tabular-nums mt-3 leading-none text-primary">
                <ScrambleText value={String(drafts.length)} />
              </p>
              <p className="text-base sm:text-lg font-semibold text-foreground mt-3">
                {drafts.length === 1 ? "Borrador por terminar" : "Borradores por terminar"}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
                {nextDraft
                  ? `${nextDraft.title}${nextDraftClient ? ` · ${nextDraftClient}` : ""}`
                  : sent.length > 0
                    ? `${sent.length} enviada${sent.length === 1 ? "" : "s"} a administración. La mesa está libre.`
                    : "Sin borradores. Empieza una cotización y envíala a administración."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              {nextDraft && (
                <button
                  type="button"
                  onClick={() => navigate({ name: "builder", id: nextDraft.id })}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Continuar
                  <ArrowUpRight className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate({ name: "quotations" })}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2.5 text-sm font-semibold hover:border-primary/40"
              >
                Ver lista
              </button>
            </div>
          </div>
        </motion.section>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.04 }}
          onClick={() => navigate({ name: "builder" })}
          className="rounded-[1.75rem] bg-primary text-primary-foreground p-5 sm:p-6 min-h-[220px] sm:min-h-[260px] flex flex-col justify-between text-left group hover:opacity-95 transition-opacity"
        >
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70 flex items-center gap-2">
              <Plus className="size-4" />
              Crear
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-display tracking-tight mt-4 leading-[0.95]">
              Nueva
              <br />
              cotización
            </p>
            <p className="text-sm text-primary-foreground/75 mt-3 max-w-[17rem] leading-snug">
              Arma el borrador en campo y envíalo a administración para revisión.
            </p>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground/90">
            Empezar
            <ArrowUpRight className="size-3.5 opacity-80 group-hover:opacity-100" />
          </span>
        </motion.button>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}
          className="rounded-[1.75rem] surface-card p-5 sm:p-6 flex flex-col min-h-[260px]"
        >
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
              <ClipboardList className="size-3.5 text-primary" />
              Borradores
            </p>
            <p className="text-4xl font-mono font-bold tracking-tighter tabular-nums mt-2 leading-none">
              {drafts.length}
            </p>
            <p className="text-[11px] font-semibold text-primary mt-2">
              Clic para continuar la cotización
            </p>
          </div>
          <div className="flex flex-col gap-2 flex-1">
            {drafts.length === 0 ? (
              <EmptyMini icon={ClipboardList} text="Nada en borrador." />
            ) : (
              drafts.slice(0, 4).map((q) => (
                <CollaboratorQuoteRow
                  key={q.id}
                  title={q.title}
                  reference={q.reference}
                  client={clients.find((c) => c.id === q.clientId)?.company ?? "—"}
                  quotation={q}
                  onClick={() => navigate({ name: "builder", id: q.id })}
                  onDelete={() => trashDraft(q.id, q.reference)}
                />
              ))
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
          className="rounded-[1.75rem] surface-card p-5 sm:p-6 flex flex-col min-h-[260px] glow-teal-sm"
        >
          <button
            type="button"
            onClick={() => navigate({ name: "quotations" })}
            className="flex items-start justify-between gap-3 text-left mb-4 group"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                <Send className="size-3.5 text-primary" />
                Enviadas a administración
              </p>
              <p className="text-4xl font-mono font-bold tracking-tighter tabular-nums mt-2 leading-none text-primary">
                {sent.length}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary opacity-80 group-hover:opacity-100">
              Ver
              <ArrowUpRight className="size-3.5" />
            </span>
          </button>
          <div className="flex flex-col gap-2 flex-1">
            {sent.length === 0 ? (
              <EmptyMini icon={Send} text="Cuando envíes, aparecen aquí." />
            ) : (
              sent.slice(0, 5).map((q) => (
                <CollaboratorQuoteRow
                  key={q.id}
                  title={q.title}
                  reference={q.reference}
                  client={clients.find((c) => c.id === q.clientId)?.company ?? "—"}
                  quotation={q}
                  onClick={() => navigate({ name: "review", id: q.id })}
                />
              ))
            )}
          </div>
        </motion.section>
      </div>
    </div>
  )
}

function CollaboratorQuoteRow({
  title,
  reference,
  client,
  quotation,
  onClick,
  onDelete,
}: {
  title: string
  reference: string
  client: string
  quotation: Quotation
  onClick?: () => void
  onDelete?: () => void
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-mono text-[10px] text-primary">{reference}</span>
          <DepartmentBadges quotation={quotation} />
          <StatusBadge quotation={quotation} />
        </div>
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{client}</p>
      </div>
      {onClick && (
        <ChevronRight className="size-4 shrink-0 opacity-40 group-hover:opacity-80 group-hover:text-primary" />
      )}
    </>
  )

  return (
    <div className="group flex items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/25 pr-1.5 transition-colors hover:border-primary/40 hover:bg-accent/60">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left"
        >
          {inner}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3">{inner}</div>
      )}
      {onDelete && (
        <button
          type="button"
          title="Mover a eliminados"
          aria-label={`Eliminar ${reference}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

function EmptyMini({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <Icon className="size-6 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}
