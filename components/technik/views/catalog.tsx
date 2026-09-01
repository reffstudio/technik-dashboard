"use client"

import { useState, useMemo } from "react"
import { Search, Plus, Boxes, Pencil, Check, X, Wrench, Sparkles, Trash2 } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import {
  currencyPrecise,
  suggestedPrice,
  type CatalogCategory,
  type CatalogItem,
  type CatalogKind,
} from "@/lib/technik/data"
import { DEFAULT_LABOR_HOURLY_RATE } from "@/lib/technik/company"
import { Field, inputCls, PageHeader, DecimalInput } from "../ui"

const KIND_OPTIONS: { id: CatalogKind; label: string }[] = [
  { id: "material", label: "Material" },
  { id: "labor", label: "Mano de obra" },
  { id: "extra", label: "Extra" },
]

const KIND_FILTERS: { id: "all" | CatalogKind; label: string }[] = [
  { id: "all", label: "Todas" },
  ...KIND_OPTIONS,
]

type CatalogEditDraft = {
  name: string
  sku: string
  unit: string
  unitCost: number
  kind: CatalogKind
  supplierId: string
}

function defaultCategory(kind: CatalogKind): CatalogCategory {
  if (kind === "labor") return "Mano de obra"
  if (kind === "extra") return "Extra"
  return "Material"
}

function kindLabel(kind: CatalogKind) {
  return KIND_OPTIONS.find((k) => k.id === kind)?.label ?? kind
}

