"use client"

import React, { useState } from "react"
import { Search, Truck, Mail, Phone, MessageCircle, Plus, Check } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import { CHANNEL_LABEL, type Supplier, type SupplierChannel } from "@/lib/technik/data"
import { Field, inputCls, PageHeader } from "../ui"

export function SuppliersView() {
  const { suppliers, catalog, addSupplier } = useTechnik()
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: "",
    contact: "",
    email: "",
    phone: "",
    whatsapp: "",
    preferredChannel: "email" as SupplierChannel,
    specialty: "",
    location: "",
  })

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.specialty.toLowerCase().includes(search.toLowerCase()),
  )

  const linkedItems = (id: string) => catalog.filter((c) => c.supplierId === id).length

  function submit() {
    if (!form.name || !form.email) return
    addSupplier(form)
    setAdding(false)
    setForm({
      name: "",
      contact: "",
      email: "",
      phone: "",
      whatsapp: "",
      preferredChannel: "email",
      specialty: "",
      location: "",
    })
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Contactos y canal preferido para enviar la lista de materiales."
      >
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nuevo proveedor
        </button>
      </PageHeader>

      {adding && (
        <div className="rounded-2xl surface-elevated p-5 mb-6 grid sm:grid-cols-2 gap-3">
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
          <div className="sm:col-span-2 flex gap-2">
            <button onClick={submit} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              <Check className="size-4" />
              Guardar
            </button>
            <button onClick={() => setAdding(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
              Cancelar
            </button>
          </div>
        </div>
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
          <SupplierCard key={s.id} supplier={s} itemCount={linkedItems(s.id)} />
        ))}
      </div>
    </div>
  )
}

function SupplierCard({ supplier: s, itemCount }: { supplier: Supplier; itemCount: number }) {
  return (
    <div className="rounded-2xl surface-card p-5">
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
    </div>
  )
}
