"use client"

import { useRef, useState, type ElementType } from "react"
import {
  ShieldCheck,
  Bell,
  Moon,
  FileText,
  Building2,
  Truck,
  UserCog,
  Boxes,
  HardHat,
  Camera,
  Trash2,
  Check,
  Wallet,
} from "lucide-react"
import { useTheme } from "next-themes"
import { formatUsername, sanitizeUsername } from "@/lib/technik/codes"
import {
  DEFAULT_LABOR_HOURLY_RATE,
  LABOR_BURDEN_RATE,
  MATERIAL_PUBLIC_MARKUP,
  INTERNAL_PROFIT_RATE,
  ANNUAL_BONUS_RATE,
  formatPercentLabel,
} from "@/lib/technik/company"
import { roleLabel, useTechnik } from "@/lib/technik/store"
import { Field, inputCls, PageHeader, UserAvatar } from "../ui"
import type { View } from "../app-shell"

export function SettingsView({ navigate }: { navigate?: (v: View) => void }) {
  const { user, logout, updateProfile, uploadProfilePhoto, removeProfilePhoto, departments, settings, updateSettings } =
    useTechnik()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = (resolvedTheme ?? theme ?? "dark") === "dark"
  const [name, setName] = useState(user?.name ?? "")
  const [username, setUsername] = useState(user?.username ?? "")
  const [department, setDepartment] = useState(user?.department ?? "")
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const isAdmin = user?.role === "admin"

  if (!user) return null

  async function onPickPhoto(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return
    setBusy(true)
    setError("")
    const res = await uploadProfilePhoto(file)
    setBusy(false)
    if (!res.ok) setError(res.error)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function saveProfile() {
    setBusy(true)
    setError("")
    const res = await updateProfile({
      name: name.trim() || user!.name,
      department: department.trim() || user!.department,
      ...(isAdmin ? { username: sanitizeUsername(username) } : {}),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader title="Editar perfil" subtitle="Actualiza tus datos, foto y preferencias de la cuenta." />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl surface-card p-5 lg:p-6">
            <h2 className="text-sm font-bold text-foreground font-display mb-5">Perfil</h2>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
              <div className="relative w-fit">
                <UserAvatar user={user} size="lg" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  aria-label="Cambiar foto de perfil"
                >
                  <Camera className="size-3.5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onPickPhoto(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground truncate">{user.name}</p>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-primary/12 text-primary">
                    {user.role === "admin" ? <ShieldCheck className="size-3.5" /> : <HardHat className="size-3.5" />}
                    {roleLabel(user.role)}
                  </span>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Subir foto
                  </button>
                  {user.avatarUrl && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true)
                        setError("")
                        void removeProfilePhoto().then((res) => {
                          setBusy(false)
                          if (!res.ok) setError(res.error)
                        })
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="size-3" />
                      Quitar foto
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">JPG o PNG, máximo recomendado 2&nbsp;MB.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 border-t border-border pt-5">
              <Field label="Nombre">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Username">
                {isAdmin ? (
                  <div className="flex items-center gap-0 rounded-xl bg-input/60 border border-border focus-within:border-primary/60">
                    <span className="pl-3 text-sm text-muted-foreground font-mono">@</span>
                    <input
                      className="w-full bg-transparent px-1 py-2 text-sm font-mono text-foreground outline-none"
                      value={username}
                      onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                    />
                  </div>
                ) : (
                  <input className={inputCls} value={formatUsername(user.username)} disabled />
                )}
              </Field>
              <Field label="Departamento">
                <select
                  className={inputCls}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2 flex flex-col gap-2 mt-1">
                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveProfile()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    {busy ? "Guardando…" : "Guardar cambios"}
                  </button>
                  {saved && <span className="text-xs font-semibold text-fin-gain">Perfil actualizado</span>}
                </div>
              </div>
            </div>
          </div>

          {isAdmin && navigate && (
            <div className="md:hidden rounded-2xl surface-card p-5">
              <h2 className="text-sm font-bold font-display mb-4">Administración</h2>
              <div className="grid grid-cols-2 gap-2">
                <Shortcut icon={Wallet} label="Finanzas" onClick={() => navigate({ name: "finanzas", section: "facturacion" })} />
                <Shortcut icon={FileText} label="Cotizaciones" onClick={() => navigate({ name: "quotations" })} />
                <Shortcut icon={Truck} label="Proveedores" onClick={() => navigate({ name: "suppliers" })} />
                <Shortcut icon={Boxes} label="Catálogo" onClick={() => navigate({ name: "catalog" })} />
                <Shortcut icon={Building2} label="Departamentos" onClick={() => navigate({ name: "departments" })} />
                <Shortcut icon={UserCog} label="Usuarios" onClick={() => navigate({ name: "users" })} />
              </div>
            </div>
          )}

          <div className="rounded-2xl surface-card p-5 lg:p-6">
            <h2 className="text-sm font-bold text-foreground font-display mb-5">Preferencias</h2>
            <div className="flex flex-col divide-y divide-border">
              <Toggle
                icon={Bell}
                title="Badge de notificaciones"
                desc="Mostrar contador de alertas operativas en el header"
                on={settings.showNotificationBadge}
                onToggle={() =>
                  updateSettings({ showNotificationBadge: !settings.showNotificationBadge })
                }
              />
              <Toggle
                icon={Moon}
                title="Modo oscuro"
                desc="Oscuro por defecto. Desactívalo para modo claro."
                on={isDark}
                onToggle={() => setTheme(isDark ? "light" : "dark")}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-2xl surface-card p-5 lg:p-6">
              <h2 className="text-sm font-bold text-foreground font-display mb-1">
                Fórmula de precios (v1)
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Economía interna y sugeridos al cliente. Editables en catálogo donde aplique.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl bg-muted/70 border border-border p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Markup material → público
                  </p>
                  <p className="text-xl font-mono font-bold text-primary">
                    {formatPercentLabel(MATERIAL_PUBLIC_MARKUP)}%
                  </p>
                </div>
                <div className="rounded-xl bg-muted/70 border border-border p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    IMSS/INFONAVIT (interno)
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground">
                    {formatPercentLabel(LABOR_BURDEN_RATE)}%
                  </p>
                </div>
                <div className="rounded-xl bg-muted/70 border border-border p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Ganancia (MO base + mat. +10%)
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground">
                    {formatPercentLabel(INTERNAL_PROFIT_RATE)}%
                  </p>
                </div>
                <div className="rounded-xl bg-muted/70 border border-border p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Bono anual
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground">
                    {formatPercentLabel(ANNUAL_BONUS_RATE)}%
                  </p>
                </div>
                <div className="rounded-xl bg-muted/70 border border-border p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Tarifa MO default
                  </p>
                  <p className="text-xl font-mono font-bold text-foreground">
                    ${DEFAULT_LABOR_HOURLY_RATE}/h
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className="md:hidden rounded-xl border border-destructive/30 text-destructive py-3 text-sm font-semibold"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="rounded-2xl surface-elevated p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Building2 className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground font-display">Organización</h2>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <Info label="Empresa" value="Technik Solutions" />
            <Info label="Tipo" value="Cotizaciones y operaciones" />
            <Info label="ID fiscal" value="TKS-ORG-001" mono />
            <div className="border-t border-border my-1" />
            <div className="flex items-center gap-2 rounded-xl bg-primary/[0.06] border border-primary/15 p-3 text-xs text-muted-foreground">
              <FileText className="size-4 text-primary shrink-0" />
              Los colaboradores no ven costos. Solo administración aprueba y despacha PDFs.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Shortcut({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-xs font-semibold hover:border-primary/40"
    >
      <Icon className="size-5 text-primary" />
      {label}
    </button>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-foreground font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  )
}

function Toggle({
  icon: Icon,
  title,
  desc,
  on,
  onToggle,
}: {
  icon: ElementType
  title: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-muted"}`}
        role="switch"
        aria-checked={on}
        aria-label={title}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-background transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}