export function CatalogView() {
  const { catalog, suppliers, updateCatalogItem, addCatalogItem, removeCatalogItem } = useTechnik()
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<"all" | CatalogKind>("all")
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CatalogEditDraft | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const supplierName = (id?: string) => suppliers.find((s) => s.id === id)?.name ?? "—"

  const filtered = useMemo(
    () =>
      catalog.filter((c) => {
        if (kindFilter !== "all" && c.kind !== kindFilter) return false
        const q = search.toLowerCase().trim()
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          c.sku.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        )
      }),
    [catalog, search, kindFilter],
  )

  function startEdit(item: CatalogItem) {
    setConfirmDeleteId(null)
    setError("")
    setEditing(item.id)
    setEditDraft({
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      unitCost: item.unitCost,
      kind: item.kind,
      supplierId: item.supplierId ?? suppliers[0]?.id ?? "",
    })
  }
  async function saveEdit(id: string) {
    if (!editDraft || saving) return
    const name = editDraft.name.trim()
    const sku = editDraft.sku.trim()
    const unit = editDraft.unit.trim()
    if (!name || !unit || !Number.isFinite(editDraft.unitCost) || editDraft.unitCost < 0) return
    setSaving(true)
    setError("")
    const res = await updateCatalogItem(id, {
      name,
      sku,
      unit,
      unitCost: editDraft.unitCost,
      kind: editDraft.kind,
      category: defaultCategory(editDraft.kind),
      supplierId: editDraft.kind === "material" ? editDraft.supplierId || undefined : undefined,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(null)
    setEditDraft(null)
  }
  async function submitDelete(id: string) {
    if (saving) return
    setSaving(true)
    setError("")
    const res = await removeCatalogItem(id)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setConfirmDeleteId(null)
  }
  function cancelEdit() {
    setEditing(null)
    setEditDraft(null)
    setError("")
  }

  return (
    <div>
      <PageHeader
        title="Catálogo"
        subtitle="Materiales, mano de obra y extras. Solo administración puede ver y editar costos."
      >
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Agregar
        </button>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-2.5 mb-6 lg:items-center">
        <div className="flex items-center gap-2.5 flex-1 max-w-md rounded-xl bg-input/60 border border-border px-3.5 py-2">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar artículo, SKU o código…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-background/60 border border-border w-full sm:w-fit overflow-x-auto">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKindFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                kindFilter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {adding && (
        <AddRow
          suppliers={suppliers}
          onCancel={() => setAdding(false)}
          onAdd={async (item) => {
            const res = await addCatalogItem(item)
            if (!res.ok) {
              setError(res.error)
              return
            }
            setAdding(false)
          }}
        />
      )}

      {error ? <p className="mb-3 text-xs text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-background/40">
                <th className="px-5 py-3 font-semibold">Artículo</th>
                <th className="px-4 py-3 font-semibold">Código TKS</th>
                <th className="px-4 py-3 font-semibold">SKU fab.</th>
                <th className="px-4 py-3 font-semibold">Clase</th>
                <th className="px-4 py-3 font-semibold">Proveedor</th>
                <th className="px-4 py-3 font-semibold text-right">Costo / tarifa</th>
                <th className="px-4 py-3 font-semibold text-right">Público sug.</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isEditing = editing === item.id && editDraft
                const draft = isEditing ? editDraft : null
                const displayKind = draft?.kind ?? item.kind
                const suggested = suggestedPrice({
                  ...item,
                  kind: displayKind,
                  unitCost: draft?.unitCost ?? item.unitCost,
                })
                return (
                  <tr
                    key={item.id}
                    className="border-b border-border/60 last:border-0 hover:bg-fin-surface-hover/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {displayKind === "labor" ? (
                          <Wrench className="size-4 text-muted-foreground shrink-0" />
                        ) : displayKind === "extra" ? (
                          <Sparkles className="size-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Boxes className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          {draft ? (
                            <input
                              value={draft.name}
                              onChange={(e) => setEditDraft({ ...draft, name: e.target.value })}
                              className="w-full min-w-[10rem] rounded-lg bg-input/60 border border-border py-1.5 px-2 text-sm outline-none focus:border-primary/60"
                              aria-label="Nombre"
                            />
                          ) : (
                            <>
                              <span className="font-medium text-foreground">{item.name}</span>
                              {(item.kind === "material" || item.kind === "extra") && (
                                <p className="text-[10px] text-muted-foreground">+10% → público</p>
                              )}
                              {item.kind === "labor" && (
                                <p className="text-[10px] text-muted-foreground">
                                  Interno: +20% IMSS sobre horas
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-primary font-semibold">{item.id}</span>
                      {draft && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Fijo</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {draft ? (
                        <input
                          value={draft.sku}
                          onChange={(e) => setEditDraft({ ...draft, sku: e.target.value })}
                          className="w-28 rounded-lg bg-input/60 border border-border py-1.5 px-2 font-mono text-xs outline-none focus:border-primary/60"
                          aria-label="SKU"
                        />
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">{item.sku || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {draft ? (
                        <select
                          value={draft.kind}
                          onChange={(e) => {
                            const kind = e.target.value as CatalogKind
                            setEditDraft({
                              ...draft,
                              kind,
                              unit: kind === "labor" ? "h" : draft.unit === "h" ? "ud" : draft.unit,
                              supplierId:
                                kind === "material"
                                  ? draft.supplierId || suppliers[0]?.id || ""
                                  : "",
                            })
                          }}
                          className="rounded-lg bg-input/60 border border-border py-1.5 px-2 text-xs outline-none focus:border-primary/60"
                          aria-label="Clase"
                        >
                          {KIND_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {kindLabel(item.kind)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {draft ? (
                        draft.kind === "material" ? (
                          <select
                            value={draft.supplierId}
                            onChange={(e) => setEditDraft({ ...draft, supplierId: e.target.value })}
                            className="max-w-[10rem] rounded-lg bg-input/60 border border-border py-1.5 px-2 text-xs outline-none focus:border-primary/60"
                            aria-label="Proveedor"
                          >
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          "—"
                        )
                      ) : item.kind === "labor" ? (
                        "—"
                      ) : (
                        supplierName(item.supplierId)
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {draft ? (
                        <div className="flex items-center justify-end gap-1">
                          <DecimalInput
                            value={draft.unitCost}
                            min={0}
                            ariaLabel="Costo"
                            onChange={(n) => setEditDraft({ ...draft, unitCost: n })}
                            className="w-24 rounded-lg bg-input/60 border border-border py-1.5 px-2 text-right text-sm font-mono outline-none focus:border-primary/60"
                          />
                          <input
                            value={draft.unit}
                            onChange={(e) => setEditDraft({ ...draft, unit: e.target.value })}
                            className="w-12 rounded-lg bg-input/60 border border-border py-1.5 px-1.5 text-center text-xs outline-none focus:border-primary/60"
                            aria-label="Unidad"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-foreground">
                          {currencyPrecise(item.unitCost)}
                          <span className="text-muted-foreground">/{item.unit}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-primary">
                      {currencyPrecise(suggested)}
                      {displayKind === "labor" ? (
                        <span className="text-muted-foreground">/h</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {draft ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(item.id)}
                              className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                              aria-label="Guardar"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                              aria-label="Cancelar"
                            >
                              <X className="size-3.5" />
                            </button>
                          </>
                        ) : confirmDeleteId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => submitDelete(item.id)}
                              className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground"
                            >
                              {saving ? "…" : "Sí"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                              aria-label="Editar artículo"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                              aria-label="Eliminar artículo"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AddRow({
  onCancel,
  onAdd,
  suppliers,
}: {
  onCancel: () => void
  onAdd: (item: Omit<CatalogItem, "id">) => void | Promise<void>
  suppliers: ReturnType<typeof useTechnik>["suppliers"]
}) {
  const [kind, setKind] = useState<CatalogKind>("material")
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [unit, setUnit] = useState("ud")
  const [unitCost, setUnitCost] = useState(0)
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "")

  function switchKind(next: CatalogKind) {
    setKind(next)
    if (next === "labor") {
      setUnit("h")
      setUnitCost(DEFAULT_LABOR_HOURLY_RATE)
    } else {
      setUnit("ud")
      setUnitCost(0)
    }
  }

  const valid = Boolean(name.trim() && Number.isFinite(unitCost) && unitCost >= 0)

  return (
    <div className="rounded-2xl surface-elevated p-5 mb-4">
      <h3 className="text-sm font-bold text-foreground font-display mb-4">Nuevo ítem del catálogo</h3>
      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Clase de ítem
        </p>
        <div className="flex gap-1 p-1 rounded-xl bg-background/60 border border-border w-fit flex-wrap">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => switchKind(opt.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                kind === opt.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="SKU (opcional)">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Si el fabricante lo tiene"
            className={inputCls}
          />
        </Field>
        <Field label="Unidad">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
        </Field>
        <Field label={kind === "labor" ? "Tarifa $/h (catálogo)" : "Costo unitario ($)"}>
          <DecimalInput
            value={unitCost}
            min={0}
            ariaLabel={kind === "labor" ? "Tarifa por hora" : "Costo unitario"}
            onChange={setUnitCost}
            className={inputCls}
          />
        </Field>
        {kind === "material" && (
          <Field label="Proveedor">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            void onAdd({
              kind,
              name,
              sku: sku.trim(),
              category: defaultCategory(kind),
              unit,
              unitCost,
              supplierId: kind === "material" ? supplierId : undefined,
            })
          }
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          <Check className="size-4" />
          Agregar al catálogo
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  )
}
