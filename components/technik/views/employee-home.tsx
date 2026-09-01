"use client"

import { useMemo, useState } from "react"
import { Plus, ChevronRight, ClipboardList, Send, Trash2, RotateCcw } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import {
  canRestoreQuotation,
  canTrashQuotation,
  isQuotationCreator,
  quotationIsTrashed,
  quotationTrashDaysLeft,
} from "@/lib/technik/data"
import { PageHeader, SearchField, Stat } from "../ui"
import type { View } from "../app-shell"

const FILTERS = [
  { id: "mine", label: "Todas" },
  { id: "draft", label: "Borradores" },
  { id: "pending_review", label: "Enviadas a administración" },
] as const

export function EmployeeHome({ navigate }: { navigate: (v: View) => void }) {
  const { quotations, projects, clients, user, deleteDraftQuotation, restoreDraftQuotation } =
    useTechnik()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"] | "trashed">("mine")
  const [query, setQuery] = useState("")

  const mine = useMemo(
    () =>
      quotations.filter(
        (q) =>
          q?.id &&
          isQuotationCreator(user, q) &&
          (q.status === "draft" || q.status === "pending_review") &&
          !quotationIsTrashed(q),
      ),
    [quotations, user],
  )
  const trashed = useMemo(
    () =>
      quotations.filter(
        (q) =>
          q?.id && isQuotationCreator(user, q) && quotationIsTrashed(q),
      ),
    [quotations, user],
  )

  const list = useMemo(() => {
    let base =
      filter === "trashed"
        ? trashed
        : filter === "mine"
          ? mine
          : mine.filter((q) => q.status === filter)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter((item) => {
      const company = (clients.find((c) => c.id === item.clientId)?.company ?? "").toLowerCase()
      return (
        item.reference.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        company.includes(q)
      )
    })
  }, [filter, mine, trashed, query, clients])

  const drafts = mine.filter((q) => q.status === "draft").length
  const inReview = mine.filter((q) => q.status === "pending_review").length

  return (
    <div>
      <PageHeader
        title="Mis cotizaciones"
        subtitle="Arma borradores y envíalos a administración. Ellos se encargan de precios y del resto."
      >
        <button
          onClick={() => navigate({ name: "builder" })}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Nueva cotización
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Borradores" value={String(drafts)} tone="neutral" />
        <Stat label="Enviadas a administración" value={String(inReview)} tone="amber" />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar folio, título o cliente…"
          className="max-w-lg"
        />
        {filter === "trashed" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Papelera · {trashed.length} cotizaci{trashed.length === 1 ? "ón" : "ones"} · 15 días
            </p>
            <button
              type="button"
              onClick={() => setFilter("mine")}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Volver
            </button>
          </div>
        ) : (
        <div className="flex gap-1 p-1 rounded-xl bg-background/60 border border-border w-full sm:w-fit overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ClipboardList className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {query.trim()
              ? "Ninguna cotización coincide con la búsqueda."
              : filter === "trashed"
                ? "La papelera está vacía."
                : "Aún no tienes cotizaciones."}
          </p>
          {!query.trim() && filter !== "trashed" && (
          <button
            onClick={() => navigate({ name: "builder" })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" />
            Crear la primera
          </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((q) => {
            const client = clients.find((c) => c.id === q.clientId)
            const inTrash = quotationIsTrashed(q)
            const editable = q.status === "draft" && !inTrash
            const canTrash = canTrashQuotation(user, q)
            const days = inTrash && q.deletedAt ? quotationTrashDaysLeft(q.deletedAt) : null
            const linked = projects.some((p) => p.quotationId === q.id)
            return (
              <div
                key={q.id}
                className={`group flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2.5 transition-colors ${
                  inTrash ? "opacity-60 grayscale" : "hover:bg-accent"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (inTrash) return
                    navigate(editable ? { name: "builder", id: q.id } : { name: "review", id: q.id })
                  }}
                  className="flex flex-1 items-center gap-3 text-left min-w-0"
                >
                  <div
                    className={`flex size-9 items-center justify-center rounded-xl shrink-0 ${
                      editable ? "bg-background text-muted-foreground" : "bg-primary/12 text-primary"
                    }`}
                  >
                    {editable ? <ClipboardList className="size-4" /> : <Send className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight">
                      {client?.company ?? "—"}
                    </p>
                    {q.title.trim() && q.title.trim() !== client?.company ? (
                      <p className="text-[11px] truncate text-muted-foreground mt-0.5">{q.title}</p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {q.reference.replace(/^TKS-Q-/, "")}
                      {!inTrash && ` · ${q.status === "draft" ? "Borrador" : "En revisión"}`}
                      {inTrash && days !== null
                        ? ` · ${days <= 0 ? "se borra hoy" : `se borra en ${days} día${days === 1 ? "" : "s"}`}`
                        : ""}
                    </p>
                  </div>
                  {!inTrash && (
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  )}
                </button>
                {canTrash && (
                  <button
                    type="button"
                    title="Mover a eliminados"
                    aria-label="Eliminar cotización"
                    onClick={(e) => {
                      e.stopPropagation()
                      const pair = linked ? " El proyecto ligado también se mueve." : ""
                      if (
                        !window.confirm(
                          `¿Mover ${q.reference} a Eliminados?${pair} Puedes recuperarla en 15 días.`,
                        )
                      ) {
                        return
                      }
                      void deleteDraftQuotation(q.id).then((res) => {
                        if (!res.ok) window.alert(res.error)
                      })
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {inTrash && canRestoreQuotation(user, q) && (
                  <button
                    type="button"
                    title="Recuperar"
                    aria-label="Recuperar cotización"
                    onClick={() => {
                      void restoreDraftQuotation(q.id).then((res) => {
                        if (!res.ok) window.alert(res.error)
                      })
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-primary hover:border-primary/40"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {filter !== "trashed" && (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => setFilter("trashed")}
            className="text-[11px] font-medium text-muted-foreground/70 hover:text-muted-foreground"
          >
            Eliminados{trashed.length > 0 ? ` (${trashed.length})` : ""}
          </button>
        </div>
      )}
    </div>
  )
}
