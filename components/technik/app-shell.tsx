"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  FileText,
  Users,
  Boxes,
  LogOut,
  Truck,
  UserCog,
  ClipboardList,
  ChevronDown,
  Pencil,
  BadgeCheck,
  Moon,
  Sun,
  Building2,
  LayoutDashboard,
  ChevronUp,
  FolderKanban,
  Wallet,
  Bell,
} from "lucide-react"
import { useTheme } from "next-themes"
import { formatUsername } from "@/lib/technik/codes"
import { roleLabel, useTechnik } from "@/lib/technik/store"
import { buildAppNotifications, loadSeenNotificationIds, persistSeenNotificationIds } from "@/lib/technik/notifications"
import { BrandLogo } from "./brand-logo"
import { SaveStatusChip } from "./save-status-chip"
import { UserAvatar } from "./ui"

import { DashboardHome } from "./views/dashboard-home"
import { AdminHome } from "./views/admin-home"
import { EmployeeHome } from "./views/employee-home"
import { QuotationReview } from "./views/quotation-review"
import { QuoteBuilder } from "./views/quote-builder"
import { ClientsView } from "./views/clients"
import { CatalogView } from "./views/catalog"
import { SuppliersView } from "./views/suppliers"
import { UsersView } from "./views/users"
import { DepartmentsView } from "./views/departments"
import { SettingsView } from "./views/settings"
import { ProjectsHome } from "./views/projects-home"
import { ProjectDetail } from "./views/project-detail"
import { FinancesHome, type FinancesSection } from "./views/finances-home"

export type View =
  | { name: "home" }
  | { name: "finanzas"; section?: FinancesSection }
  /** @deprecated Prefer `finanzas` */
  | { name: "billing" }
  | { name: "projects" }
  | { name: "project"; id: string }
  | { name: "quotations" }
  | { name: "review"; id: string }
  | { name: "builder"; id?: string }
  | { name: "clients" }
  | { name: "catalog" }
  | { name: "suppliers" }
  | { name: "users" }
  | { name: "departments" }
  | { name: "settings" }

type NavItem = {
  id: string
  label: string
  icon: React.ElementType
  view: View
}

const EASE = [0.16, 1, 0.3, 1] as const

