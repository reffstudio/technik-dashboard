"use client"

import React from "react"
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  FilePenLine,
  Flag,
  Hourglass,
  PackageCheck,
  PlayCircle,
  Search,
  Send,
  Truck,
  XCircle,
} from "lucide-react"
import {
  BILLING_STATUS_META,
  CLIENT_RESPONSE_META,
  clientResponseOf,
  departmentColor,
  displayStatus,
  initials,
  PROJECT_STAGE_META,
  isQuotationCreator,
  quotationDepartments,
  outboundSendStatus,
  PIPELINE_STATUS_META,
  QUOTE_PIPELINE_STATUSES,
  quotePipelineStatus,
  STATUS_META,
  type BillingStatus,
  type ClientResponse,
  type ProjectStage,
  type Quotation,
  type QuotePipelineStatus,
  type QuoteStatus,
  type StatusIconId,
  type User,
  type WorkDepartment,
} from "@/lib/technik/data"
import { roleLabel, useTechnik } from "@/lib/technik/store"
import {
  formatYearMonthLabel,
  parseYearMonth,
  shiftYearMonth,
} from "@/lib/technik/treasury"

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  amber: "bg-chart-3/12 text-chart-3 border-chart-3/25",
  azure: "bg-chart-2/12 text-chart-2 border-chart-2/25",
  gain: "bg-fin-gain/12 text-fin-gain border-fin-gain/25",
  teal: "bg-primary/12 text-primary border-primary/25",
  loss: "bg-destructive/12 text-destructive border-destructive/25",
}

const STATUS_ICONS: Record<StatusIconId, React.ElementType> = {
  draft: FilePenLine,
  review: ClipboardList,
  approved: CheckCircle2,
  closed: Archive,
  sent: Send,
  in_progress: Hourglass,
  dispatched: PackageCheck,
  supplier: Truck,
  waiting: Hourglass,
  rejected: XCircle,
  stage_process: Hourglass,
  stage_ready: Flag,
  stage_active: PlayCircle,
  stage_late: AlertTriangle,
  stage_done: CircleDot,
}

export function ToneBadge({
  label,
  tone,
  icon,
}: {
  label: string
  tone: string
  icon?: StatusIconId
}) {
  const Icon = icon ? STATUS_ICONS[icon] : null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TONE_CLASS[tone] ?? TONE_CLASS.neutral}`}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      {label}
    </span>
  )
}

export function StatusBadge({ status, quotation }: { status?: QuoteStatus; quotation?: Quotation }) {
  const { user } = useTechnik()
  const meta = quotation ? displayStatus(quotation) : STATUS_META[status!]
  const pending = (quotation?.status ?? status) === "pending_review"
  const label =
    user?.role !== "admin" && pending && meta.label === STATUS_META.pending_review.label
      ? "Enviada a administración"
      : meta.label
  return <ToneBadge label={label} tone={meta.tone} icon={meta.icon} />
}

export function DepartmentBadge({ department }: { department: WorkDepartment }) {
  const { departments } = useTechnik()
  const config = departments.find((d) => d.id === department)
  const label = config?.short ?? department
  const color = departmentColor(config?.colorId ?? "azul")
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${color.badgeClass}`}
    >
      {label}
    </span>
  )
}

/** Una o varias etiquetas de departamento (cotización / proyecto). */
export function DepartmentBadges({
  departments: ids,
  quotation,
}: {
  departments?: WorkDepartment[]
  quotation?: Quotation
}) {
  const list = ids ?? (quotation ? quotationDepartments(quotation) : [])
  if (list.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {list.map((id) => (
        <DepartmentBadge key={id} department={id} />
      ))}
    </span>
  )
}

export function SendStatusBadge({ quotation }: { quotation: Quotation }) {
  const meta = outboundSendStatus(quotation)
  return <ToneBadge label={meta.label} tone={meta.tone} icon={meta.icon} />
}

export function ClientResponseBadge({
  quotation,
  response,
}: {
  quotation?: Quotation
  response?: ClientResponse
}) {
  if (response) {
    const meta = CLIENT_RESPONSE_META[response]
    return <ToneBadge label={meta.label} tone={meta.tone} icon={meta.icon} />
  }
  if (!quotation) return null
  const meta = clientResponseOf(quotation)
  if (!meta) return <span className="text-[11px] text-muted-foreground">—</span>
  return <ToneBadge label={meta.label} tone={meta.tone} icon={meta.icon} />
}

