"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { Search, Truck, Mail, Phone, MessageCircle, Plus, Check, Pencil, Trash2 } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import { CHANNEL_LABEL, type Supplier, type SupplierChannel } from "@/lib/technik/data"
import { Field, inputCls, PageHeader } from "../ui"

const emptyForm = {
  name: "",
  contact: "",
  email: "",
  phone: "",
  whatsapp: "",
  preferredChannel: "email" as SupplierChannel,
  specialty: "",
  location: "",
}

export function SuppliersView() {
  const { suppliers, catalog, addSupplier, updateSupplier, removeSupplier } = useTechnik()
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.specialty.toLowerCase().includes(search.toLowerCase()),
  )

  const linkedItems = (id: string) => catalog.filter((c) => c.supplierId === id).length

  function openCreate() {
    setEditingId(null)
    setConfirmDeleteId(null)
    setError("")
    setForm(emptyForm)
    setAdding((v) => !v)
  }

  function openEdit(s: Supplier) {
    setAdding(false)
    setConfirmDeleteId(null)
    setError("")
    setEditingId(s.id)
    setForm({
      name: s.name,
      contact: s.contact,
      email: s.email,
      phone: s.phone,
      whatsapp: s.whatsapp,
      preferredChannel: s.preferredChannel,
      specialty: s.specialty,
      location: s.location,
    })
  }

  async function submitNew() {
    if (!form.name || !form.email) {
      setError("Empresa y correo son obligatorios.")
      return
    }
    setSaving(true)
    setError("")
    const res = await addSupplier(form)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setAdding(false)
    setForm(emptyForm)
  }

  async function submitEdit() {
    if (!editingId || !form.name || !form.email || saving) return
    setSaving(true)
    setError("")
    const res = await updateSupplier(editingId, form)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditingId(null)
    setForm(emptyForm)
  }

  async function submitDelete(id: string) {
    if (saving) return
    setSaving(true)
    setError("")
    const res = await removeSupplier(id)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setConfirmDeleteId(null)
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Contactos y canal preferido para enviar la lista de materiales."
      >
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nuevo proveedor
        </button>
      </PageHeader>

      {adding && (
        <SupplierForm
          form={form}
          setForm={setForm}
          onSave={submitNew}
          onCancel={() => setAdding(false)}
          saveLabel="Guardar"
          error={error}
        />
      )}

      <div className="flex items-center gap-2.5 max-w-md rounded-xl bg-input/60 border border-border px-3.5 py-2 mb-6">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor o especialidad…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((s) => (
          <div key={s.id} className="rounded-2xl surface-card p-5">
            {editingId === s.id ? (
              <SupplierForm
                form={form}
                setForm={setForm}
                onSave={submitEdit}
                onCancel={() => {
                  setEditingId(null)
                  setError("")
                }}
                saveLabel={saving ? "Guardando…" : "Guardar cambios"}
                error={error}
              />
            ) : (
              <>
                <SupplierCard supplier={s} itemCount={linkedItems(s.id)} />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(confirmDeleteId === s.id ? null : s.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </button>
                </div>
                {confirmDeleteId === s.id && (
                  <div className="mt-3 rounded-xl border border-destructive/20 p-3">
                    <p className="text-xs text-foreground mb-2">
                      ¿Eliminar a <span className="font-semibold">{s.name}</span>? Los ítems de catálogo quedan sin proveedor.
                    </p>
                    {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitDelete(s.id)}
                        className="rounded-xl bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                      >
                        {saving ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SupplierForm({
  form,
  setForm,
  onSave,
  onCancel,
  saveLabel,
  error,
}: {
  form: typeof emptyForm
  setForm: Dispatch<SetStateAction<typeof emptyForm>>
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  error?: string
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Empresa">
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Contacto">
        <input className={inputCls} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      </Field>
      <Field label="Correo">
        <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Teléfono">
        <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="WhatsApp">
        <input className={inputCls} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
      </Field>
      <Field label="Canal preferido">
        <select
          className={inputCls}
          value={form.preferredChannel}
          onChange={(e) => setForm({ ...form, preferredChannel: e.target.value as SupplierChannel })}
        >
          <option value="email">Correo</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </Field>
      <Field label="Especialidad">
        <input className={inputCls} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
      </Field>
      <Field label="Ubicación">
        <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </Field>
      {error ? <p className="sm:col-span-2 text-xs text-destructive">{error}</p> : null}
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Check className="size-4" />
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function SupplierCard({ supplier: s, itemCount }: { supplier: Supplier; itemCount: number }) {
  return (
    <>
      <div className="flex items-start gap-3 mb-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary shrink-0">
          <Truck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.specialty}</p>
        </div>
        <span className="rounded-full bg-primary/12 text-primary text-[10px] font-bold px-2 py-1 shrink-0">
          {CHANNEL_LABEL[s.preferredChannel]}
        </span>
      </div>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mail className="size-3.5" />
          <span className="truncate">{s.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="size-3.5" />
          <span className="font-mono text-xs">{s.phone}</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="size-3.5" />
          <span className="font-mono text-xs">{s.whatsapp}</span>
        </div>
      </div>
      <div className="mt-4 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{s.location}</span>
        <span className="font-semibold text-foreground">{itemCount} ítems en catálogo</span>
      </div>
    </>
  )
}
