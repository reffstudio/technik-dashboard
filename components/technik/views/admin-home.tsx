"use client"

import React, { useState, useMemo } from "react"
import { Inbox, ChevronRight, Plus } from "lucide-react"
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
  DepartmentBadges,
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

function formatSendDate(iso?: string) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${Number(m)}/${Number(d)}/${y}`
}

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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por departamento">
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
        <>
          <div className="hidden lg:block rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="bg-primary text-primary-foreground text-left text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-3 font-semibold"># Cotización</th>
                    <th className="px-3 py-3 font-semibold">Empresa</th>
                    <th className="px-3 py-3 font-semibold">Creada por</th>
                    <th className="px-3 py-3 font-semibold">Descripción</th>
                    <th className="px-3 py-3 font-semibold">Departamentos</th>
                    <th className="px-3 py-3 font-semibold">Estado</th>
                    <th className="px-3 py-3 font-semibold">Fecha envío</th>
                    <th className="px-3 py-3 font-semibold">Comentarios</th>
                    <th className="px-2 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((q, i) => (
                    <tr
                      key={q.id}
                      onClick={() => navigate({ name: "review", id: q.id })}
                      className={`border-t border-border cursor-pointer hover:bg-fin-surface-hover transition-colors ${
                        i % 2 === 0 ? "bg-card" : "bg-muted/30"
                      }`}
                    >
                      <td className="px-3 py-3 font-mono text-xs text-primary whitespace-nowrap">
                        {q.reference}
                      </td>
                      <td className="px-3 py-3 font-semibold text-foreground whitespace-nowrap">
                        {clientName(q.clientId)}
                      </td>
                      <td className="px-3 py-3">
                        <QuoteAuthor quotation={q} layout="row" />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[220px]">
                        <span className="line-clamp-2">{q.title}</span>
                      </td>
                      <td className="px-3 py-3">
                        <DepartmentBadges quotation={q} />
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <QuotePipelineControls quotation={q} compact />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatSendDate(q.clientSentAt)}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground max-w-[180px]">
                        <span className="line-clamp-2">{q.comments || "—"}</span>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / tablet cards */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {list.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl surface-card p-4 text-left"
              >
                <button
                  type="button"
                  onClick={() => navigate({ name: "review", id: q.id })}
                  className="w-full text-left hover:opacity-90"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs text-primary">{q.reference}</span>
                    <DepartmentBadges quotation={q} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">{q.title}</p>
                  <p className="text-xs text-muted-foreground mb-2">{clientName(q.clientId)}</p>
                  <QuoteAuthor quotation={q} className="mb-3" />
                </button>
                <QuotePipelineControls quotation={q} compact />
                {q.comments && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{q.comments}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
