"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
} from "lucide-react"
import {
  BILLING_STATUS_META,
  currency,
  currencyMxn,
  installmentIsPaid,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  PAYMENT_MODE_LABEL,
  PROJECT_STAGE_META,
  PROJECT_STAGES,
  projectBillingSummary,
  canTrashProject,
  projectIsHidden,
  projectIsOverdue,
  projectIsTrashed,
  projectTitle,
  projectCoverUrl,
  type PaymentMethod,
  type PaymentMode,
} from "@/lib/technik/data"
import { clientPublicItemsForQuote, quoteClientDue, quoteTotals, useTechnik } from "@/lib/technik/store"
import { formatActivityAt } from "@/lib/technik/activity-history"
import {
  DepartmentBadges,
  ProjectStageBadge,
  ToneBadge,
  inputCls,
} from "../ui"
import { CoverPhotoField } from "../cover-photo-field"
import type { View } from "../app-shell"

function formatDate(iso?: string) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${Number(m)}/${Number(d)}/${y}`
}

export function ProjectDetail({
  id,
  navigate,
}: {
  id: string
  navigate: (v: View) => void
}) {
  const {
    projects,
    quotations,
    clients,
    catalog,
    user,
    setProjectStage,
    updateProject,
    setProjectPaymentMode,
    addProjectInstallment,
    updateProjectInstallment,
    removeProjectInstallment,
    markInstallmentPaid,
    addPaymentCorrectionNote,
    trashProject,
    restoreProject,
  } = useTechnik()
  const isAdmin = user?.role === "admin"
  const project = projects.find((p) => p.id === id)
  const quote = project?.quotationId
    ? quotations.find((q) => q.id === project.quotationId)
    : undefined
  const clientId = quote?.clientId ?? project?.clientId
  const client = clientId ? clients.find((c) => c.id === clientId) : undefined

  const todayIso = new Date().toISOString().slice(0, 10)
  const [notes, setNotes] = useState(project?.notes ?? "")
  const [dueDate, setDueDate] = useState(project?.dueDate ?? "")
  const [deliveredAt, setDeliveredAt] = useState(project?.deliveredAt ?? "")
  const [instAmount, setInstAmount] = useState("")
  const [instDueDate, setInstDueDate] = useState(todayIso)
  const [instNote, setInstNote] = useState("")
  const [instInvoiceUuid, setInstInvoiceUuid] = useState("")
  const [instInvoiceDate, setInstInvoiceDate] = useState("")
  const [instMethod, setInstMethod] = useState<PaymentMethod>("transferencia")
  const [collectId, setCollectId] = useState<string | null>(null)
  const [collectDate, setCollectDate] = useState(todayIso)
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>("transferencia")
  const [collectAmount, setCollectAmount] = useState("")
  const [collectUuid, setCollectUuid] = useState("")
  const [collectInvoiceDate, setCollectInvoiceDate] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const [editNote, setEditNote] = useState("")
  const [editUuid, setEditUuid] = useState("")
  const [editInvoiceDate, setEditInvoiceDate] = useState("")
  const [editMethod, setEditMethod] = useState<PaymentMethod>("transferencia")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const skipProjectSave = useRef(true)

  // Sync local fields when navigating between projects
  useEffect(() => {
    setNotes(project?.notes ?? "")
    setDueDate(project?.dueDate ?? "")
    setDeliveredAt(project?.deliveredAt ?? "")
    setCollectId(null)
    setEditId(null)
    setHistoryOpen(false)
    skipProjectSave.current = true
  }, [project?.id])

  const materialLines = useMemo(() => {
    if (!quote) return []
    return quote.lines.filter((l) => catalog.find((c) => c.id === l.itemId)?.kind === "material")
  }, [quote, catalog])

  const laborLines = useMemo(() => {
    if (!quote) return []
    return quote.lines.filter((l) => catalog.find((c) => c.id === l.itemId)?.kind === "labor")
  }, [quote, catalog])

  const extraLines = useMemo(() => {
    if (!quote) return []
    return quote.lines.filter((l) => catalog.find((c) => c.id === l.itemId)?.kind === "extra")
  }, [quote, catalog])

  const totals = quote ? quoteTotals(quote, catalog) : null
  const displayPublicItems = quote ? clientPublicItemsForQuote(quote, catalog) : []
  const clientTotals = quote ? quoteClientDue(quote, catalog) : null
  const totalDue = clientTotals?.total || project?.totalDue || 0
  const billing = project ? projectBillingSummary(project, totalDue) : null

  useEffect(() => {
    if (!isAdmin || !project || projectIsHidden(project, quotations)) return
    if (skipProjectSave.current) {
      skipProjectSave.current = false
      return
    }
    const same =
      (notes.trim() || undefined) === (project.notes || undefined) &&
      (dueDate || undefined) === (project.dueDate || undefined) &&
      (deliveredAt || undefined) === (project.deliveredAt || undefined)
    if (same) return
    const t = window.setTimeout(() => {
      updateProject(project.id, {
          dueDate: dueDate || undefined,
          deliveredAt: deliveredAt || undefined,
          notes: notes.trim() || undefined,
        })
    }, 700)
    return () => window.clearTimeout(t)
  }, [
    notes,
    dueDate,
    deliveredAt,
    isAdmin,
    project,
    quotations,
    updateProject,
  ])

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Proyecto no encontrado.
        <button
          type="button"
          onClick={() => navigate({ name: "projects" })}
          className="block mx-auto mt-4 text-primary"
        >
          Volver a proyectos
        </button>
      </div>
    )
  }

  const inTrash = projectIsTrashed(project) || projectIsHidden(project, quotations)

  const overdue = projectIsOverdue(project)
  const displayTitle = projectTitle(project, quote?.title)

  function choosePaymentMode(mode: PaymentMode) {
    setProjectPaymentMode(project!.id, mode)
    // Si elige una sola exhibición y no hay cuotas, programa el total.
    if (
      mode === "unico" &&
      (project!.installments ?? []).length === 0 &&
      billing &&
      billing.totalDue > 0
    ) {
      addProjectInstallment(project!.id, {
        amount: billing.totalDue,
        dueDate: todayIso,
        note: "Pago único",
      })
    }
  }

  function scheduleInstallment() {
    const amount = Number(instAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast("Ingresa un monto válido")
      window.setTimeout(() => setToast(null), 2200)
      return
    }
    if (!instDueDate) {
      setToast("Indica la fecha de cobro")
      window.setTimeout(() => setToast(null), 2200)
      return
    }
    addProjectInstallment(project!.id, {
      amount,
      dueDate: instDueDate,
      note: instNote.trim() || undefined,
      invoiceUuid: instInvoiceUuid.trim() || undefined,
      invoiceDate: instInvoiceDate || undefined,
      method: instMethod,
    })
    setInstAmount("")
    setInstNote("")
    setInstInvoiceUuid("")
    setInstInvoiceDate("")
    setInstMethod("transferencia")
    setToast("Cuota programada")
    window.setTimeout(() => setToast(null), 2200)
  }

  function openEditor(instId: string) {
    const inst = (project!.installments ?? []).find((x) => x.id === instId)
    if (!inst) return
    setEditId(instId)
    setEditAmount(String(inst.amount))
    setEditDueDate(inst.dueDate)
    setEditNote(inst.note ?? "")
    setEditUuid(inst.invoiceUuid ?? "")
    setEditInvoiceDate(inst.invoiceDate ?? "")
    setEditMethod(inst.method ?? "transferencia")
  }

  function saveEditor() {
    if (!editId) return
    const inst = (project!.installments ?? []).find((x) => x.id === editId)
    if (!inst) return
    const paid = installmentIsPaid(inst)

    if (!paid) {
      const amount = Number(editAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        setToast("Ingresa un monto válido")
        window.setTimeout(() => setToast(null), 2200)
        return
      }
      if (!editDueDate) {
        setToast("Indica la fecha a cobrar")
        window.setTimeout(() => setToast(null), 2200)
        return
      }
      updateProjectInstallment(project!.id, editId, {
        amount,
        dueDate: editDueDate,
        note: editNote.trim() || undefined,
        invoiceUuid: editUuid.trim() || undefined,
        invoiceDate: editInvoiceDate || undefined,
        method: editMethod,
      })
    } else {
      updateProjectInstallment(project!.id, editId, {
        invoiceUuid: editUuid.trim() || undefined,
        invoiceDate: editInvoiceDate || undefined,
        method: editMethod,
      })
    }
    setEditId(null)
    setToast(paid ? "Datos de cobro guardados" : "Abono actualizado")
    window.setTimeout(() => setToast(null), 2200)
  }

  function confirmCollect(installmentId: string) {
    if (!collectDate) {
      setToast("Indica la fecha de cobro")
      window.setTimeout(() => setToast(null), 2200)
      return
    }
    const amount = Number(collectAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast("Ingresa un monto válido")
      window.setTimeout(() => setToast(null), 2200)
      return
    }
    updateProjectInstallment(project!.id, installmentId, {
      amount,
      invoiceUuid: collectUuid.trim() || undefined,
      invoiceDate: collectInvoiceDate || undefined,
    })
    markInstallmentPaid(project!.id, installmentId, {
      paidAt: collectDate,
      method: collectMethod,
    })
    setCollectId(null)
    setCollectAmount("")
    setCollectUuid("")
    setCollectInvoiceDate("")
    setToast("Abono marcado como cobrado")
    window.setTimeout(() => setToast(null), 2200)
  }

  function startCollect(instId: string) {
    const inst = (project!.installments ?? []).find((x) => x.id === instId)
    setCollectId(instId)
    setCollectDate(todayIso)
    setCollectAmount(inst ? String(inst.amount) : "")
    setCollectMethod(inst?.method ?? "transferencia")
    setCollectUuid(inst?.invoiceUuid ?? "")
    setCollectInvoiceDate(inst?.invoiceDate ?? "")
    setEditId(null)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate({ name: "projects" })}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Proyectos
      </button>

      {inTrash && (
        <div className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-sm text-muted-foreground">
          Este proyecto está en Eliminados. Se borra del todo a los 15 días.
          {project.quotationId ? " La cotización ligada va junta." : ""} Los cobros ya registrados no se tocan.
        </div>
      )}

      <section className="mb-6">
        <CoverPhotoField
          imageUrl={projectCoverUrl(project, quote)}
          onChange={(url) => updateProject(project.id, { coverImageUrl: url })}
          canRemove={Boolean(project.coverImageUrl)}
        >
          <div className="flex justify-end">
            {canTrashProject(user) && !inTrash && (
              <button
                type="button"
                onClick={() => {
                  const pair = project.quotationId
                    ? " La cotización ligada también se mueve."
                    : ""
                  if (
                    !window.confirm(
                      `¿Mover ${project.id} a Eliminados?${pair} Puedes recuperarlo en 15 días.`,
                    )
                  ) {
                    return
                  }
                  void trashProject(project.id).then((res) => {
                    if (!res.ok) setToast(res.error)
                  })
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-destructive/80"
              >
                <Trash2 className="size-3.5" />
                Eliminar proyecto
              </button>
            )}
            {inTrash && canTrashProject(user) && (
              <button
                type="button"
                onClick={() => {
                  void restoreProject(project.id).then((res) => {
                    if (!res.ok) setToast(res.error)
                  })
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/15"
              >
                <RotateCcw className="size-3.5" />
                Recuperar proyecto
              </button>
            )}
          </div>

          <div className="mt-auto max-w-[min(100%,36rem)] pb-12 sm:pb-0 sm:pr-40">
            <p className="font-mono text-[11px] font-semibold tracking-wide text-white/75">
              {quote ? project.id : `${project.id} · Sin cotización`}
            </p>
            <h1 className="mt-1 text-2xl font-bold font-display tracking-tight text-white sm:text-3xl text-balance">
              {displayTitle}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <ProjectStageBadge stage={project.stage} />
              {billing && (
                <ToneBadge
                  label={BILLING_STATUS_META[billing.status].label}
                  tone={BILLING_STATUS_META[billing.status].tone}
                />
              )}
              {quote ? (
                <DepartmentBadges quotation={quote} />
              ) : (
                <DepartmentBadges departments={project.departments} />
              )}
              {overdue && !inTrash && (
                <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/20 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <AlertTriangle className="size-3" />
                  Entrega taller vencida
                </span>
              )}
            </div>
          </div>
        </CoverPhotoField>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="rounded-2xl surface-card p-5">
            <h2 className="text-sm font-bold font-display mb-4">Datos del cliente</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  Empresa
                </p>
                <p className="font-semibold">{client?.company ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  RFC
                </p>
                <p className="font-mono font-medium">{client?.rfc || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Contacto
                </p>
                <p className="font-medium">{client?.contact ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Correo
                </p>
                <p className="font-medium">{client?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Cotización
                </p>
                {quote ? (
                  <button
                    type="button"
                    onClick={() => navigate({ name: "review", id: quote.id })}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <FileText className="size-3.5" />
                    Ver cotización
                  </button>
                ) : (
                  <p className="font-semibold text-muted-foreground">N/A</p>
                )}
                {quote && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Para cambiar totales: En revisión → actualiza → Aprobada.
                  </p>
                )}
              </div>
            </div>
          </section>

          {quote && (
          <>
          <section className="rounded-2xl surface-card p-5">
            <h2 className="text-sm font-bold font-display mb-3">Materiales</h2>
            {materialLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin materiales.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-1 py-2 font-semibold">Artículo</th>
                      <th className="px-2 py-2 font-semibold text-right">Cant.</th>
                      {isAdmin && (
                        <th className="px-2 py-2 font-semibold text-right">Precio público</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {materialLines.map((line) => {
                      const item = catalog.find((c) => c.id === line.itemId)
                      if (!item) return null
                      return (
                        <tr key={line.itemId} className="border-b border-border/60">
                          <td className="px-1 py-2.5">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{item.id}</p>
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono">{line.quantity}</td>
                          {isAdmin && (
                            <td className="px-2 py-2.5 text-right font-mono">
                              {currency(line.unitPrice ?? 0)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl surface-card p-5">
            <h2 className="text-sm font-bold font-display mb-3">Mano de obra</h2>
            {laborLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mano de obra.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-1 py-2 font-semibold">Artículo</th>
                      <th className="px-2 py-2 font-semibold text-right">Horas</th>
                      {isAdmin && (
                        <th className="px-2 py-2 font-semibold text-right">Precio público</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {laborLines.map((line) => {
                      const item = catalog.find((c) => c.id === line.itemId)
                      if (!item) return null
                      return (
                        <tr key={line.itemId} className="border-b border-border/60">
                          <td className="px-1 py-2.5">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{item.id}</p>
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono">{line.quantity}</td>
                          {isAdmin && (
                            <td className="px-2 py-2.5 text-right font-mono">
                              {currency(line.unitPrice ?? 0)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl surface-card p-5">
            <h2 className="text-sm font-bold font-display mb-3">Extras</h2>
            {extraLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin extras.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-1 py-2 font-semibold">Artículo</th>
                      <th className="px-2 py-2 font-semibold text-right">Cant.</th>
                      {isAdmin && (
                        <th className="px-2 py-2 font-semibold text-right">Precio público</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {extraLines.map((line) => {
                      const item = catalog.find((c) => c.id === line.itemId)
                      if (!item) return null
                      return (
                        <tr key={line.itemId} className="border-b border-border/60">
                          <td className="px-1 py-2.5">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{item.id}</p>
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono">{line.quantity}</td>
                          {isAdmin && (
                            <td className="px-2 py-2.5 text-right font-mono">
                              {currency(line.unitPrice ?? 0)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {isAdmin && totals && (
              <p className="mt-3 text-xs text-muted-foreground text-right">
                Cargo interno materiales {currency(totals.materialCharge)} · mano de obra{" "}
                {currency(totals.laborCharge)} · extras {currency(totals.extrasCharge)}
              </p>
            )}
          </section>

          <section className="rounded-2xl surface-card p-5 border border-primary/25">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold font-display">Ítems al cliente</h2>
              {clientTotals && (
                <span className="font-mono text-sm font-semibold text-primary">
                  {currencyMxn(clientTotals.total)}
                </span>
              )}
            </div>
            {displayPublicItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ítems públicos.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {displayPublicItems.map((item) => (
                  <li key={item.id} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          <span className="font-mono text-muted-foreground mr-2">{item.quantity}</span>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <p className="font-mono text-sm shrink-0">{currencyMxn(item.unitPrice)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </>
          )}

          {billing && (
            <section className="rounded-2xl surface-card p-5 border border-chart-2/30">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h2 className="text-sm font-bold font-display flex items-center gap-2">
                  <Receipt className="size-4 text-chart-2" />
                  Facturación y cobro
                </h2>
                <ToneBadge
                  label={BILLING_STATUS_META[billing.status].label}
                  tone={BILLING_STATUS_META[billing.status].tone}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">
                Estado de cobro al cliente. Independiente de la etapa del taller.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                  <p className="font-mono text-sm font-bold mt-0.5">{currencyMxn(billing.totalDue)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagado</p>
                  <p className="font-mono text-sm font-bold mt-0.5 text-fin-gain">
                    {currencyMxn(billing.paid)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</p>
                  <p
                    className={`font-mono text-sm font-bold mt-0.5 ${
                      billing.balance > 0 ? "text-chart-3" : "text-foreground"
                    }`}
                  >
                    {currencyMxn(billing.balance)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Próximo cobro
                  </p>
                  <p className="font-mono text-sm font-bold mt-0.5">
                    {billing.nextDue ? formatDate(billing.nextDue) : "—"}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Método de pago (CFDI)
                </p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Cómo se factura al cliente. El folio del proyecto es el de la cotización.
                </p>
                {isAdmin ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(["unico", "abonos"] as PaymentMode[]).map((mode) => {
                      const active = project.paymentMode === mode
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => choosePaymentMode(mode)}
                          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <p className="text-sm font-semibold">{PAYMENT_MODE_LABEL[mode]}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {mode === "unico"
                              ? "Un solo cobro / factura."
                              : "Varias cuotas o parcialidades."}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm font-semibold">
                    {project.paymentMode
                      ? PAYMENT_MODE_LABEL[project.paymentMode]
                      : "Sin definir"}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Plan de cobro / facturas
                </h3>
                {billing.nextDue && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Bell className="size-3.5" />
                    Recordatorio: {formatDate(billing.nextDue)}
                  </span>
                )}
              </div>

              {(project.installments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {project.paymentMode
                    ? "Programa las cuotas con fecha para saber cuándo cobrar."
                    : "Elige si el cliente paga en una exhibición o en abonos."}
                </p>
              ) : (
                <ul className="flex flex-col gap-2 mb-4">
                  {[...(project.installments ?? [])]
                    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
                    .map((inst) => {
                      const paid = installmentIsPaid(inst)
                      const overdueInst = !paid && inst.dueDate < todayIso
                      return (
                        <li
                          key={inst.id}
                          className={`rounded-xl border px-3 py-3 ${
                            paid
                              ? "border-fin-gain/30 bg-fin-gain/5"
                              : overdueInst
                                ? "border-destructive/35 bg-destructive/5"
                                : "border-border bg-muted/20"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-bold">
                                {currencyMxn(inst.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Cobrar:{" "}
                                <span className="font-mono font-semibold text-foreground">
                                  {formatDate(inst.dueDate)}
                                </span>
                                {inst.note ? ` · ${inst.note}` : ""}
                              </p>
                              {inst.invoiceUuid ? (
                                <>
                                  <p className="text-[11px] text-muted-foreground mt-1.5 font-mono break-all">
                                    ID factura:{" "}
                                    <span className="text-foreground">{inst.invoiceUuid}</span>
                                  </p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Día generada:{" "}
                                    <span className="font-mono font-semibold text-foreground">
                                      {formatDate(inst.invoiceDate)}
                                    </span>
                                  </p>
                                </>
                              ) : (
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                  Sin CFDI todavía
                                  {isAdmin ? " — puedes agregarlo cuando se genere." : "."}
                                </p>
                              )}
                              {paid && (
                                <p className="text-[11px] text-fin-gain mt-1">
                                  Cobrado {formatDate(inst.paidAt)}
                                  {inst.method
                                    ? ` · ${PAYMENT_METHOD_LABEL[inst.method]}`
                                    : ""}
                                </p>
                              )}
                              {overdueInst && (
                                <p className="text-[11px] text-destructive mt-1 inline-flex items-center gap-1">
                                  <AlertTriangle className="size-3" />
                                  Cobro vencido — enviar recordatorio
                                </p>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCollectId(null)
                                    openEditor(inst.id)
                                  }}
                                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-accent"
                                >
                                  Editar
                                </button>
                                {!paid ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startCollect(inst.id)}
                                      className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground"
                                    >
                                      Registrar cobro
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const res = removeProjectInstallment(project.id, inst.id)
                                        if (!res.ok) window.alert(res.error)
                                      }}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      aria-label="Eliminar cuota"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const note = window.prompt(
                                        "Nota de corrección (el cobro no se puede desmarcar):",
                                      )
                                      if (note?.trim()) {
                                        addPaymentCorrectionNote(project.id, inst.id, note)
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-accent"
                                  >
                                    Nota corrección
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {isAdmin && editId === inst.id && (
                            <div className="mt-3 pt-3 border-t border-border/70 grid sm:grid-cols-2 gap-2">
                              {paid ? (
                                <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                                  Abono cobrado: puedes corregir medio de cobro y datos fiscales
                                  (CFDI). Monto → nota de corrección.
                                </p>
                              ) : (
                                <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                                  Ajusta monto, fecha, medio previsto o CFDI.
                                </p>
                              )}
                              {!paid && (
                                <>
                                  <label className="block">
                                    <span className="text-[11px] text-muted-foreground">
                                      Cantidad (con IVA)
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={editAmount}
                                      onChange={(e) => setEditAmount(e.target.value)}
                                      className={`${inputCls} mt-1 font-mono`}
                                      autoFocus
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-[11px] text-muted-foreground">
                                      Fecha a cobrar
                                    </span>
                                    <input
                                      type="date"
                                      value={editDueDate}
                                      onChange={(e) => setEditDueDate(e.target.value)}
                                      className={`${inputCls} mt-1`}
                                    />
                                  </label>
                                  <label className="block sm:col-span-2">
                                    <span className="text-[11px] text-muted-foreground">
                                      Nota
                                    </span>
                                    <input
                                      value={editNote}
                                      onChange={(e) => setEditNote(e.target.value)}
                                      placeholder="Anticipo, 2ª parcialidad…"
                                      className={`${inputCls} mt-1`}
                                    />
                                  </label>
                                </>
                              )}
                              {paid && (
                                <div className="sm:col-span-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-[11px] text-muted-foreground">
                                  Programado:{" "}
                                  <span className="font-mono font-semibold text-foreground">
                                    {currencyMxn(inst.amount)}
                                  </span>
                                  {" · "}
                                  Cobrar:{" "}
                                  <span className="font-mono font-semibold text-foreground">
                                    {formatDate(inst.dueDate)}
                                  </span>
                                  {inst.note ? ` · ${inst.note}` : ""}
                                </div>
                              )}
                              <label className="block">
                                <span className="text-[11px] text-muted-foreground">
                                  Medio de cobro
                                </span>
                                <select
                                  value={editMethod}
                                  onChange={(e) =>
                                    setEditMethod(e.target.value as PaymentMethod)
                                  }
                                  className={`${inputCls} mt-1`}
                                >
                                  {PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {PAYMENT_METHOD_LABEL[m]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-muted-foreground">
                                  Día generada
                                </span>
                                <input
                                  type="date"
                                  value={editInvoiceDate}
                                  onChange={(e) => setEditInvoiceDate(e.target.value)}
                                  className={`${inputCls} mt-1`}
                                />
                              </label>
                              <label className="block sm:col-span-2">
                                <span className="text-[11px] text-muted-foreground">
                                  ID factura (UUID CFDI)
                                </span>
                                <input
                                  value={editUuid}
                                  onChange={(e) => setEditUuid(e.target.value)}
                                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                  className={`${inputCls} mt-1 font-mono text-xs`}
                                  autoFocus={paid}
                                />
                              </label>
                              <div className="sm:col-span-2 flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={saveEditor}
                                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditId(null)}
                                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          {isAdmin && collectId === inst.id && !paid && (
                            <div className="mt-3 pt-3 border-t border-border/70 grid sm:grid-cols-2 gap-2">
                              <label className="block">
                                <span className="text-[11px] text-muted-foreground">
                                  Monto cobrado (con IVA)
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={collectAmount}
                                  onChange={(e) => setCollectAmount(e.target.value)}
                                  className={`${inputCls} mt-1 font-mono`}
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-muted-foreground">
                                  Día que se pagó
                                </span>
                                <input
                                  type="date"
                                  value={collectDate}
                                  onChange={(e) => setCollectDate(e.target.value)}
                                  className={`${inputCls} mt-1`}
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-muted-foreground">
                                  Medio de cobro
                                </span>
                                <select
                                  value={collectMethod}
                                  onChange={(e) =>
                                    setCollectMethod(e.target.value as PaymentMethod)
                                  }
                                  className={`${inputCls} mt-1`}
                                >
                                  {PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {PAYMENT_METHOD_LABEL[m]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-muted-foreground">
                                  Día generada factura
                                </span>
                                <input
                                  type="date"
                                  value={collectInvoiceDate}
                                  onChange={(e) => setCollectInvoiceDate(e.target.value)}
                                  className={`${inputCls} mt-1`}
                                />
                              </label>
                              <label className="block sm:col-span-2">
                                <span className="text-[11px] text-muted-foreground">
                                  ID factura (UUID CFDI) — opcional
                                </span>
                                <input
                                  value={collectUuid}
                                  onChange={(e) => setCollectUuid(e.target.value)}
                                  placeholder="Si ya lo tienes, pégalo aquí"
                                  className={`${inputCls} mt-1 font-mono text-xs`}
                                />
                              </label>
                              <div className="sm:col-span-2 flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => confirmCollect(inst.id)}
                                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCollectId(null)}
                                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                </ul>
              )}

              {isAdmin && project.paymentMode && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                  <p className="text-xs font-semibold mb-1">
                    {project.paymentMode === "unico"
                      ? "Programar / ajustar pago único"
                      : "Programar abono"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Programa montos y fechas; el CFDI puede ir vacío. Usa{" "}
                    <span className="font-semibold">Editar</span> o{" "}
                    <span className="font-semibold">Registrar cobro</span> para ajustar monto,
                    fecha o factura después.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-2 mb-2">
                    <label className="block">
                      <span className="text-[11px] text-muted-foreground">
                        Cantidad (con IVA)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={instAmount}
                        onChange={(e) => setInstAmount(e.target.value)}
                        placeholder="0.00"
                        className={`${inputCls} mt-1 font-mono`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-muted-foreground">Fecha a cobrar</span>
                      <input
                        type="date"
                        value={instDueDate}
                        onChange={(e) => setInstDueDate(e.target.value)}
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-muted-foreground">Nota</span>
                      <input
                        value={instNote}
                        onChange={(e) => setInstNote(e.target.value)}
                        placeholder="Anticipo, 2ª parcialidad…"
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-muted-foreground">
                        Medio de cobro previsto
                      </span>
                      <select
                        value={instMethod}
                        onChange={(e) => setInstMethod(e.target.value as PaymentMethod)}
                        className={`${inputCls} mt-1`}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABEL[m]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-[11px] text-muted-foreground">
                        ID factura (UUID CFDI) — opcional
                      </span>
                      <input
                        value={instInvoiceUuid}
                        onChange={(e) => setInstInvoiceUuid(e.target.value)}
                        placeholder="Déjalo vacío; agrégalo después con Editar"
                        className={`${inputCls} mt-1 font-mono text-xs`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-muted-foreground">
                        Día generada — opcional
                      </span>
                      <input
                        type="date"
                        value={instInvoiceDate}
                        onChange={(e) => setInstInvoiceDate(e.target.value)}
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={scheduleInstallment}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
                    >
                      <Plus className="size-3.5" />
                      Agregar al plan
                    </button>
                    {billing.balance > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setInstAmount(String(billing.balance))
                          setInstNote(
                            project.paymentMode === "unico" ? "Pago único" : "Liquidación",
                          )
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        Usar saldo ({currencyMxn(billing.balance)})
                      </button>
                    )}
                  </div>
                  {billing.scheduled > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Programado en plan: {currencyMxn(billing.scheduled)}
                      {Math.abs(billing.scheduled - billing.totalDue) > 0.01 && (
                        <span className="text-chart-3">
                          {" "}
                          · Diff. vs total:{" "}
                          {currencyMxn(billing.scheduled - billing.totalDue)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-h,4rem)+1.5rem)]">
          <section className="rounded-2xl surface-card p-5">
            <h2 className="text-sm font-bold font-display mb-1">Etapa del taller</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Avance operativo. No cambia si un abono del cliente está vencido.
            </p>
            {isAdmin ? (
              <div className="flex flex-col gap-1.5">
                {PROJECT_STAGES.map((s) => {
                  const active = project.stage === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setProjectStage(project.id, s)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {PROJECT_STAGE_META[s].label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <ProjectStageBadge stage={project.stage} />
            )}
          </section>

          <section className="rounded-2xl surface-card p-5">
            <h2 className="text-sm font-bold font-display mb-1">Fechas de entrega</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Compromiso del taller con el cliente (no es fecha de cobro).
            </p>
            <label className="block mb-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Compromiso taller
              </span>
              <input
                type="date"
                value={dueDate}
                disabled={!isAdmin}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block mb-4">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Entrega real
              </span>
              <input
                type="date"
                value={deliveredAt}
                disabled={!isAdmin}
                onChange={(e) => setDeliveredAt(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <p className="text-[11px] text-muted-foreground mb-3">
              Compromiso actual: {formatDate(project.dueDate)} · Real: {formatDate(project.deliveredAt)}
            </p>
            <label className="block mb-4">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Notas
              </span>
              <textarea
                value={notes}
                disabled={!isAdmin}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={`${inputCls} mt-1 resize-y min-h-[96px]`}
                placeholder="Notas de seguimiento…"
              />
            </label>
          </section>
        </aside>
      </div>

      <div className="mt-6 pt-2">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Historial de acciones
          <span className="opacity-70">({project.history.length})</span>
          <ChevronDown
            className={`size-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`}
          />
        </button>
        {historyOpen && (
          <ul className="mt-3 flex flex-col gap-2">
            {[...project.history].reverse().map((h, i) => (
              <li
                key={`${h.at}-${h.action}-${i}`}
                className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 text-sm border-b border-border/40 pb-2 last:border-0"
              >
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                  {formatActivityAt(h.at).label}
                </span>
                <span className="text-muted-foreground shrink-0">{h.by}</span>
                <span className="text-foreground">{h.action}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 rounded-xl border border-border bg-card px-4 py-3 shadow-lg flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-primary" />
          {toast}
        </div>
      )}
    </div>
  )
}
