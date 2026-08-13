"use client"

import React, { useMemo, useState } from "react"
import { Building2, Check, Pencil, Plus, Trash2, X } from "lucide-react"
import {
  DEPARTMENT_COLOR_OPTIONS,
  departmentColor,
  quotationHasDepartment,
  type DepartmentColorId,
  type DepartmentConfig,
} from "@/lib/technik/data"
import { useTechnik } from "@/lib/technik/store"
import { Field, inputCls, PageHeader, SearchField } from "../ui"

type Draft = {
  label: string
  short: string
  colorId: DepartmentColorId
}

const emptyDraft = (): Draft => ({
  label: "",
  short: "",
  colorId: "azul",
})

export function DepartmentsView() {
  const {
    departments,
    users,
    quotations,
    addDepartment,
    updateDepartment,
    removeDepartment,
  } = useTechnik()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft())
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return departments
    return departments.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.short.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q),
    )
  }, [departments, query])

  function startEdit(dept: DepartmentConfig) {
    setEditingId(dept.id)
    setEditDraft({ label: dept.label, short: dept.short, colorId: dept.colorId })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(emptyDraft())
  }

  function saveNew() {
    if (!draft.label.trim()) {
      setError("Escribe el nombre del departamento.")
      return
    }
    addDepartment({
      label: draft.label,
      short: draft.short || undefined,
      colorId: draft.colorId,
    })
    setDraft(emptyDraft())
    setAdding(false)
    setError(null)
  }

  function saveEdit() {
    if (!editingId || !editDraft.label.trim()) return
    updateDepartment(editingId, {
      label: editDraft.label.trim(),
      short: editDraft.short.trim() || editDraft.label.trim(),
      colorId: editDraft.colorId,
    })
    cancelEdit()
  }

  function onDelete(id: string) {
    const result = removeDepartment(id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    if (editingId === id) cancelEdit()
  }

  function usage(id: string) {
    const u = users.filter((x) => x.department === id).length
    const q = quotations.filter((x) => quotationHasDepartment(x, id)).length
    return { users: u, quotes: q }
  }

  return (
    <div>
      <PageHeader
        title="Departamentos"
        subtitle="Crea, edita y colorea los departamentos de trabajo. Se usan en cotizaciones y al asignar usuarios."
      >
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v)
            setError(null)
          }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nuevo departamento
        </button>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {adding && (
        <div className="rounded-2xl surface-elevated p-5 mb-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-foreground">Nuevo departamento</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nombre">
              <input
                className={inputCls}
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Ej. Maquinados"
              />
            </Field>
            <Field label="Etiqueta corta (opcional)">
              <input
                className={inputCls}
                value={draft.short}
                onChange={(e) => setDraft({ ...draft, short: e.target.value })}
                placeholder="Ej. Maq."
              />
            </Field>
          </div>
          <ColorPicker
            value={draft.colorId}
            onChange={(colorId) => setDraft({ ...draft, colorId })}
            previewLabel={draft.short || draft.label || "Vista previa"}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveNew}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <Check className="size-4" />
              Crear
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setDraft(emptyDraft())
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Buscar departamento…"
        className="max-w-lg mb-6"
      />

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Ningún departamento coincide con la búsqueda.
          </p>
        ) : (
          filtered.map((dept) => {
          const stats = usage(dept.id)
          const isEditing = editingId === dept.id
          const color = departmentColor(dept.colorId)

          if (isEditing) {
            return (
              <div key={dept.id} className="rounded-2xl surface-elevated p-5 flex flex-col gap-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Nombre">
                    <input
                      className={inputCls}
                      value={editDraft.label}
                      onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                    />
                  </Field>
                  <Field label="Etiqueta corta">
                    <input
                      className={inputCls}
                      value={editDraft.short}
                      onChange={(e) => setEditDraft({ ...editDraft, short: e.target.value })}
                    />
                  </Field>
                </div>
                <ColorPicker
                  value={editDraft.colorId}
                  onChange={(colorId) => setEditDraft({ ...editDraft, colorId })}
                  previewLabel={editDraft.short || editDraft.label || dept.short}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    <Check className="size-4" />
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    <X className="size-4" />
                    Cancelar
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={dept.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl surface-card p-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-muted shrink-0">
                <Building2 className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-foreground">{dept.label}</p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${color.badgeClass}`}
                  >
                    {dept.short}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.users} usuario{stats.users === 1 ? "" : "s"} · {stats.quotes} cotización
                  {stats.quotes === 1 ? "" : "es"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(dept)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                >
                  <Pencil className="size-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(dept.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          )
        })
        )}
      </div>
    </div>
  )
}

function ColorPicker({
  value,
  onChange,
  previewLabel,
}: {
  value: DepartmentColorId
  onChange: (id: DepartmentColorId) => void
  previewLabel: string
}) {
  const preview = departmentColor(value)
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Color</p>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${preview.badgeClass}`}
        >
          {previewLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {DEPARTMENT_COLOR_OPTIONS.map((opt) => {
          const selected = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => onChange(opt.id)}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className="size-3.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
                style={{ backgroundColor: opt.swatch }}
              />
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
