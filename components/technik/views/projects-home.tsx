"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  FolderKanban,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import {
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  canTrashProject,
  projectBillingSummary,
  projectHasOverdueInstallment,
  projectIsHidden,
  projectIsOverdue,
  projectIsTrashed,
  quotationIsTrashed,
  projectTitle,
  quotationHasDepartment,
  projectCoverUrl,
  isQuotationCreator,
  trashDaysLeft,
  type Project,
  type ProjectStage,
  type WorkDepartment,
} from "@/lib/technik/data"
import { quoteClientDue, useTechnik } from "@/lib/technik/store"
import {
  BillingStatusBadge,
  DepartmentBadges,
  PageHeader,
  ProjectStageBadge,
  Stat,
  inputCls,
} from "../ui"
import type { View } from "../app-shell"

function formatDate(iso?: string) {
  if (!iso) return "Sin fecha"
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${Number(m)}/${Number(d)}/${y}`
}

const STAGE_ACCENT: Record<ProjectStage, string> = {
  procesando_solicitud: "bg-chart-3",
  listo_para_iniciar: "bg-chart-2",
  en_proceso: "bg-primary",
  atrasado: "bg-destructive",
  completado: "bg-fin-gain",
}

export function ProjectsHome({ navigate }: { navigate: (v: View) => void }) {
  const {
    projects,
    quotations,
    clients,
    departments,
    user,
    createManualProject,
    trashProject,
    restoreProject,
    purgeExpiredTrashedDrafts,
  } = useTechnik()
  const isAdmin = user?.role === "admin"

  useEffect(() => {
    purgeExpiredTrashedDrafts()
  }, [purgeExpiredTrashedDrafts])
  const [stage, setStage] = useState<"all" | ProjectStage>("all")
  const [dept, setDept] = useState<"all" | WorkDepartment>("all")
  const [query, setQuery] = useState("")
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState("")
  const [manualClientId, setManualClientId] = useState(clients[0]?.id ?? "")
  const [manualTotal, setManualTotal] = useState("")
  const [manualDepts, setManualDepts] = useState<WorkDepartment[]>(
    departments[0]?.id ? [departments[0].id] : [],
  )
  const [manualStage, setManualStage] = useState<ProjectStage>("en_proceso")
  const [manualDue, setManualDue] = useState("")
  const [manualNotes, setManualNotes] = useState("")
  const [folder, setFolder] = useState<"active" | "trashed">("active")

  const scopedAll = useMemo(() => {
    if (isAdmin) return projects
    return projects.filter((p) => {
      if (user && (p.createdById === user.id || p.createdById === user.authId)) return true
      if (!p.quotationId) return false
      const q = quotations.find((x) => x.id === p.quotationId)
      return q ? isQuotationCreator(user, q) : false
    })
  }, [projects, quotations, isAdmin, user])

  const liveScoped = useMemo(
    () => scopedAll.filter((p) => !projectIsHidden(p, quotations)),
    [scopedAll, quotations],
  )
  const trashScoped = useMemo(
    () => scopedAll.filter((p) => projectIsTrashed(p) || projectIsHidden(p, quotations)),
    [scopedAll, quotations],
  )
  const scoped = folder === "trashed" ? trashScoped : liveScoped

  const activeCount = liveScoped.filter((p) => p.stage !== "completado").length
  /** Retraso operativo: etapa “atrasado” o fecha de entrega de taller vencida. */
  const overdueCount = liveScoped.filter(
    (p) => p.stage === "atrasado" || projectIsOverdue(p),
  ).length
  const doneCount = liveScoped.filter((p) => p.stage === "completado").length

  const list = useMemo(() => {
    let base = scoped
    if (stage !== "all") base = base.filter((p) => p.stage === stage)
    if (dept !== "all") {
      base = base.filter((p) => {
        const q = quotations.find((x) => x.id === p.quotationId)
        if (q) return quotationHasDepartment(q, dept)
        return (p.departments ?? []).includes(dept)
      })
    }
    const q = query.trim().toLowerCase()
    if (q) {
      base = base.filter((p) => {
        const quote = p.quotationId
          ? quotations.find((x) => x.id === p.quotationId)
          : undefined
        const client = clients.find((c) => c.id === (quote?.clientId ?? p.clientId))
        const title = projectTitle(p, quote?.title)
        return (
          p.id.toLowerCase().includes(q) ||
          (quote?.reference ?? "").toLowerCase().includes(q) ||
          title.toLowerCase().includes(q) ||
          (client?.company ?? "").toLowerCase().includes(q)
        )
      })
    }
    return [...base].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }, [scoped, stage, dept, query, quotations, clients])

  function toggleManualDept(id: WorkDepartment) {
    setManualDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    )
  }

  function submitManualProject() {
    const total = Number(manualTotal)
    if (!manualTitle.trim() || !manualClientId || !Number.isFinite(total) || total <= 0) {
      return
    }
    const id = createManualProject({
      title: manualTitle.trim(),
      clientId: manualClientId,
      totalDue: total,
      departments: manualDepts.length ? manualDepts : undefined,
      stage: manualStage,
      dueDate: manualDue || undefined,
      notes: manualNotes.trim() || undefined,
    })
    setManualOpen(false)
    setManualTitle("")
    setManualTotal("")
    setManualDue("")
    setManualNotes("")
    setManualStage("en_proceso")
    navigate({ name: "project", id })
  }

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Seguimiento de proyectos activos en Technik Solutions"
      >
        {isAdmin && (
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Cargar proyecto
          </button>
        )}
      </PageHeader>

      {isAdmin && manualOpen && (
        <div className="rounded-2xl surface-card border border-primary/25 p-4 sm:p-5 mb-6">
          <p className="text-sm font-semibold mb-1">Cargar proyecto activo</p>
          <p className="text-[11px] text-muted-foreground mb-4 max-w-2xl">
            Para trabajos que ya están en marcha y no nacieron de una cotización aquí.
            Entra el cliente, el alcance y en qué etapa va. El plan de cobro se arma
            después en la ficha del proyecto.
          </p>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">
              Primero registra el cliente en{" "}
              <button
                type="button"
                onClick={() => navigate({ name: "clients" })}
                className="text-primary font-semibold underline-offset-2 hover:underline"
              >
                Clientes
              </button>
              , luego vuelve a cargar el proyecto.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Trabajo / nombre</span>
                <input
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ej. Línea de ensamble planta norte"
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Cliente</span>
                <select
                  value={manualClientId}
                  onChange={(e) => setManualClientId(e.target.value)}
                  className={`${inputCls} mt-1`}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Total a cobrar (con IVA)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualTotal}
                  onChange={(e) => setManualTotal(e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} mt-1 font-mono`}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Etapa actual</span>
                <select
                  value={manualStage}
                  onChange={(e) => setManualStage(e.target.value as ProjectStage)}
                  className={`${inputCls} mt-1`}
                >
                  {PROJECT_STAGES.filter((s) => s !== "completado").map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STAGE_META[s].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Entrega comprometida</span>
                <input
                  type="date"
                  value={manualDue}
                  onChange={(e) => setManualDue(e.target.value)}
                  className={`${inputCls} mt-1 font-mono`}
                />
              </label>
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-[11px] text-muted-foreground">Departamento</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {departments.map((d) => {
                    const on = manualDepts.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleManualDept(d.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          on
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="text-[11px] text-muted-foreground">Notas (opcional)</span>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexto del trabajo, folio viejo, lo que el taller ya avanzó…"
                  className={`${inputCls} mt-1 min-h-[4.5rem] resize-y`}
                />
              </label>
            </div>
          )}
          <div className="flex gap-2">
            {clients.length > 0 && (
              <button
                type="button"
                onClick={submitManualProject}
                className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
              >
                Cargar y abrir ficha
              </button>
            )}
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Stat label="Activos" value={String(activeCount)} hint="Sin completar" tone="teal" />
        <Stat
          label="Retraso taller"
          value={String(overdueCount)}
          hint="Etapa o entrega de taller atrasada"
          tone="loss"
        />
        <Stat label="Completados" value={String(doneCount)} hint="Entregados" tone="gain" />
        <Stat label="Total" value={String(liveScoped.length)} hint="Todos los proyectos" tone="neutral" />
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-background/60 border border-border w-full sm:w-fit mb-4">
        <button
          type="button"
          onClick={() => setFolder("active")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            folder === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Activos
        </button>
        <button
          type="button"
          onClick={() => setFolder("trashed")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            folder === "trashed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Eliminados{trashScoped.length > 0 ? ` (${trashScoped.length})` : ""}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por proyecto, cotización o cliente…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="relative shrink-0 w-full sm:w-56">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as "all" | ProjectStage)}
            aria-label="Filtrar por etapa"
            className={`${inputCls} appearance-none pr-9 cursor-pointer`}
          >
            <option value="all">Todas las etapas</option>
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STAGE_META[s].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Filtrar por departamento">
        <button
          type="button"
          onClick={() => setDept("all")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            dept === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos
        </button>
        {departments.map((d) => {
          const active = dept === d.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDept(active ? "all" : d.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <FolderKanban className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {folder === "trashed"
              ? "La papelera de proyectos está vacía."
              : "No hay proyectos con estos filtros. Se crean al aprobar una cotización, o con Cargar proyecto si el trabajo ya estaba en marcha."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {list.map((p) => (
            <ProjectTile
              key={p.id}
              project={p}
              onOpen={() => navigate({ name: "project", id: p.id })}
              onTrash={
                canTrashProject(user) && !projectIsHidden(p, quotations)
                  ? () => {
                      const pair = p.quotationId
                        ? " La cotización ligada también se mueve."
                        : ""
                      if (
                        !window.confirm(
                          `¿Mover ${p.id} a Eliminados?${pair} Puedes recuperarlo en 15 días.`,
                        )
                      ) {
                        return
                      }
                      void trashProject(p.id).then((res) => {
                        if (!res.ok) {
                          window.alert(res.error)
                          return
                        }
                        setFolder("trashed")
                      })
                    }
                  : undefined
              }
              onRestore={
                projectIsHidden(p, quotations) && canTrashProject(user)
                  ? () => {
                      void restoreProject(p.id).then((res) => {
                        if (!res.ok) window.alert(res.error)
                      })
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectTile({
  project,
  onOpen,
  onTrash,
  onRestore,
}: {
  project: Project
  onOpen: () => void
  onTrash?: () => void
  onRestore?: () => void
}) {
  const { quotations, clients, catalog } = useTechnik()
  const quote = project.quotationId
    ? quotations.find((x) => x.id === project.quotationId)
    : undefined
  const client = clients.find((c) => c.id === (quote?.clientId ?? project.clientId))
  const deliveryLate = projectIsOverdue(project) || project.stage === "atrasado"
  const totalDue = quote
    ? quoteClientDue(quote, catalog).total
    : project.totalDue ?? 0
  const billing = projectBillingSummary(project, totalDue)
  const cobroVencido =
    billing.status === "vencido" || projectHasOverdueInstallment(project)
  const cover = projectCoverUrl(project, quote)
  const inTrash = projectIsTrashed(project) || Boolean(quote && quotationIsTrashed(quote))
  const days =
    inTrash && (project.deletedAt || quote?.deletedAt)
      ? trashDaysLeft(project.deletedAt || quote?.deletedAt || "")
      : null

  return (
    <div
      className={`group relative flex flex-col text-left rounded-2xl surface-card overflow-hidden transition-all hover:border-primary/45 hover:-translate-y-0.5 hover:shadow-md min-h-[240px] ${
        deliveryLate && !inTrash ? "ring-1 ring-destructive/35" : ""
      }`}
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 z-10 ${STAGE_ACCENT[project.stage]}`}
        aria-hidden
      />

      <button type="button" onClick={onOpen} className="relative h-32 sm:h-36 bg-muted/50 overflow-hidden text-left">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
            <FolderKanban className="size-9 text-muted-foreground/35" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent" />
      </button>

      <div className="flex flex-col flex-1 p-4 gap-3">
        <button type="button" onClick={onOpen} className="text-left">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-primary">{project.id}</span>
            {quote ? (
              <DepartmentBadges quotation={quote} />
            ) : (
              <DepartmentBadges departments={project.departments} />
            )}
          </div>

          <div className="min-h-0 mt-3">
            <p className="text-base font-bold font-display text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {projectTitle(project, quote?.title)}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground/90 line-clamp-1">
              {client?.company ?? "—"}
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
              {quote ? "Desde cotización" : "Sin cotización (N/A)"}
              {inTrash && days !== null
                ? ` · ${days <= 0 ? "se borra hoy" : `se borra en ${days} día${days === 1 ? "" : "s"}`}`
                : ""}
            </p>
          </div>
        </button>

        <div className="mt-auto flex flex-col gap-2.5 pt-1 border-t border-border/70">
          <div className="flex flex-wrap items-center gap-1.5">
            <ProjectStageBadge stage={project.stage} />
            {cobroVencido && !inTrash && <BillingStatusBadge status="vencido" />}
            {projectIsOverdue(project) && project.stage !== "atrasado" && !inTrash && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                <AlertTriangle className="size-3" />
                Entrega vencida
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
              <CalendarDays className="size-3.5 shrink-0" />
              <span>
                Entrega taller{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatDate(project.dueDate)}
                </span>
              </span>
            </div>
            {onTrash && (
              <button
                type="button"
                title="Mover a eliminados"
                aria-label="Eliminar proyecto"
                onClick={onTrash}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            {onRestore && (
              <button
                type="button"
                title="Recuperar"
                aria-label="Recuperar proyecto"
                onClick={onRestore}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-primary hover:border-primary/40"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
