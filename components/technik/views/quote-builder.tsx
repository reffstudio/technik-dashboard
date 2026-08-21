"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Plus,
  Minus,
  Search,
  Send,
  Building2,
  Wrench,
  Boxes,
  Sparkles,
  Check,
  StickyNote,
  ChevronDown,
  Camera,
  X,
  Trash2,
} from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import { quotationIsTrashed, type CatalogItem, type QuoteLine, type WorkDepartment } from "@/lib/technik/data"
import { Field, inputCls, PageHeader } from "../ui"
import { VisitPhotosSection } from "../visit-photos-section"
import type { View } from "../app-shell"

type Step = "client" | "materials" | "labor" | "extras" | "review"

const EMPTY_CLIENT = {
  company: "",
  rfc: "",
  contact: "",
  email: "",
  phone: "",
  industry: "",
  location: "",
  ccEmails: [] as string[],
}

export function QuoteBuilder({ id, navigate }: { id?: string; navigate: (v: View) => void }) {
  const {
    quotations,
    clients,
    catalog,
    departments,
    createQuotation,
    updateQuotation,
    addClient,
    addCatalogItem,
    deleteDraftQuotation,
    user,
    markSaving,
  } = useTechnik()
  const isAdmin = user?.role === "admin"
  const existing = id ? quotations.find((q) => q.id === id) : undefined
  const sentLocked = existing?.status === "approved" || existing?.status === "closed"

  const steps: Step[] = ["client", "materials", "labor", "extras", "review"]

  const [step, setStep] = useState<Step>("client")
  const [clientId, setClientId] = useState(existing?.clientId ?? "")
  const [title, setTitle] = useState(existing?.title ?? "")
  const [selectedDepartments, setSelectedDepartments] = useState<WorkDepartment[]>(
    existing?.departments?.length
      ? existing.departments
      : departments[0]?.id
        ? [departments[0].id]
        : [],
  )
  const [notes, setNotes] = useState(existing?.notes ?? "")
  const [lines, setLines] = useState<QuoteLine[]>(existing?.lines ?? [])
  const [clientSearch, setClientSearch] = useState("")
  const [itemSearch, setItemSearch] = useState("")
  const [attachOpen, setAttachOpen] = useState(!!existing?.notes)
  const [clientModal, setClientModal] = useState(false)
  const [extraModal, setExtraModal] = useState(false)
  const [newClient, setNewClient] = useState(EMPTY_CLIENT)
  const [newExtra, setNewExtra] = useState({ name: "", unit: "ud", unitCost: 0 })
  const [draftId, setDraftId] = useState<string | undefined>(existing?.id)
  const [formError, setFormError] = useState("")

  const creatingRef = useRef(false)
  const lastSavedSig = useRef(
    existing
      ? JSON.stringify({
          clientId: existing.clientId,
          title: existing.title.trim(),
          selectedDepartments: existing.departments,
          lines: existing.lines,
          notes: existing.notes ?? "",
        })
      : "",
  )
  const materials = catalog.filter((c) => c.kind === "material")
  const labor = catalog.filter((c) => c.kind === "labor")
  const extras = catalog.filter((c) => c.kind === "extra")

  const qty = (itemId: string) => lines.find((l) => l.itemId === itemId)?.quantity ?? 0

  function setQty(item: CatalogItem, quantity: number) {
    setLines((prev) => {
      const rest = prev.filter((l) => l.itemId !== item.id)
      if (quantity <= 0) return rest
      return [...rest, { itemId: item.id, quantity }]
    })
  }

  const materialLines = lines.filter((l) => materials.some((m) => m.id === l.itemId))
  const laborLines = lines.filter((l) => labor.some((m) => m.id === l.itemId))
  const extraLines = lines.filter((l) => extras.some((m) => m.id === l.itemId))
  const client = clients.find((c) => c.id === clientId)
  const liveQuote = draftId ? quotations.find((q) => q.id === draftId) : existing

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.company.toLowerCase().includes(clientSearch.toLowerCase()) ||
          c.contact.toLowerCase().includes(clientSearch.toLowerCase()) ||
          (c.rfc ?? "").toLowerCase().includes(clientSearch.toLowerCase()),
      ),
    [clients, clientSearch],
  )

  const canContinueClient =
    !!clientId && title.trim().length > 2 && selectedDepartments.length > 0
  const canSubmit = canContinueClient

  const stepIndex = steps.indexOf(step)
  const canGoBack = stepIndex > 0

  function canEnterStep(target: Step) {
    if (target === "client") return true
    return canContinueClient
  }

  function goNext() {
    const i = steps.indexOf(step)
    if (i < 0 || i >= steps.length - 1) return
    const next = steps[i + 1]
    if (next && canEnterStep(next)) setStep(next)
  }

  function goBack() {
    const i = steps.indexOf(step)
    if (i <= 0) return
    setStep(steps[i - 1])
  }

  // Autosave draft
  useEffect(() => {
    if (sentLocked) return
    if (!canContinueClient) return

    const sig = JSON.stringify({
      clientId,
      title: title.trim(),
      selectedDepartments,
      lines,
      notes,
    })
    if (sig === lastSavedSig.current && draftId) return

    markSaving()
    const handle = window.setTimeout(() => {
      if (!draftId) {
        if (creatingRef.current) return
        creatingRef.current = true
        const newId = createQuotation({
          clientId,
          title: title.trim(),
          departments: selectedDepartments,
          lines,
          notes,
          submit: false,
        })
        lastSavedSig.current = sig
        setDraftId(newId)
        creatingRef.current = false
        return
      }
      updateQuotation(draftId, {
        clientId,
        title: title.trim(),
        departments: selectedDepartments,
        lines,
        notes,
      })
      lastSavedSig.current = sig
    }, 700)

    return () => window.clearTimeout(handle)
  }, [
    sentLocked,
    canContinueClient,
    clientId,
    title,
    selectedDepartments,
    lines,
    notes,
    draftId,
    createQuotation,
    updateQuotation,
    markSaving,
  ])

  if (sentLocked && existing) {
    return (
      <div className="text-center py-20 text-muted-foreground max-w-md mx-auto">
        <p className="text-foreground font-semibold mb-2">Cotización aprobada</p>
        <p className="text-sm mb-4">
          El builder queda bloqueado. Ábrela en revisión, pásala a{" "}
          <span className="font-semibold text-foreground">En revisión</span> para actualizar
          totales y vuelve a aprobar.
        </p>
        <button
          type="button"
          onClick={() => navigate({ name: "review", id: existing.id })}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Ir a revisión
        </button>
      </div>
    )
  }

  if (existing && quotationIsTrashed(existing)) {
    return (
      <div className="text-center py-20 text-muted-foreground max-w-md mx-auto">
        <p className="text-foreground font-semibold mb-2">Está en Eliminados</p>
        <p className="text-sm mb-4">
          Recupérala desde el resumen o la lista para seguir editándola. Se borra del todo a los 7 días.
        </p>
        <button
          type="button"
          onClick={() => navigate({ name: "quotations" })}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Ir a mis cotizaciones
        </button>
      </div>
    )
  }

  function toggleDepartment(deptId: WorkDepartment) {
    setSelectedDepartments((prev) => {
      if (prev.includes(deptId)) {
        if (prev.length === 1) return prev
        return prev.filter((d) => d !== deptId)
      }
      return [...prev, deptId]
    })
  }

  function ensureDraftId(): string | null {
    if (draftId) return draftId
    if (!canContinueClient) return null
    if (creatingRef.current) return null
    creatingRef.current = true
    const newId = createQuotation({
      clientId,
      title: title.trim(),
      departments: selectedDepartments,
      lines,
      notes,
      submit: false,
    })
    lastSavedSig.current = JSON.stringify({
      clientId,
      title: title.trim(),
      selectedDepartments,
      lines,
      notes,
    })
    setDraftId(newId)
    creatingRef.current = false
    return newId
  }

  async function createAndSelectClient() {
    if (!newClient.company || !newClient.email) {
      setFormError("Empresa y correo son obligatorios.")
      return
    }
    setFormError("")
    const res = await addClient({
      ...newClient,
      rfc: newClient.rfc.trim().toUpperCase(),
    })
    if (!res.ok) {
      setFormError(res.error)
      return
    }
    setClientId(res.id)
    setClientModal(false)
    setNewClient(EMPTY_CLIENT)
  }

  async function submitNewExtra() {
    const name = newExtra.name.trim()
    if (!name) {
      setFormError("El nombre del extra es obligatorio.")
      return
    }
    setFormError("")
    const res = await addCatalogItem({
      kind: "extra",
      name,
      sku: `FIELD-${Date.now().toString(36).toUpperCase()}`,
      category: "Extra",
      unit: newExtra.unit.trim() || "ud",
      unitCost: Math.max(0, Number(newExtra.unitCost) || 0),
    })
    if (!res.ok) {
      setFormError(res.error)
      return
    }
    setLines((prev) => {
      const rest = prev.filter((l) => l.itemId !== res.id)
      return [...rest, { itemId: res.id, quantity: 1 }]
    })
    setExtraModal(false)
    setNewExtra({ name: "", unit: "ud", unitCost: 0 })
  }

  function handleSubmit() {
    if (!canSubmit) return
    const payload = {
      clientId,
      title: title.trim(),
      departments: selectedDepartments,
      lines,
      notes,
    }
    if (draftId) {
      // Una sola mutación: evita que el autosave/push en vuelo pise el envío a revisión.
      updateQuotation(
        draftId,
        { ...payload, status: "pending_review" },
        "Envió a revisión",
      )
      navigate(isAdmin ? { name: "review", id: draftId } : { name: "quotations" })
      return
    }
    const newId = createQuotation({ ...payload, submit: true })
    navigate(isAdmin ? { name: "review", id: newId } : { name: "quotations" })
  }

  function handleDeleteDraft() {
    if (!draftId) return
    if (!window.confirm("¿Mover este borrador a Eliminados? Puedes recuperarlo en 7 días.")) return
    const res = deleteDraftQuotation(draftId)
    if (res.ok) navigate({ name: "quotations" })
  }

  const continueLabel =
    step === "review"
      ? isAdmin
        ? "Enviar a revisión"
        : "Enviar a administración"
      : step === "client"
        ? "Continuar a materiales"
        : step === "materials"
          ? "Continuar a mano de obra"
          : step === "labor"
            ? "Continuar a extras"
            : "Revisar y enviar"

  const continueDisabled =
    step === "review" ? !canSubmit : step === "client" ? !canContinueClient : false

  const stepMeta: { id: Step; label: string }[] = steps.map((s) => ({
    id: s,
    label:
      s === "client"
        ? "Cliente"
        : s === "materials"
          ? "Materiales"
          : s === "labor"
            ? "Mano de obra"
            : s === "extras"
              ? "Extras"
              : "Enviar",
  }))

  return (
    <div className="pb-36 sm:pb-28">
      <button
        type="button"
        onClick={() => navigate({ name: "quotations" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Volver
      </button>

      <PageHeader
        title={existing ? "Editar cotización" : "Nueva cotización"}
        subtitle={
          isAdmin
            ? "Arma el alcance (materiales, horas y extras). Se guarda sola en borrador."
            : "En campo: elige del catálogo, anota y toma fotos. Solo admin crea materiales/mano de obra nuevos; tú sí puedes crear extras."
        }
      >
        <div className="flex items-center gap-2">
          {draftId && existing?.status === "draft" && (
            <button
              type="button"
              onClick={handleDeleteDraft}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              <Trash2 className="size-3.5" />
              Borrar
            </button>
          )}
        </div>
      </PageHeader>

      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {stepMeta.map((s, i) => {
          const active = step === s.id
          const idx = stepIndex
          const done = i < idx
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (canEnterStep(s.id)) setStep(s.id)
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                    ? "border-primary/30 text-primary bg-primary/10"
                    : "border-border text-muted-foreground"
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      {step === "client" && (
        <div className="flex flex-col gap-4">
          <Field label="Descripción del trabajo">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Fabricación de unidad maquinada — carro para grúa"
              className={inputCls}
            />
          </Field>

          <Field label="Departamentos">
            <p className="text-[11px] text-muted-foreground mb-2">
              Puedes seleccionar más de uno (ej. Soldadura y Maquinados).
            </p>
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const selected = selectedDepartments.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDepartment(d.id)}
                    className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Cliente</p>
            <button
              type="button"
              onClick={() => {
                setFormError("")
                setClientModal(true)
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
            >
              <Plus className="size-3.5" />
              Nuevo cliente
            </button>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
            {filteredClients.map((c) => {
              const selected = clientId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  className={`flex items-center gap-3 rounded-2xl p-4 text-left border transition-colors ${
                    selected ? "border-primary bg-primary/10" : "surface-card border-transparent"
                  }`}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{c.company}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.contact} · {c.location}
                    </p>
                  </div>
                  {selected && <Check className="size-4 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {(step === "materials" || step === "labor") && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-3">
            {isAdmin
              ? "Selecciona del catálogo. Para alta de ítems nuevos usa Catálogo."
              : "Selecciona del catálogo existente. Solo administración puede crear materiales o mano de obra nuevos."}
          </p>
          <CatalogPicker
            kind={step}
            items={step === "materials" ? materials : labor}
            search={itemSearch}
            onSearch={setItemSearch}
            qty={qty}
            setQty={setQty}
            selectedCount={step === "materials" ? materialLines.length : laborLines.length}
          />
        </div>
      )}

      {step === "extras" && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-foreground">Extras en sitio</p>
            <button
              type="button"
              onClick={() => {
                setFormError("")
                setExtraModal(true)
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
            >
              <Plus className="size-3.5" />
              Nuevo extra
            </button>
          </div>
          <CatalogPicker
            kind="extras"
            items={extras}
            search={itemSearch}
            onSearch={setItemSearch}
            qty={qty}
            setQty={setQty}
            selectedCount={extraLines.length}
          />
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl surface-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Cliente</p>
            <p className="text-sm font-bold">{client?.company}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {client?.contact} · {client?.email}
            </p>
            <p className="text-sm font-semibold mt-4">{title}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Departamentos:{" "}
              {selectedDepartments
                .map((deptId) => departments.find((d) => d.id === deptId)?.label ?? deptId)
                .join(" · ")}
            </p>
          </div>

          <LineSummary title="Materiales" icon={Boxes} lines={materialLines} catalog={catalog} />
          <LineSummary title="Mano de obra" icon={Wrench} lines={laborLines} catalog={catalog} />
          <LineSummary title="Extras" icon={Sparkles} lines={extraLines} catalog={catalog} />

          {notes.trim() && (
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
              <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <StickyNote className="size-3.5 text-primary" />
                Notas de campo
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {(liveQuote?.visitPhotos?.length ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              {liveQuote!.visitPhotos!.length} foto
              {liveQuote!.visitPhotos!.length === 1 ? "" : "s"} de visita irán a administración.
            </p>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Al enviar, llega al administrador — no al cliente.
          </p>
        </div>
      )}

      {/* Sticky: nota / fotos + siguiente */}
      <div className="fixed inset-x-0 bottom-16 sm:bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl">
        {attachOpen && !sentLocked && (
          <div className="mx-auto max-w-3xl px-4 pt-3 max-h-[46vh] overflow-y-auto border-b border-border/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Agregar nota
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none text-sm`}
              placeholder="Medidas, acuerdos con el cliente, acceso al sitio, urgencias…"
            />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-3 mb-1.5">
              Agregar fotos
            </p>
            <div className="pb-3">
              <VisitPhotosSection
                compact
                quotationId={draftId}
                photos={liveQuote?.visitPhotos}
                canEdit={!sentLocked}
                onNeedDraft={async () => ensureDraftId()}
              />
            </div>
          </div>
        )}
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2 safe-bottom">
          <button
            type="button"
            onClick={() => setAttachOpen((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-3 text-xs font-semibold text-foreground hover:border-primary/40"
            aria-expanded={attachOpen}
            aria-label="Agregar nota o fotos"
          >
            <StickyNote className="size-4 text-primary" />
            <Camera className="size-4 text-primary" />
            <span className="hidden sm:inline">Nota / fotos</span>
            {notes.trim() ? (
              <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">N</span>
            ) : null}
            {(liveQuote?.visitPhotos?.length ?? 0) > 0 ? (
              <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                {liveQuote!.visitPhotos!.length}
              </span>
            ) : null}
            <ChevronDown
              className={`size-3.5 text-muted-foreground transition-transform ${attachOpen ? "rotate-180" : ""}`}
            />
          </button>
          {canGoBack ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-border px-3 py-3 text-sm font-semibold shrink-0"
            >
              Atrás
            </button>
          ) : null}
          {step === "review" ? (
            <button
              type="button"
              disabled={continueDisabled}
              onClick={handleSubmit}
              className="flex-1 min-w-0 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <Send className="size-4 shrink-0" />
              <span className="truncate">{continueLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={continueDisabled}
              onClick={goNext}
              className="flex-1 min-w-0 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <span className="truncate">{continueLabel}</span>
            </button>
          )}
        </div>
      </div>

      {clientModal && (
        <Modal title="Nuevo cliente" onClose={() => setClientModal(false)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Empresa">
              <input
                className={inputCls}
                value={newClient.company}
                onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
              />
            </Field>
            <Field label="RFC">
              <input
                className={`${inputCls} font-mono uppercase`}
                value={newClient.rfc}
                onChange={(e) => setNewClient({ ...newClient, rfc: e.target.value.toUpperCase() })}
                placeholder="XAXX010101000"
                maxLength={13}
              />
            </Field>
            <Field label="Contacto">
              <input
                className={inputCls}
                value={newClient.contact}
                onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })}
              />
            </Field>
            <Field label="Correo">
              <input
                type="email"
                className={inputCls}
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <input
                className={inputCls}
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </Field>
            <Field label="Industria">
              <input
                className={inputCls}
                value={newClient.industry}
                onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Ubicación">
                <input
                  className={inputCls}
                  value={newClient.location}
                  onChange={(e) => setNewClient({ ...newClient, location: e.target.value })}
                />
              </Field>
            </div>
          </div>
          {formError ? <p className="mt-3 text-xs text-destructive">{formError}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void createAndSelectClient()}
              disabled={!newClient.company || !newClient.email}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <Check className="size-4" />
              Guardar y seleccionar
            </button>
            <button
              type="button"
              onClick={() => setClientModal(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {extraModal && (
        <Modal title="Nuevo extra" onClose={() => setExtraModal(false)}>
          <p className="text-xs text-muted-foreground mb-3">
            Se agrega al catálogo de extras. El costo lo puede ajustar administración después.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Nombre">
                <input
                  className={inputCls}
                  value={newExtra.name}
                  onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
                  placeholder="Ej. Grúa en sitio / estacionamiento"
                />
              </Field>
            </div>
            <Field label="Unidad">
              <input
                className={inputCls}
                value={newExtra.unit}
                onChange={(e) => setNewExtra({ ...newExtra, unit: e.target.value })}
              />
            </Field>
            {isAdmin && (
              <Field label="Costo unitario">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={newExtra.unitCost}
                  onChange={(e) => setNewExtra({ ...newExtra, unitCost: Number(e.target.value) })}
                />
              </Field>
            )}
          </div>
          {formError ? <p className="mt-3 text-xs text-destructive">{formError}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void submitNewExtra()}
              disabled={!newExtra.name.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <Check className="size-4" />
              Agregar y seleccionar
            </button>
            <button
              type="button"
              onClick={() => setExtraModal(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Cerrar" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl surface-elevated border border-border p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CatalogPicker({
  kind,
  items,
  search,
  onSearch,
  qty,
  setQty,
  selectedCount,
}: {
  kind: "materials" | "labor" | "extras"
  items: CatalogItem[]
  search: string
  onSearch: (v: string) => void
  qty: (id: string) => number
  setQty: (item: CatalogItem, q: number) => void
  selectedCount: number
}) {
  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase()),
  )

  const placeholder =
    kind === "materials"
      ? "Buscar material o SKU…"
      : kind === "labor"
        ? "Buscar tipo de trabajo…"
        : "Buscar extra (flete, viático…)…"

  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 py-2 mb-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <p className="text-xs text-muted-foreground mb-2">{selectedCount} seleccionados</p>

      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
        {filtered.map((item) => {
          const q = qty(item.id)
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl surface-card p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug">{item.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {item.id} · {item.unit}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setQty(item, q - 1)}
                  disabled={q <= 0}
                  className="flex size-8 items-center justify-center rounded-lg border border-border disabled:opacity-30"
                  aria-label="Menos"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-10 text-center font-mono text-sm font-bold">{q || "—"}</span>
                <button
                  type="button"
                  onClick={() => setQty(item, q + 1)}
                  className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                  aria-label="Más"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineSummary({
  title,
  icon: Icon,
  lines,
  catalog,
}: {
  title: string
  icon: React.ElementType
  lines: QuoteLine[]
  catalog: CatalogItem[]
}) {
  return (
    <div className="rounded-2xl surface-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin ítems</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const item = catalog.find((c) => c.id === l.itemId)
            return (
              <li key={l.itemId} className="flex justify-between gap-3 text-sm">
                <span className="text-foreground truncate">{item?.name}</span>
                <span className="font-mono text-muted-foreground shrink-0">
                  {l.quantity} {item?.unit}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
