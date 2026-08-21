"use client"

import { useState, useMemo } from "react"
import { Inbox, Plus } from "lucide-react"
import { useTechnik, quoteTotals } from "@/lib/technik/store"
import {
  currency,
  quotationHasDepartment,
  type QuoteStatus,
  type WorkDepartment,
} from "@/lib/technik/data"
import {
  PageHeader,
  Stat,
  SearchField,
  QuoteAuthor,
  QuotePipelineControls,
} from "../ui"
import type { View } from "../app-shell"

const FILTERS: {
  id: "queue" | "all" | QuoteStatus | "sent_client" | "sent_supplier" | "waiting"
  label: string
}[] = [
  { id: "queue", label: "Nuevas" },
  { id: "waiting", label: "En espera cliente" },
  { id: "approved", label: "Aprobadas" },
  { id: "sent_client", label: "Enviada al cliente" },
  { id: "sent_supplier", label: "Enviada al proveedor" },
  { id: "closed", label: "Archivadas" },
  { id: "all", label: "Todas" },
]

export function AdminHome({ navigate }: { navigate: (v: View) => void }) {
  const { quotations, clients, catalog, departments } = useTechnik()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("queue")
  const [dept, setDept] = useState<"all" | WorkDepartment>("all")
  const [query, setQuery] = useState("")

  const clientName = (id: string) => clients.find((c) => c.id === id)?.company ?? id

  const pending = quotations.filter((q) => q.status === "pending_review")
  const waitingClient = quotations.filter(
    (q) => q.clientSentAt && (q.clientResponse ?? "en_espera") === "en_espera",
  )
  const pipelineValue = useMemo(
    () =>
      quotations
        .filter((q) => q.status !== "draft" && q.status !== "closed")
        .reduce((sum, q) => sum + quoteTotals(q, catalog).total, 0),
    [quotations, catalog],
  )
  const avgMargin = useMemo(() => {
    const priced = quotations.filter((q) => q.status !== "draft")
    if (priced.length === 0) return 0
    return priced.reduce((s, q) => s + quoteTotals(q, catalog).marginPct, 0) / priced.length
  }, [quotations, catalog])

  const list = useMemo(() => {
    let base = quotations
    if (filter === "queue") base = pending
    else if (filter === "waiting") base = waitingClient
    else if (filter === "all") base = quotations.filter((q) => q.status !== "draft")
    else if (filter === "sent_client") base = quotations.filter((q) => !!q.clientSentAt)
    else if (filter === "sent_supplier") base = quotations.filter((q) => !!q.supplierSentAt)
    else base = quotations.filter((q) => q.status === filter)

    if (dept !== "all") base = base.filter((q) => quotationHasDepartment(q, dept))

    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((item) => {
      const company = clientName(item.clientId).toLowerCase()
      return (
        item.reference.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        company.includes(q) ||
        item.createdBy.toLowerCase().includes(q)
      )
    })
  }, [filter, dept, pending, waitingClient, quotations, query, clients])

  return (
    <div>
      <PageHeader
        title="Lista de cotizaciones"
        subtitle="Seguimiento de cotizaciones nuevas y enviadas."
      >
        <button
          type="button"
          onClick={() => navigate({ name: "builder" })}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Nueva cotización
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Stat
          label="En cola"
          value={String(pending.length)}
          hint="Esperando tu revisión"
          tone="amber"
        />
        <Stat
          label="En espera cliente"
          value={String(waitingClient.length)}
          hint="PDF enviado, sin decisión"
          tone="azure"
        />
        <Stat
          label="Valor en curso"
          value={currency(pipelineValue)}
          hint="Cotizaciones activas"
          tone="teal"
        />
        <Stat
          label="Margen prom."
          value={`${avgMargin.toFixed(2)}%`}
          hint="Cotizaciones con precio"
          tone="gain"
        />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar folio, título, cliente o autor…"
          className="max-w-lg"
        />
        <div className="flex items-center gap-1 p-1 rounded-xl bg-background/60 border border-border overflow-x-auto flex-1 min-w-0">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por departamento">
          <button
            type="button"
            onClick={() => setDept("all")}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
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
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.short || d.label}
              </button>
            )
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Inbox className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {query.trim()
              ? "Ninguna cotización coincide con la búsqueda."
              : "No hay nada aquí por ahora."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((q) => {
            const company = clientName(q.clientId)
            return (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <button
                  type="button"
                  onClick={() => navigate({ name: "review", id: q.id })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <QuoteAuthor quotation={q} layout="avatar" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate leading-tight">{company}</p>
                    {q.title.trim() && q.title.trim() !== company ? (
                      <p className="text-[11px] truncate text-muted-foreground mt-0.5">{q.title}</p>
                    ) : null}
                    <QuoteAuthor quotation={q} layout="name" className="mt-0.5" />
                  </div>
                  <span className="hidden sm:inline font-mono text-[10px] shrink-0 text-muted-foreground tabular-nums">
                    {q.reference.replace(/^TKS-Q-/, "")}
                  </span>
                </button>
                <QuotePipelineControls quotation={q} compact />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