export function AppShell() {
  const {
    user,
    quotations,
    inboxEvents,
    settings,
    liveNotice,
    dismissLiveNotice,
  } = useTechnik()
  const isAdmin = user?.role === "admin"
  const [view, setView] = useState<View>({ name: "home" })
  const [moreOpen, setMoreOpen] = useState<"desktop" | "mobile" | null>(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [seenNotifIds, setSeenNotifIds] = useState<Set<string>>(() => new Set())
  const moreDesktopRef = useRef<HTMLDivElement>(null)
  const moreMobileRef = useRef<HTMLDivElement>(null)
  const inboxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSeenNotifIds(loadSeenNotificationIds(user?.id))
  }, [user?.id])

  const notifications = useMemo(
    () => (isAdmin ? buildAppNotifications({ inboxEvents }) : []),
    [isAdmin, inboxEvents],
  )
  const actionableCount = notifications.filter((n) => !seenNotifIds.has(n.id)).length

  function markNotificationSeen(id: string) {
    setSeenNotifIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      persistSeenNotificationIds(user?.id, next)
      return next
    })
  }

  function markAllNotificationsSeen() {
    setSeenNotifIds((prev) => {
      const next = new Set(prev)
      for (const n of notifications) next.add(n.id)
      persistSeenNotificationIds(user?.id, next)
      return next
    })
  }

  const navigate = (v: View) => {
    setView(v)
    setMoreOpen(null)
  }

  const pendingCount = quotations.filter((q) => q.status === "pending_review").length

  /** Primarios en la barra. */
  const adminPrimary: NavItem[] = [
    { id: "home", label: "Resumen", icon: LayoutDashboard, view: { name: "home" } },
    { id: "projects", label: "Proyectos", icon: FolderKanban, view: { name: "projects" } },
    { id: "finanzas", label: "Finanzas", icon: Wallet, view: { name: "finanzas", section: "facturacion" } },
    { id: "quotations", label: "Cotizaciones", icon: FileText, view: { name: "quotations" } },
  ]

  /** Overflow → menú flotante "Más". */
  const adminMoreDesktop: NavItem[] = [
    { id: "catalog", label: "Catálogo", icon: Boxes, view: { name: "catalog" } },
    { id: "clients", label: "Clientes", icon: Users, view: { name: "clients" } },
    { id: "suppliers", label: "Proveedores", icon: Truck, view: { name: "suppliers" } },
    { id: "users", label: "Usuarios", icon: UserCog, view: { name: "users" } },
    { id: "departments", label: "Departamentos", icon: Building2, view: { name: "departments" } },
  ]

  const employeePrimary: NavItem[] = [
    { id: "home", label: "Resumen", icon: LayoutDashboard, view: { name: "home" } },
    { id: "quotations", label: "Mis cotizaciones", icon: ClipboardList, view: { name: "quotations" } },
    { id: "clients", label: "Clientes", icon: Users, view: { name: "clients" } },
  ]

  const employeeMore: NavItem[] = []

  const primaryNav = isAdmin ? adminPrimary : employeePrimary
  const moreDesktop = isAdmin ? adminMoreDesktop : employeeMore
  const moreMobile = isAdmin ? adminMoreDesktop : employeeMore

  const activeNav = (() => {
    if (view.name === "review" || view.name === "builder") return "quotations"
    if (view.name === "project") return "projects"
    if (view.name === "settings") return ""
    if (view.name === "billing" || view.name === "finanzas") return "finanzas"
    return view.name
  })()

  useEffect(() => {
    if (!moreOpen && !inboxOpen) return
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node
      const inDesktop = moreDesktopRef.current?.contains(t)
      const inMobile = moreMobileRef.current?.contains(t)
      if (!inDesktop && !inMobile) setMoreOpen(null)
      if (inboxRef.current && !inboxRef.current.contains(t)) setInboxOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreOpen(null)
        setInboxOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [moreOpen, inboxOpen])

  /** Bottom bar: primarios + Más (solo admin tiene overflow). */
  const bottomItems = primaryNav
  const bottomMoreItems = moreMobile
  const showMobileMore = bottomMoreItems.length > 0
  const bottomCols = showMobileMore ? bottomItems.length + 1 : bottomItems.length

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-5 lg:px-8">
          <div className="flex h-16 items-center gap-3 lg:gap-6">
            <button
              type="button"
              onClick={() => navigate({ name: "home" })}
              className="shrink-0"
              aria-label="Technik Solutions Home"
            >
              <BrandLogo height={26} />
            </button>

            <nav className="hidden sm:flex flex-1 items-center justify-center min-w-0">
              {/* Más va fuera del overflow para que el flotante no se recorte */}
              <div className="flex items-center gap-1 max-w-full min-w-0">
                <div className="flex items-center gap-0.5 sm:gap-1 rounded-full border border-border bg-card/80 p-1 min-w-0 overflow-x-auto scrollbar-none">
                  {primaryNav.map((item) => {
                    const active = activeNav === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.view)}
                        aria-label={item.label}
                        title={item.label}
                        className={`nav-pill inline-flex items-center justify-center gap-1.5 ${
                          active ? "nav-pill-active" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <item.icon className="size-3.5 hidden md:block" />
                        {item.label}
                        {item.id === "quotations" && isAdmin && pendingCount > 0 && (
                          <span
                            className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
                              active
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-chart-3/20 text-chart-3"
                            }`}
                          >
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {moreDesktop.length > 0 && (
                  <div className="shrink-0 rounded-full border border-border bg-card/80 p-1">
                    <MoreMenu
                      open={moreOpen === "desktop"}
                      onToggle={() => setMoreOpen((v) => (v === "desktop" ? null : "desktop"))}
                      items={moreDesktop}
                      activeNav={activeNav}
                      navigate={navigate}
                      containerRef={moreDesktopRef}
                      active={false}
                      align="left"
                      menuPlacement="bottom"
                    />
                  </div>
                )}
              </div>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0 flex-1 sm:flex-none sm:max-w-[min(520px,42vw)] justify-end">
              {isAdmin && (
                <LiveNoticeText notice={liveNotice} onDismiss={dismissLiveNotice} />
              )}
              {isAdmin && (
                <div className="relative shrink-0" ref={inboxRef}>
                  <button
                    type="button"
                    onClick={() => setInboxOpen((v) => !v)}
                    className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                    aria-label="Notificaciones"
                  >
                    <Bell className="size-4" />
                    {settings.showNotificationBadge && (
                      <AnimatePresence>
                        {actionableCount > 0 && (
                          <motion.span
                            key={actionableCount}
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 520, damping: 22 }}
                            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center"
                          >
                            {actionableCount > 9 ? "9+" : actionableCount}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    )}
                  </button>
                  {inboxOpen && (
                    <div className="absolute right-0 top-full mt-2 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-border flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">Notificaciones</p>
                          <p className="text-[11px] text-muted-foreground">
                            {actionableCount === 0
                              ? "Nada nuevo"
                              : `${actionableCount} sin abrir`}
                          </p>
                        </div>
                        {actionableCount > 0 && (
                          <button
                            type="button"
                            onClick={markAllNotificationsSeen}
                            className="text-[11px] font-semibold text-primary shrink-0"
                          >
                            Marcar leídas
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-3.5 py-6 text-sm text-muted-foreground text-center">
                            Sin alertas por ahora
                          </p>
                        ) : (
                          <AnimatePresence initial={false}>
                            {notifications.slice(0, 12).map((n) => {
                              const seen = seenNotifIds.has(n.id)
                              return (
                              <motion.button
                                key={n.id}
                                type="button"
                                layout
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: seen ? 0.55 : 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.22, ease: EASE }}
                                onClick={() => {
                                  markNotificationSeen(n.id)
                                  if (!n.href) {
                                    setInboxOpen(false)
                                    return
                                  }
                                  if (n.href.name === "review" && n.href.id) {
                                    navigate({ name: "review", id: n.href.id })
                                  } else if (n.href.name === "project" && n.href.id) {
                                    navigate({ name: "project", id: n.href.id })
                                  } else if (
                                    n.href.name === "billing" ||
                                    n.href.name === "finanzas"
                                  ) {
                                    navigate({
                                      name: "finanzas",
                                      section:
                                        n.href.name === "finanzas" && n.href.section
                                          ? n.href.section
                                          : "facturacion",
                                    })
                                  } else if (n.href.name === "quotations") {
                                    navigate({ name: "quotations" })
                                  }
                                  setInboxOpen(false)
                                }}
                                className={`w-full text-left px-3.5 py-2.5 border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors ${
                                  !seen && n.kind === "review_queue" ? "bg-primary/5" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-foreground">{n.title}</p>
                                  {!seen && n.kind === "review_queue" && (
                                    <span className="shrink-0 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                                      Nueva
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                  {n.body}
                                </p>
                              </motion.button>
                              )
                            })}
                          </AnimatePresence>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <SaveStatusChip />
              <div className="shrink-0">
                <ProfileMenu navigate={navigate} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 sm:pb-0">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-5 lg:px-8 py-5 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={
                view.name === "finanzas" || view.name === "billing"
                  ? "finanzas"
                  : view.name + (("id" in view && view.id) || "")
              }
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              {renderView(view, navigate, isAdmin)}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl safe-bottom">
        <div
          className="grid gap-1 px-2 py-2"
          style={{ gridTemplateColumns: `repeat(${bottomCols}, minmax(0, 1fr))` }}
        >
          {bottomItems.map((item) => {
            const active = activeNav === item.id
            const shortLabel =
              item.id === "quotations"
                ? "Cotiz."
                : item.id === "projects"
                  ? "Proy."
                  : item.id === "home"
                    ? "Resumen"
                    : item.label
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.view)}
                aria-label={item.label}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors ${
                  active ? "text-primary bg-primary/10" : "text-muted-foreground"
                }`}
              >
                <item.icon className="size-5" />
                {shortLabel}
              </button>
            )
          })}

          {showMobileMore && (
            <MoreMenu
              open={moreOpen === "mobile"}
              onToggle={() => setMoreOpen((v) => (v === "mobile" ? null : "mobile"))}
              items={bottomMoreItems}
              activeNav={activeNav}
              navigate={navigate}
              containerRef={moreMobileRef}
              active={false}
              align="right"
              menuPlacement="top"
              mobile
            />
          )}
        </div>
      </nav>
    </div>
  )
}

function MoreMenu({
  open,
  onToggle,
  items,
  activeNav,
  navigate,
  containerRef,
  active,
  align = "left",
  menuPlacement = "bottom",
  mobile = false,
}: {
  open: boolean
  onToggle: () => void
  items: NavItem[]
  activeNav: string
  navigate: (v: View) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  active: boolean
  align?: "left" | "right"
  /** Hacia dónde abre el panel: abajo (desktop) o arriba (móvil). */
  menuPlacement?: "bottom" | "top"
  mobile?: boolean
}) {
  // Flecha apunta a la dirección del menú cuando está cerrado; se invierte al abrir
  const ChevronIcon =
    menuPlacement === "bottom"
      ? open
        ? ChevronUp
        : ChevronDown
      : open
        ? ChevronDown
        : ChevronUp

  const panelPos =
    menuPlacement === "bottom"
      ? "top-full mt-2"
      : "bottom-full mb-2"

  const enterY = menuPlacement === "bottom" ? 8 : -8

  const trigger = mobile ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-expanded={open}
      aria-haspopup="menu"
      className={`flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors ${
        active || open ? "text-primary bg-primary/10" : "text-muted-foreground"
      }`}
    >
      <ChevronIcon className="size-5" />
      Más
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-expanded={open}
      aria-haspopup="menu"
      className={`nav-pill inline-flex items-center gap-1.5 ${
        active || open ? "nav-pill-active" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      Más
      <ChevronIcon className="size-3.5" />
    </button>
  )

  return (
    <div className="relative z-50" ref={containerRef}>
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: enterY, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: enterY, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            role="menu"
            className={`absolute ${panelPos} w-56 rounded-2xl surface-elevated p-2 shadow-xl z-[60] ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {items.map((item) => {
              const isActive = activeNav === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => navigate(item.view)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function renderView(view: View, navigate: (v: View) => void, isAdmin: boolean) {
  switch (view.name) {
    case "home":
      return <DashboardHome navigate={navigate} />
    case "finanzas":
    case "billing":
      return isAdmin ? (
        <FinancesHome
          section={
            view.name === "finanzas" ? (view.section ?? "facturacion") : "facturacion"
          }
          navigate={navigate}
        />
      ) : (
        <DashboardHome navigate={navigate} />
      )
    case "projects":
      return isAdmin ? <ProjectsHome navigate={navigate} /> : <EmployeeHome navigate={navigate} />
    case "project":
      return isAdmin ? (
        <ProjectDetail id={view.id} navigate={navigate} />
      ) : (
        <EmployeeHome navigate={navigate} />
      )
    case "quotations":
      return isAdmin ? <AdminHome navigate={navigate} /> : <EmployeeHome navigate={navigate} />
    case "review":
      return <QuotationReview id={view.id} navigate={navigate} />
    case "builder":
      return <QuoteBuilder id={view.id} navigate={navigate} />
    case "clients":
      return <ClientsView navigate={navigate} />
    case "catalog":
      return isAdmin ? <CatalogView /> : <EmployeeHome navigate={navigate} />
    case "suppliers":
      return isAdmin ? <SuppliersView /> : <EmployeeHome navigate={navigate} />
    case "users":
      return isAdmin ? <UsersView /> : <EmployeeHome navigate={navigate} />
    case "departments":
      return isAdmin ? <DepartmentsView /> : <EmployeeHome navigate={navigate} />
    case "settings":
      return <SettingsView navigate={navigate} />
  }
}

function LiveNoticeText({
  notice,
  onDismiss,
}: {
  notice: { id: string; text: string } | null
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center justify-end min-w-0 flex-1 h-8">
      <AnimatePresence mode="wait">
        {notice && (
          <motion.button
            key={notice.id}
            type="button"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.22 }}
            onClick={onDismiss}
            title="Cerrar"
            className="truncate text-right text-[11px] sm:text-[12px] text-muted-foreground hover:text-foreground transition-colors max-w-full"
          >
            {notice.text}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProfileMenu({ navigate }: { navigate: (v: View) => void }) {
  const { user, logout, departments } = useTechnik()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const deptLabel =
    departments.find((d) => d.id === user?.department)?.label ?? user?.department ?? ""

  useEffect(() => setMounted(true), [])

  const isDark = (resolvedTheme ?? theme ?? "dark") === "dark"

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-2 sm:pr-2.5 py-1 hover:border-primary/40 transition-colors"
      >
        <UserAvatar user={user} size="sm" className="!rounded-full" />
        <ChevronDown
          className={`size-3.5 text-muted-foreground transition-transform hidden sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="menu"
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl surface-elevated p-3 shadow-xl z-50"
          >
            <div className="flex items-center gap-3 px-2 py-2.5 mb-1">
              <UserAvatar user={user} size="md" className="!rounded-full" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <div className="rounded-xl bg-muted/60 border border-border px-3 py-2.5 mb-2 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Puesto</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                  <BadgeCheck className="size-3 text-primary" />
                  {roleLabel(user.role)} · {deptLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Username</span>
                <span className="font-mono text-xs text-primary">{formatUsername(user.username)}</span>
              </div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate({ name: "settings" })
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="size-4 text-primary" />
              Editar perfil
            </button>

            <div
              role="menuitem"
              className="flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground"
            >
              <span className="text-left">Apariencia</span>
              <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
                <button
                  type="button"
                  aria-label="Modo claro"
                  aria-pressed={mounted && !isDark}
                  onClick={() => setTheme("light")}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                    mounted && !isDark
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Modo oscuro"
                  aria-pressed={!mounted || isDark}
                  onClick={() => setTheme("dark")}
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                    !mounted || isDark
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="my-1.5 border-t border-border" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                logout()
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
