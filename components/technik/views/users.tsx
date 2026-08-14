"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Plus, Check, ShieldCheck, HardHat, Pencil, X, Trash2, Hourglass } from "lucide-react"
import { formatUsername, isValidUsername, sanitizeUsername, uniqueUsername, usernameFromName } from "@/lib/technik/codes"
import { type Role, type User } from "@/lib/technik/data"
import { roleLabel, useTechnik } from "@/lib/technik/store"
import { DepartmentBadge, Field, inputCls, PageHeader, SearchField, UserAvatar } from "../ui"

function rowKey(u: User) {
  return u.authId || u.id
}

export function UsersView() {
  const { users, departments, user: current, inviteUser, updateUser, upsertUser, deleteUser } = useTechnik()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [emailed, setEmailed] = useState(false)
  const [mailError, setMailError] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    role: "empleado" as Role,
    department: "",
    location: "",
    active: true,
  })

  useEffect(() => {
    const first = departments[0]?.id ?? ""
    if (!first) return
    setForm((f) => {
      if (f.department && departments.some((d) => d.id === f.department)) return f
      return { ...f, department: first }
    })
  }, [departments])

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

  function openCreate() {
    setEditingId(null)
    setConfirmDeleteId(null)
    setError("")
    setInviteLink("")
    setEmailed(false)
    setMailError("")
    setForm({
      name: "",
      username: "",
      email: "",
      role: "empleado",
      department: departments[0]?.id ?? "",
      location: "",
      active: true,
    })
    setAdding(true)
  }

  function openEdit(u: User) {
    setAdding(false)
    setConfirmDeleteId(null)
    setError("")
    setInviteLink("")
    setEditingId(rowKey(u))
    setForm({
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      department: u.department || departments[0]?.id || "",
      location: u.location,
      active: u.active,
    })
  }

  async function submitInvite() {
    const name = form.name.trim()
    const email = form.email.trim()
    const department = form.department.trim() || departments[0]?.id || ""
    const username = uniqueUsername(form.username || usernameFromName(name), users.map((u) => u.username))
    if (!name || !email) {
      setError("Nombre y correo son obligatorios.")
      return
    }
    if (!department) {
      setError("Crea un departamento antes de invitar.")
      return
    }
    if (!isValidUsername(username)) {
      setError("El username debe tener 2–32 caracteres (a-z, 0-9 o _).")
      return
    }
    setBusy(true)
    setError("")
    setInviteLink("")
    setEmailed(false)
    setMailError("")
    try {
      const res = await inviteUser({
        name,
        email,
        username,
        role: form.role,
        department,
        location: form.location.trim(),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (res.inviteLink) {
        setInviteLink(res.inviteLink)
        setEmailed(!!res.emailed)
        setMailError(res.mailError ?? "")
        return
      }
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit() {
    const target = users.find((u) => rowKey(u) === editingId)
    if (!target) {
      setError("No se encontró el usuario.")
      return
    }
    const name = form.name.trim() || target.name
    const username = sanitizeUsername(form.username) || target.username
    const department = form.department.trim() || target.department
    if (!name) {
      setError("El nombre es obligatorio.")
      return
    }
    if (!isValidUsername(username)) {
      setError("El username debe tener 2–32 caracteres (a-z, 0-9 o _).")
      return
    }
    setBusy(true)
    setError("")
    try {
      if (target.authId) {
        const res = await updateUser(target.authId, {
          name,
          username,
          department,
          location: form.location.trim(),
          active: form.active,
        })
        if (!res.ok) {
          setError(res.error)
          return
        }
      } else {
        upsertUser({
          ...target,
          name,
          username,
          id: username || target.id,
          department,
          location: form.location.trim(),
          active: form.active,
        })
      }
      setEditingId(null)
    } finally {
      setBusy(false)
    }
  }

  async function submitDelete(authId: string) {
    setBusy(true)
    setError("")
    try {
      const res = await deleteUser(authId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setConfirmDeleteId(null)
      setEditingId(null)
    } finally {
      setBusy(false)
    }
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
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Invitar colaborador
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
                onChange={(e) => setForm({ ...form, username: sanitizeUsername(e.target.value) })}
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
          {error && adding && (
            <p className="sm:col-span-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {inviteLink && (
            <div className="sm:col-span-2 rounded-xl border border-primary/25 bg-primary/[0.06] p-3 text-xs">
              <p className="font-semibold text-foreground mb-1">
                {emailed
                  ? "Supabase envió el correo. Si no está en Gmail, revisa spam; el plan gratis deja pasar muy pocos por hora. El enlace de abajo también sirve:"
                  : "Supabase no mandó el correo. Copia el enlace y envíaselo por WhatsApp o mail:"}
              </p>
              {!emailed && mailError && (
                <p className="text-destructive mb-2">
                  {/rate/i.test(mailError)
                    ? "Supabase limitó el envío. Espera unos minutos o usa el enlace."
                    : mailError}
                </p>
              )}
              <p className="font-mono break-all text-muted-foreground">{inviteLink}</p>
              <button
                type="button"
                className="mt-2 text-primary font-semibold hover:underline"
                onClick={() => void navigator.clipboard.writeText(inviteLink)}
              >
                Copiar enlace
              </button>
            </div>
          )}
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            El colaborador debe abrir el enlace, crear su contraseña y recién ahí entra al dashboard.
            En Supabase → Authentication → URL configuration, Redirect URLs debe incluir
            http://localhost:3000/** y https://dashboard.solutionstechnik.com/**.
          </p>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="button"
              onClick={() => void submitInvite()}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              <Check className="size-4" />
              {busy ? "Enviando…" : "Enviar invitación"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
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
        placeholder="Buscar nombre, usuario, correo o departamento…"
        className="max-w-lg mb-6"
      />

      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Ningún usuario coincide con la búsqueda.
          </p>
        ) : (
          filtered.map((u) => {
            const key = rowKey(u)
            const editing = editingId === key
            return (
              <div key={key} className="rounded-2xl surface-card p-4">
                <div className="flex items-center gap-4">
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
                      {u.authId === current?.authId && (
                        <span className="text-[10px] font-semibold text-muted-foreground">Tú</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email} · {deptLabel(u.department)} · {u.location}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-right text-[11px] font-semibold ${
                      u.invitePending
                        ? "text-chart-3"
                        : u.active
                          ? "text-fin-gain"
                          : "text-muted-foreground"
                    }`}
                  >
                    {u.invitePending ? (
                      <span className="inline-flex items-center gap-1">
                        <Hourglass className="size-3" />
                        Invitado
                      </span>
                    ) : u.active ? (
                      "Activo"
                    ) : (
                      "Inactivo"
                    )}
                    {u.invitePending && (
                      <span className="block text-[10px] font-medium text-muted-foreground">
                        Esperando confirmación
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => (editing ? setEditingId(null) : openEdit(u))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40"
                  >
                    {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
                    {editing ? "Cerrar" : "Editar"}
                  </button>
                  {current?.role === "admin" && u.authId && u.authId !== current.authId && (
                    <button
                      type="button"
                      onClick={() => {
                        setError("")
                        setConfirmDeleteId(confirmDeleteId === u.authId ? null : u.authId ?? null)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
                    </button>
                  )}
                </div>

                {editing && (
                  <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                    <Field label="Nombre">
                      <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </Field>
                    <Field label="Username">
                      <div className="flex items-center gap-0 rounded-xl bg-input/60 border border-border focus-within:border-primary/60">
                        <span className="pl-3 text-sm text-muted-foreground font-mono">@</span>
                        <input
                          className="w-full bg-transparent px-1 py-2 text-sm font-mono text-foreground outline-none"
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: sanitizeUsername(e.target.value) })}
                        />
                      </div>
                    </Field>
                    <Field label="Departamento">
                      <select
                        className={inputCls}
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Ubicación">
                      <input
                        className={inputCls}
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </Field>
                    {u.invitePending ? (
                      <p className="sm:col-span-2 text-xs text-muted-foreground">
                        Esta cuenta se marcará como activa cuando la persona cree su contraseña.
                      </p>
                    ) : (
                      <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        />
                        Cuenta activa
                      </label>
                    )}
                    {error && (
                      <p className="sm:col-span-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}
                    <div className="sm:col-span-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submitEdit()}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                      >
                        <Check className="size-4" />
                        {busy ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {confirmDeleteId && confirmDeleteId === u.authId && (
                  <div className="mt-4 pt-4 border-t border-destructive/20">
                    <p className="text-sm text-foreground mb-3">
                      ¿Eliminar definitivamente a <span className="font-semibold">{u.name}</span>? Se borra su cuenta y
                      no podrá entrar. Las cotizaciones o proyectos que haya creado quedan a tu nombre.
                    </p>
                    {error && (
                      <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-3">
                        {error}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submitDelete(u.authId!)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                        {busy ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