const pipelineSelectCls =
  "w-full rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground outline-none focus:border-primary/60"

const PIPELINE_CHIP: Record<QuotePipelineStatus, string> = {
  draft: "data-[on=true]:bg-muted data-[on=true]:text-foreground data-[on=true]:border-border",
  pending_review:
    "data-[on=true]:bg-chart-3/15 data-[on=true]:text-chart-3 data-[on=true]:border-chart-3/35",
  sent_client:
    "data-[on=true]:bg-fin-gain/15 data-[on=true]:text-fin-gain data-[on=true]:border-fin-gain/35",
  approved:
    "data-[on=true]:bg-chart-2/15 data-[on=true]:text-chart-2 data-[on=true]:border-chart-2/35",
  closed:
    "data-[on=true]:bg-destructive/12 data-[on=true]:text-destructive data-[on=true]:border-destructive/30",
}

function pipelineCanPick(
  status: QuotePipelineStatus,
  user: User | null | undefined,
  quotation: Quotation,
): boolean {
  const creator = isQuotationCreator(user, quotation)
  const admin = user?.role === "admin"
  if (status === "draft") return creator
  if (status === "pending_review") return admin || creator
  return admin
}

function pipelineVisibleStatuses(
  user: User | null | undefined,
  quotation: Quotation,
): QuotePipelineStatus[] {
  const current = quotePipelineStatus(quotation)
  return QUOTE_PIPELINE_STATUSES.filter(
    (status) => status === current || pipelineCanPick(status, user, quotation),
  )
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

/** Una sola lista: Borrador / En revisión / Enviada al cliente / Aprobada / Rechazada. */
export function QuotePipelineControls({
  quotation,
  compact = false,
  align = "start",
  className = "",
  onApplied,
}: {
  quotation: Quotation
  compact?: boolean
  align?: "start" | "end"
  className?: string
  onApplied?: (
    status: QuotePipelineStatus,
    extra?: { projectId?: string; error?: string; projectCreated?: boolean },
  ) => void
}) {
  const { user, updateQuotation, setClientResponse, projectByQuotationId } = useTechnik()
  const current = quotePipelineStatus(quotation)
  const options = pipelineVisibleStatuses(user, quotation)
  const canChange = options.some((status) => status !== current && pipelineCanPick(status, user, quotation))

  function apply(next: QuotePipelineStatus) {
    if (next === current) return
    if (!pipelineCanPick(next, user, quotation)) return
    if (next === "approved") {
      const existed = Boolean(projectByQuotationId(quotation.id))
      const result = setClientResponse(quotation.id, "aprobada")
      if (!result.ok) {
        onApplied?.("approved", { error: result.error })
        return
      }
      onApplied?.("approved", { projectId: result.projectId, projectCreated: !existed })
      return
    }
    if (next === "closed") {
      const result = updateQuotation(
        quotation.id,
        { status: "closed", clientResponse: "rechazada" },
        "Rechazó cotización · archivó",
      )
      if (!result.ok) {
        onApplied?.("closed", { error: result.error })
        return
      }
      onApplied?.("closed")
      return
    }
    if (next === "sent_client") {
      updateQuotation(
        quotation.id,
        {
          status: "pending_review",
          clientSentAt: quotation.clientSentAt || todayStamp(),
        },
        "Marcó enviada al cliente",
      )
      onApplied?.("sent_client")
      return
    }
    if (next === "pending_review") {
      updateQuotation(
        quotation.id,
        { status: "pending_review", clientSentAt: undefined },
        "Envió a revisión",
      )
      onApplied?.(next)
      return
    }
    updateQuotation(
      quotation.id,
      { status: "draft", clientSentAt: undefined },
      `Estado → ${PIPELINE_STATUS_META.draft.label}`,
    )
    onApplied?.(next)
  }

  if (!canChange) {
    const meta = PIPELINE_STATUS_META[current]
    return (
      <div className={className} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <ToneBadge label={meta.label} tone={meta.tone} icon={meta.icon} />
      </div>
    )
  }

  if (compact) {
    return (
      <div
        className={`min-w-[11rem] ${className}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <select
          aria-label="Estado de la cotización"
          className={pipelineSelectCls}
          value={current}
          onChange={(e) => apply(e.target.value as QuotePipelineStatus)}
        >
          {options.map((status) => (
            <option
              key={status}
              value={status}
              disabled={!pipelineCanPick(status, user, quotation) && status !== current}
            >
              {PIPELINE_STATUS_META[status].label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-1 min-w-0 ${align === "end" ? "lg:items-end" : ""} ${className}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Estado
      </span>
      <div
        className={`flex flex-wrap gap-0.5 rounded-2xl border border-border/70 bg-muted/35 p-1 ${
          align === "end" ? "lg:justify-end" : ""
        }`}
      >
        {options.map((status) => {
          const on = current === status
          const allowed = on || pipelineCanPick(status, user, quotation)
          return (
            <button
              key={status}
              type="button"
              disabled={!allowed}
              data-on={on}
              onClick={() => apply(status)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${PIPELINE_CHIP[status]} ${
                on ? "" : "border-transparent bg-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground"
              }`}
            >
              {PIPELINE_STATUS_META[status].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ProjectStageBadge({ stage }: { stage: ProjectStage }) {
  const meta = PROJECT_STAGE_META[stage]
  return <ToneBadge label={meta.label} tone={meta.tone} icon={meta.icon} />
}

/** Estado de cobro — independiente de la etapa del taller. */
export function BillingStatusBadge({ status }: { status: BillingStatus }) {
  const meta = BILLING_STATUS_META[status]
  return <ToneBadge label={meta.label} tone={meta.tone} />
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight font-display">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl surface-card p-5 lg:p-6 ${className}`}>{children}</div>
}

/** Tonos alineados a badges de estado (STATUS_META / PROJECT_STAGE_META). */
export type StatTone = "neutral" | "amber" | "azure" | "gain" | "teal" | "loss"

const STAT_TONE: Record<StatTone, { value: string; card: string }> = {
  neutral: {
    value: "text-foreground",
    card: "surface-card",
  },
  amber: {
    value: "text-chart-3",
    card: "border border-chart-3/30 bg-chart-3/[0.08] shadow-none",
  },
  azure: {
    value: "text-chart-2",
    card: "border border-chart-2/30 bg-chart-2/[0.08] shadow-none",
  },
  gain: {
    value: "text-fin-gain",
    card: "border border-fin-gain/30 bg-fin-gain/[0.08] shadow-none",
  },
  teal: {
    value: "text-primary",
    card: "border border-primary/30 bg-primary/[0.08] shadow-none",
  },
  loss: {
    value: "text-destructive",
    card: "border border-destructive/30 bg-destructive/[0.08] shadow-none",
  },
}

const STAT_ICON_WRAP: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  amber: "bg-chart-3/15 text-chart-3",
  azure: "bg-chart-2/15 text-chart-2",
  gain: "bg-fin-gain/15 text-fin-gain",
  teal: "bg-primary/15 text-primary",
  loss: "bg-destructive/15 text-destructive",
}

export function Stat({
  label,
  value,
  hint,
  accent,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  /** @deprecated Prefer `tone="teal"`. */
  accent?: boolean
  tone?: StatTone
  icon?: React.ElementType
}) {
  const resolved: StatTone = tone ?? (accent ? "teal" : "neutral")
  const t = STAT_TONE[resolved]
  const iconWrap = STAT_ICON_WRAP[resolved]
  return (
    <div className={`rounded-2xl p-5 ${t.card}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold font-mono tracking-tight leading-none ${t.value}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </div>
  )
}

export const inputCls =
  "w-full rounded-xl bg-input/60 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/60 transition-colors"

/** Brinca mes a mes (dinero / tesorería). */
export function MonthSwitcher({
  yearMonth,
  onChange,
  className = "",
}: {
  yearMonth: string
  onChange: (yearMonth: string) => void
  className?: string
}) {
  const label = formatYearMonthLabel(yearMonth)
  const { year, month } = parseYearMonth(yearMonth)
  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString("es-MX", { month: "long" })
    .toUpperCase()

  return (
    <div className={`flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => onChange(shiftYearMonth(yearMonth, -1))}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
        aria-label="Mes anterior"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="relative min-w-[9.75rem] px-1 text-center">
        <p className="text-sm font-bold tracking-[0.04em] tabular-nums pointer-events-none">
          {monthName} <span className="font-bold text-muted-foreground">|</span> {year}
        </p>
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value)
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Mes: ${label}`}
          title={label}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftYearMonth(yearMonth, 1))}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
        aria-label="Mes siguiente"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

/** Campo de búsqueda reutilizable (listas y directorios). */
export function SearchField({
  value,
  onChange,
  placeholder = "Buscar…",
  className = "",
  inputClassName = "",
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}) {
  return (
    <div
      className={`relative flex items-center gap-2 rounded-xl bg-input/60 border border-border px-3 py-2 ${className}`}
    >
      <Search className="size-4 text-muted-foreground shrink-0" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 ${inputClassName}`}
      />
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const AVATAR_SIZE: Record<"xs" | "sm" | "md" | "lg", string> = {
  xs: "size-6 text-[10px] rounded-full",
  sm: "size-8 text-xs rounded-lg",
  md: "size-11 text-sm rounded-xl",
  lg: "size-14 text-lg rounded-2xl",
}

export function UserAvatar({
  user,
  size = "sm",
  className = "",
}: {
  user: Pick<User, "name" | "avatarUrl">
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}) {
  const base = `flex shrink-0 items-center justify-center overflow-hidden font-bold bg-primary/15 text-primary ${AVATAR_SIZE[size]} ${className}`
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt={user.name} className={`${base} object-cover object-[center_20%]`} />
    )
  }
  return <div className={base}>{initials(user.name)}</div>
}

function resolveQuoteAuthor(
  quotation: Pick<Quotation, "createdBy" | "createdById">,
  users: User[],
  viewer?: User | null,
) {
  const match = users.find(
    (u) => u.id === quotation.createdById || u.authId === quotation.createdById,
  )
  const name = match?.name || quotation.createdBy || "—"
  const role = match?.role ?? (isQuotationCreator(viewer, quotation) ? viewer?.role : undefined)
  return { user: match ?? { name, avatarUrl: undefined }, name, role }
}

/** Quién generó la cotización — avatar, nombre y rol real. */
export function QuoteAuthor({
  quotation,
  layout = "pill",
  className = "",
}: {
  quotation: Pick<Quotation, "createdBy" | "createdById">
  layout?: "pill" | "row" | "hero" | "avatar" | "name" | "inline"
  className?: string
}) {
  const { users, user: viewer } = useTechnik()
  const { user: author, name, role } = resolveQuoteAuthor(quotation, users, viewer)
  const caption = role ? roleLabel(role) : "Creada por"

  if (layout === "avatar") {
    return (
      <UserAvatar
        user={author}
        size="md"
        className={`ring-2 ring-primary/25 ${className}`}
      />
    )
  }

  if (layout === "hero") {
    return (
      <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
        <UserAvatar user={author} size="md" className="ring-2 ring-primary/25" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {caption}
          </p>
          <p className="text-sm font-bold text-foreground truncate">{name}</p>
        </div>
      </div>
    )
  }

  if (layout === "inline") {
    return (
      <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <UserAvatar user={author} size="xs" />
        <span className="text-xs font-semibold text-foreground truncate">{name}</span>
        <span className="text-[10px] text-muted-foreground truncate">· {caption}</span>
      </span>
    )
  }

  if (layout === "row") {
    return (
      <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
        <UserAvatar user={author} size="xs" />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground truncate">{name}</span>
          <span className="block text-[10px] text-muted-foreground truncate">{caption}</span>
        </span>
      </span>
    )
  }

  if (layout === "name") {
    return (
      <span className={`block text-[11px] font-medium text-muted-foreground truncate ${className}`}>
        {name}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 pl-0.5 pr-2.5 py-0.5 min-w-0 max-w-full ${className}`}
    >
      <UserAvatar user={author} size="xs" />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-foreground truncate leading-tight">{name}</span>
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {caption}
        </span>
      </span>
    </span>
  )
}
