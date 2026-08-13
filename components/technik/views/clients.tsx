"use client"

import React, { useState } from "react"
import { Search, Mail, Phone, MapPin, Building2, FileText, Hash, Plus, Check } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import { Field, inputCls, PageHeader } from "../ui"
import type { View } from "../app-shell"

export function ClientsView({ navigate }: { navigate?: (v: View) => void }) {
  const { clients, quotations, addClient, user } = useTechnik()
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    company: "",
    rfc: "",
    contact: "",
    email: "",
    phone: "",
    industry: "",
    location: "",
  })

  const filtered = clients.filter(
    (c) =>
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase()) ||
      (c.rfc ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()),
  )

  const quoteCount = (id: string) => quotations.filter((q) => q.clientId === id).length

  function submit() {
    if (!form.company || !form.email) return
    const id = addClient({
      ...form,
      rfc: form.rfc.trim().toUpperCase(),
    })
    setAdding(false)
    setForm({
      company: "",
      rfc: "",
      contact: "",
      email: "",
      phone: "",
      industry: "",
      location: "",
    })
    if (user?.role === "empleado" && navigate) {
      navigate({ name: "builder" })
      // client is available in store for next builder open; builder has its own create flow
      void id
    }
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
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </PageHeader>

      {adding && (
        <div className="rounded-2xl surface-elevated p-5 mb-6 grid sm:grid-cols-2 gap-3">
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
          <div className="sm:col-span-2 flex gap-2">
            <button
              onClick={submit}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <Check className="size-4" />
              Guardar cliente
            </button>
            <button onClick={() => setAdding(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
              Cancelar
            </button>
          </div>
        </div>
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

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Cliente desde {c.since}</span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {quoteCount(c.id)} cotización{quoteCount(c.id) === 1 ? "" : "es"}
              </span>
            </div>
          </div>
        ))}
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
