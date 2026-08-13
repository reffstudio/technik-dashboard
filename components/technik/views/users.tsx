"use client"

import React, { useMemo, useState } from "react"
import { UserCog, Plus, Check, ShieldCheck, HardHat } from "lucide-react"
import { formatUsername, uniqueUsername, usernameFromName } from "@/lib/technik/codes"
import { type Role, type User } from "@/lib/technik/data"
import { roleLabel, useTechnik } from "@/lib/technik/store"
import { DepartmentBadge, Field, inputCls, PageHeader, SearchField, UserAvatar } from "../ui"

export function UsersView() {
  const { users, departments, upsertUser } = useTechnik()
  const defaultDept = departments[0]?.id ?? ""
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    role: "empleado" as Role,
    password: "empleado123",
    department: defaultDept,
    location: "",
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const dept = (departments.find((d) => d.id === u.department)?.label ?? u.department).toLowerCase()
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        dept.includes(q) ||
        (u.location ?? "").toLowerCase().includes(q) ||
        roleLabel(u.role).toLowerCase().includes(q)
      )
    })
  }, [users, query, departments])

  function onNameChange(name: string) {
    const suggested = usernameFromName(name)
    setForm((f) => ({
      ...f,
      name,
      username: f.username === "" || f.username === usernameFromName(f.name) ? suggested : f.username,
    }))
  }

  function openForm() {
    setForm({
      name: "",
      username: "",
      email: "",
      role: "empleado",
      password: "empleado123",
      department: departments[0]?.id ?? "",
      location: "",
    })
    setAdding((v) => !v)
  }

  function submit() {
    if (!form.name || !form.email || !form.department) return
    const username = uniqueUsername(form.username || usernameFromName(form.name), users.map((u) => u.username))
    const user: User = {
      id: username,
      username,
      name: form.name,
      email: form.email,
      role: form.role,
      password: form.password,
      department: form.department,
      location: form.location || "—",
      since: new Date().getFullYear().toString(),
      active: true,
    }
    upsertUser(user)
    setAdding(false)
  }

  function deptLabel(id: string) {
    return departments.find((d) => d.id === id)?.label ?? id
  }

  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        subtitle="Administradores ven costos y despachan. Colaboradores arman cotizaciones en campo."
      >
        <button
          onClick={openForm}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Nuevo usuario
        </button>
      </PageHeader>

      {adding && (
        <div className="rounded-2xl surface-elevated p-5 mb-6 grid sm:grid-cols-2 gap-3">
          <Field label="Nombre">
            <input className={inputCls} value={form.name} onChange={(e) => onNameChange(e.target.value)} />
          </Field>
          <Field label="Username (ID)">
            <div className="flex items-center gap-0 rounded-xl bg-input/60 border border-border focus-within:border-primary/60">
              <span className="pl-3 text-sm text-muted-foreground font-mono">@</span>
              <input
                className="w-full bg-transparent px-1 py-2 text-sm font-mono text-foreground outline-none"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                }
                placeholder="iochoa"
              />
            </div>
          </Field>
          <Field label="Correo">
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Rol">
            <select
              className={inputCls}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="empleado">Colaborador</option>
              <option value="admin">Administrador</option>
            </select>
          </Field>
          <Field label="Contraseña temporal">
            <input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Departamento">
            <select
              className={inputCls}
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              {departments.length === 0 ? (
                <option value="">Crea un departamento primero</option>
              ) : (
                departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))
              )}
            </select>
          </Field>
          <Field label="Ubicación / equipo">
            <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 flex gap-2">
            <button
              onClick={submit}
              disabled={!form.department}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <Check className="size-4" />
              Crear usuario
            </button>
            <button onClick={() => setAdding(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Buscar nombre, usuario, correo o departamento…"
        className="max-w-lg mb-6"
      />

      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Ningún usuario coincide con la búsqueda.
          </p>
        ) : (
          filtered.map((u) => (
          <div key={u.id} className="flex items-center gap-4 rounded-2xl surface-card p-4">
            <UserAvatar user={u} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold">{u.name}</p>
                <span className="font-mono text-[11px] text-primary">{formatUsername(u.username)}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    u.role === "admin" ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.role === "admin" ? <ShieldCheck className="size-3" /> : <HardHat className="size-3" />}
                  {roleLabel(u.role)}
                </span>
                <DepartmentBadge department={u.department} />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {u.email} · {deptLabel(u.department)} · {u.location}
              </p>
            </div>
            <span className={`text-[11px] font-semibold ${u.active ? "text-fin-gain" : "text-muted-foreground"}`}>
              {u.active ? "Activo" : "Inactivo"}
            </span>
            <UserCog className="size-4 text-muted-foreground hidden sm:block" />
          </div>
          ))
        )}
      </div>
    </div>
  )
}
