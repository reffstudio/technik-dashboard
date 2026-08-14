"use client"

import React, { useState } from "react"
import { Search, Mail, Phone, MapPin, Building2, FileText, Hash, Plus, Check, Pencil, Trash2 } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import type { Client } from "@/lib/technik/data"
import { Field, inputCls, PageHeader } from "../ui"
import type { View } from "../app-shell"

const emptyForm = {
  company: "",
  rfc: "",
  contact: "",
  email: "",
  phone: "",
  industry: "",
  location: "",
}

export function ClientsView({ navigate }: { navigate?: (v: View) => void }) {
  const { clients, quotations, addClient, updateClient, removeClient, user } = useTechnik()
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const filtered = clients.filter(
    (c) =>
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase()) ||
      (c.rfc ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()),
  )

  const quoteCount = (id: string) => quotations.filter((q) => q.clientId === id).length

  function openCreate() {
    setEditingId(null)
    setConfirmDeleteId(null)
    setError("")
    setForm(emptyForm)
    setAdding((v) => !v)
  }

  function openEdit(c: Client) {
    setAdding(false)
    setConfirmDeleteId(null)
    setError("")
    setEditingId(c.id)
    setForm({
      company: c.company,
      rfc: c.rfc ?? "",
      contact: c.contact,
      email: c.email,
      phone: c.phone,
      industry: c.industry,
      location: c.location,
    })
  }

  async function submitNew() {
    if (!form.company || !form.email) {
      setError("Empresa y correo son obligatorios.")
      return
    }
    setSaving(true)
    setError("")
    const res = await addClient({
      ...form,
      rfc: form.rfc.trim().toUpperCase(),
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setAdding(false)
    setForm(emptyForm)
    if (user?.role === "empleado" && navigate) {
      navigate({ name: "builder" })
    }
  }

  async function submitEdit() {
    if (!editingId || !form.company || !form.email || saving) return
    setSaving(true)
    setError("")
    const res = await updateClient(editingId, {
      ...form,
      rfc: form.rfc.trim().toUpperCase(),
    })
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
    const res = await removeClient(id)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setConfirmDeleteId(null)
    setEditingId(null)
    setError("")
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={
          user?.role === "empleado"
            ? "Selecciona o crea el cliente donde estás cotizando."
            : "Cuentas para las que Technik cotiza y envía PDF."
        }
      >
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </PageHeader>

      {adding && (
        <ClientForm
          form={form}
          setForm={setForm}
          onSave={submitNew}
          onCancel={() => setAdding(false)}
          saveLabel="Guardar cliente"
          error={error}
        />
      )}

      <div className="flex items-center gap-2.5 max-w-md rounded-xl bg-input/60 border border-border px-3.5 py-2 mb-6">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa, RFC, contacto o ID…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-2xl surface-card p-5 hover:border-primary/30 transition-colors">
            {editingId === c.id ? (
              <ClientForm
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
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary shrink-0">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c.company}</p>
                      <p className="text-xs text-muted-foreground">{c.industry}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-primary shrink-0">{c.id}</span>
                </div>

                <div className="flex flex-col gap-2.5 text-sm">
                  <InfoRow icon={Hash} value={c.rfc ? `RFC ${c.rfc}` : "RFC —"} mono />
                  <InfoRow icon={FileText} value={c.contact} />
                  <InfoRow icon={Mail} value={c.email} />
                  <InfoRow icon={Phone} value={c.phone} mono />
                  <InfoRow icon={MapPin} value={c.location} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Cliente desde {c.since}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
                    {quoteCount(c.id)} cotización{quoteCount(c.id) === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError("")
                      setConfirmDeleteId(confirmDeleteId === c.id ? null : c.id)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </button>
                </div>
                {confirmDeleteId === c.id && (
                  <div className="mt-3 rounded-xl border border-destructive/20 p-3">
                    <p className="text-xs text-foreground mb-2">
                      ¿Eliminar a <span className="font-semibold">{c.company}</span>? No se puede si ya tiene cotizaciones.
                    </p>
                    {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitDelete(c.id)}
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

function ClientForm({
  form,
  setForm,
  onSave,
  onCancel,
  saveLabel,
  error,
}: {
  form: typeof emptyForm
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  error?: string
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Empresa">
        <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      </Field>
      <Field label="RFC">
        <input
          className={`${inputCls} font-mono uppercase`}
          value={form.rfc}
          onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
          placeholder="XAXX010101000"
          maxLength={13}
        />
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
      <Field label="Industria">
        <input className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
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

function InfoRow({ icon: Icon, value, mono }: { icon: React.ElementType; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span className={`truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}
