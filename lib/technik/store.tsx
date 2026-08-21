"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react"
import {
  departmentIdFromLabel,
  nextClientCode,
  nextCatalogCode,
  nextProjectCode,
  nextQuotationCode,
  nextVendorCode,
  catalogRpcKind,
} from "./codes"
import {
  PROJECT_STAGE_META,
  defaultPaymentComplement,
  normalizeDepartmentColorId,
  normalizeProject,
  normalizeTreasurySeparado,
  isManualReserve,
  normalizeApartadoMovement,
  quotationDepartments,
  quotationHasDepartment,
  quotationIsTrashed,
  quotationTrashExpired,
  shortDepartmentLabel,
  suggestedPrice,
  type Client,
  type CatalogItem,
  type ClientResponse,
  type DepartmentColorId,
  type DepartmentConfig,
  type ExpenseEntry,
  type ApartadoMovement,
  type ApartadoMovementKind,
  type PaymentEvent,
  type PaymentMethod,
  type PaymentMode,
  type Project,
  type ProjectInstallment,
  type ProjectStage,
  type Quotation,
  type WorkDepartment,
  type QuoteLine,
  type QuoteStatus,
  type PublicQuoteItem,
  type VisitPhoto,
  type Supplier,
  type TreasuryMonth,
  type TreasurySeparado,
  type User,
  type Role,
  lineTotalMxn,
  roundMxn,
  CLIENT_RESPONSE_META,
  internalEconomy,
} from "./data"
import {
  DEFAULT_ISR_RETENTION_RATE,
  DEFAULT_QUOTE_TERMS,
  DEFAULT_TAX_RATE,
  LABOR_BURDEN_RATE,
} from "./company"
import { compressVisitImage } from "./compress-image"
import {
  deleteAllVisitPhotosRequest,
  deleteVisitPhotoRequest,
  postVisitPhoto,
  VISIT_PHOTO_MAX,
} from "./visit-photos"
import {
  createOriginId,
  formatMoneyShort,
  liveNoticeVisibleToRole,
  adoptQuotations,
  adoptProjects,
  adoptById,
  adoptByKey,
  loadWorkspace,
  type LiveNotice,
  type LiveNoticeAudience,
  type WorkspaceSettings,
  type WorkspaceSnapshot,
} from "./live"
import type { InboxEvent } from "./notifications"
import { fetchRemoteWorkspace, pushRemoteWorkspace } from "./remote-workspace"
import {
  establishAuthSessionFromUrl,
  getSupabaseBrowser,
  isSupabaseConfigured,
  setSupabasePublicConfig,
} from "@/lib/supabase/browser"
import { PROFILE_COLUMNS, PROFILE_COLUMNS_LEGACY, dedupeUsers, userFromProfile, type ProfileRow } from "./auth-profile"
import {
  capturePasswordSetupHintFromLocation,
  clearPasswordSetupHint,
  userMustSetPassword,
} from "./password-setup"
import {
  clearAvatar,
  loadProfiles,
  persistAvatar,
  persistProfile,
  type ProfilePatch,
} from "./profile-persist"
import {
  deleteDepartment,
  deleteClient,
  deleteSupplier,
  deleteCatalogItem,
  loadCoreWorkspace,
  nextServerCode,
  persistCatalogItem,
  persistClient,
  persistDepartment,
  persistSupplier,
} from "./core-persist"
import {
  deleteQuotationRow,
  enqueuePersistQuotation,
  loadQuotations,
  quotesSignature,
  readOpsBackup,
  writeOpsBackup,
} from "./quotation-persist"
import {
  deleteApartadoMovementRow,
  deleteExpenseRow,
  deleteSeparadoRow,
  enqueuePersistProject,
  loadOpsWorkspace,
  persistApartadoMovement,
  persistExpense,
  persistInboxEvent,
  persistPaymentEvent,
  persistSeparado,
  persistTreasuryMonth,
} from "./ops-persist"
import {
  persistFailedOffline,
  runWithRetries,
  type PersistResult,
  type SaveStatus,
} from "./save-queue"

interface TechnikState {
  authed: boolean
  user: User | null
  users: User[]
  clients: Client[]
  suppliers: Supplier[]
  catalog: CatalogItem[]
  quotations: Quotation[]
  projects: Project[]
  departments: DepartmentConfig[]
  paymentEvents: PaymentEvent[]
  inboxEvents: InboxEvent[]
  expenses: ExpenseEntry[]
  treasuryMonths: TreasuryMonth[]
  treasurySeparados: TreasurySeparado[]
  apartadoMovements: ApartadoMovement[]
  settings: WorkspaceSettings
  /** Última notificación en vivo (texto minimalista en header). */
  liveNotice: LiveNotice | null
  dismissLiveNotice: () => void
  /** Hub de avisos en vivo (no es fuente de datos). */
  syncStatus: "connecting" | "live" | "offline"
  saveStatus: SaveStatus
  saveError?: string
  markSaving: () => void
  retrySave: () => void
  updateSettings: (patch: Partial<WorkspaceSettings>) => void
  /** false mientras se restaura la sesión de Supabase */
  authReady: boolean
  /** true si el enlace de invitación/recuperación exige crear contraseña */
  mustSetPassword: boolean
  // auth
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>
  completePasswordSetup: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  refreshUsers: () => Promise<void>
  // users
  inviteUser: (input: {
    name: string
    email: string
    username: string
    role: Role
    department: string
  }) => Promise<
    { ok: true; emailed?: boolean; inviteLink?: string; mailError?: string } | { ok: false; error: string }
  >
  deleteUser: (authId: string) => Promise<{ ok: true } | { ok: false; error: string }>
  upsertUser: (user: User) => void
  updateProfile: (
    patch: ProfilePatch,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  updateUser: (
    authId: string,
    patch: ProfilePatch,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  uploadProfilePhoto: (
    file: File,
    authId?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  removeProfilePhoto: (
    authId?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  // clients
  addClient: (
    client: Omit<Client, "id" | "since">,
  ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
  updateClient: (id: string, patch: Partial<Client>) => Promise<{ ok: true } | { ok: false; error: string }>
  removeClient: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  // suppliers
  addSupplier: (
    supplier: Omit<Supplier, "id">,
  ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
  updateSupplier: (id: string, patch: Partial<Supplier>) => Promise<{ ok: true } | { ok: false; error: string }>
  removeSupplier: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  // departments
  addDepartment: (input: {
    label: string
    short?: string
    colorId?: DepartmentColorId
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
  updateDepartment: (
    id: WorkDepartment,
    patch: Partial<Omit<DepartmentConfig, "id">>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  removeDepartment: (id: WorkDepartment) => { ok: true } | { ok: false; error: string }
  // treasury
  addExpense: (input: Omit<ExpenseEntry, "id" | "createdAt">) => string
  updateExpense: (id: string, patch: Partial<Omit<ExpenseEntry, "id" | "createdAt">>) => void
  removeExpense: (id: string) => void
  setTreasuryMonth: (
    yearMonth: string,
    patch: Partial<Omit<TreasuryMonth, "yearMonth">>,
  ) => void
  addTreasurySeparado: (
    input: Omit<TreasurySeparado, "id" | "createdAt" | "category" | "status"> & {
      category?: TreasurySeparado["category"]
      status?: TreasurySeparado["status"]
    },
  ) => string
  updateTreasurySeparado: (
    id: string,
    patch: Partial<Omit<TreasurySeparado, "id" | "createdAt">>,
  ) => void
  removeTreasurySeparado: (id: string) => void
  addApartadoMovement: (input: {
    apartadoId: string
    kind: ApartadoMovementKind
    amount: number
    date: string
    note?: string
    /** Si true (default en salidas), crea egreso de tesorería ligado. */
    createExpense?: boolean
    channel?: ExpenseEntry["channel"]
  }) => string
  removeApartadoMovement: (id: string) => void
  // quotations
  createQuotation: (input: {
    clientId: string
    title: string
    departments: WorkDepartment[]
    lines: QuoteLine[]
    notes?: string
    submit: boolean
  }) => string
  updateQuotation: (
    id: string,
    patch: Partial<Quotation>,
    historyAction?: string,
  ) => { ok: true } | { ok: false; error: string }
  setStatus: (id: string, status: QuoteStatus, historyAction?: string) => void
  submitForReview: (id: string) => void
  setClientResponse: (
    id: string,
    response: ClientResponse,
  ) => { ok: true; projectId?: string } | { ok: false; error: string }
  duplicateQuotation: (id: string) => string | null
  archiveQuotation: (id: string) => void
  /** Manda un borrador a Eliminados (se borra del todo a los 7 días). */
  deleteDraftQuotation: (id: string) => { ok: true } | { ok: false; error: string }
  restoreDraftQuotation: (id: string) => { ok: true } | { ok: false; error: string }
  purgeExpiredTrashedDrafts: () => void
  uploadVisitPhotos: (
    quotationId: string,
    files: File[],
  ) => Promise<{ ok: true; photos: VisitPhoto[] } | { ok: false; error: string }>
  removeVisitPhoto: (
    quotationId: string,
    photoId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  hydrateVisitPhotos: (quotationId: string, photos: VisitPhoto[]) => void
  // projects
  createProjectFromQuotation: (quotationId: string) => string | null
  createManualProject: (input: {
    title: string
    clientId: string
    departments?: WorkDepartment[]
    totalDue: number
    notes?: string
    stage?: ProjectStage
    dueDate?: string
  }) => string
  updateProject: (id: string, patch: Partial<Project>, historyAction?: string) => void
  setProjectStage: (id: string, stage: ProjectStage) => void
  setProjectPaymentMode: (projectId: string, mode: PaymentMode) => void
  addProjectInstallment: (
    projectId: string,
    installment: Omit<ProjectInstallment, "id" | "paidAt">,
  ) => void
  updateProjectInstallment: (
    projectId: string,
    installmentId: string,
    patch: Partial<
      Pick<
        ProjectInstallment,
        | "amount"
        | "dueDate"
        | "note"
        | "invoiceUuid"
        | "invoiceDate"
        | "paymentComplement"
        | "method"
      >
    >,
  ) => void
  removeProjectInstallment: (
    projectId: string,
    installmentId: string,
  ) => { ok: true } | { ok: false; error: string }
  markInstallmentPaid: (
    projectId: string,
    installmentId: string,
    input: { paidAt: string; method: PaymentMethod },
  ) => void
  addPaymentCorrectionNote: (
    projectId: string,
    installmentId: string,
    note: string,
  ) => void
  projectByQuotationId: (quotationId: string) => Project | undefined
  // catalog
  addCatalogItem: (
    item: Omit<CatalogItem, "id"> & { id?: string },
  ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
  updateCatalogItem: (id: string, patch: Partial<CatalogItem>) => Promise<{ ok: true } | { ok: false; error: string }>
  removeCatalogItem: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

const DEFAULT_SETTINGS: WorkspaceSettings = { showNotificationBadge: true }

const TechnikContext = createContext<TechnikState | null>(null)

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Marca de tiempo para historial: YYYY-MM-DD HH:mm */
function nowStamp() {
  const d = new Date()
  const date = d.toISOString().slice(0, 10)
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false })
  return `${date} ${time}`
}

export function TechnikProvider({
  children,
  supabase,
}: {
  children: React.ReactNode
  supabase?: { url: string; key: string }
}) {
  if (typeof window !== "undefined") capturePasswordSetupHintFromLocation()
  if (supabase) setSupabasePublicConfig(supabase)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [mustSetPassword, setMustSetPassword] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [departments, setDepartments] = useState<DepartmentConfig[]>([])
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>([])
  const [inboxEvents, setInboxEvents] = useState<InboxEvent[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [treasuryMonths, setTreasuryMonths] = useState<TreasuryMonth[]>([])
  const [treasurySeparados, setTreasurySeparados] = useState<TreasurySeparado[]>([])
  const [apartadoMovements, setApartadoMovements] = useState<ApartadoMovement[]>([])
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS)
  const [liveNotice, setLiveNotice] = useState<LiveNotice | null>(null)
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "offline">("connecting")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | undefined>()

  const originIdRef = useRef(createOriginId())
  const revRef = useRef(0)
  const skipBroadcastRef = useRef(false)
  const suppressPublishRef = useRef(true)
  const pendingMessageRef = useRef<string | undefined>(undefined)
  const pendingAudienceRef = useRef<LiveNoticeAudience>("except_self")
  const pendingInboxRef = useRef<InboxEvent | undefined>(undefined)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNoticeKeyRef = useRef("")
  const pushingRef = useRef(false)
  /** Si llega un publish mientras otro está en vuelo, se encola (no se descarta). */
  const queuedOverridesRef = useRef<Partial<WorkspaceSnapshot> | null>(null)
  const needsRepublishRef = useRef(false)
  const flushPublishRef = useRef<(overrides?: Partial<WorkspaceSnapshot>) => void>(() => {})
  const userRoleRef = useRef<Role | undefined>(undefined)
  userRoleRef.current = user?.role
  const userAuthIdRef = useRef<string | undefined>(undefined)
  userAuthIdRef.current = user?.authId
  const authHydrateGen = useRef(0)
  const rosterReadyForAuthId = useRef<string | null>(null)
  const logoutIntentRef = useRef(false)
  const hydrateInFlight = useRef<Promise<{ ok: true } | { ok: false; error: string }> | null>(null)
  const hydrateInFlightId = useRef<string | null>(null)
  const saveJobsRef = useRef(new Map<string, () => Promise<PersistResult>>())
  const savePendingRef = useRef(0)
  const saveDirtyRef = useRef(false)
  const trackPersistRef = useRef<
    (key: string, job: () => Promise<PersistResult>) => Promise<PersistResult>
  >(async () => ({ ok: true }))

  const workspaceRef = useRef({
    users,
    clients,
    suppliers,
    catalog,
    quotations,
    projects,
    departments,
    paymentEvents,
    inboxEvents,
    expenses,
    treasuryMonths,
    treasurySeparados,
    apartadoMovements,
    settings,
  })
  workspaceRef.current = {
    users,
    clients,
    suppliers,
    catalog,
    quotations,
    projects,
    departments,
    paymentEvents,
    inboxEvents,
    expenses,
    treasuryMonths,
    treasurySeparados,
    apartadoMovements,
    settings,
  }

  const markSaving = useCallback(() => {
    saveDirtyRef.current = true
    setSaveStatus((prev) => (prev === "error" || prev === "offline" ? prev : "saving"))
  }, [])

  const trackPersist = useCallback((key: string, job: () => Promise<PersistResult>) => {
    if (!isSupabaseConfigured()) return Promise.resolve({ ok: true as const })
    saveJobsRef.current.set(key, job)
    saveDirtyRef.current = true
    savePendingRef.current += 1
    setSaveStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "saving")
    setSaveError(undefined)
    return (async () => {
      const res = await runWithRetries(job)
      savePendingRef.current = Math.max(0, savePendingRef.current - 1)
      if (res.ok) {
        if (saveJobsRef.current.get(key) === job) saveJobsRef.current.delete(key)
        if (savePendingRef.current === 0 && saveJobsRef.current.size === 0) {
          saveDirtyRef.current = false
          setSaveStatus("saved")
        } else if (savePendingRef.current > 0) {
          setSaveStatus("saving")
        }
        return res
      }
      if (persistFailedOffline(res)) {
        setSaveStatus("offline")
        return res
      }
      setSaveError(res.error || "No se pudo guardar.")
      setSaveStatus("error")
      return res
    })()
  }, [])
  trackPersistRef.current = trackPersist

  const retrySave = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSaveStatus("offline")
      return
    }
    const entries = [...saveJobsRef.current.entries()]
    if (entries.length === 0) {
      if (savePendingRef.current === 0) {
        saveDirtyRef.current = false
        setSaveStatus("saved")
      }
      return
    }
    for (const [key, job] of entries) {
      void trackPersist(key, job)
    }
  }, [trackPersist])

  useEffect(() => {
    if (saveStatus !== "saved") return
    const t = window.setTimeout(() => {
      setSaveStatus((prev) => (prev === "saved" ? "idle" : prev))
    }, 2800)
    return () => window.clearTimeout(t)
  }, [saveStatus])

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (
        saveDirtyRef.current ||
        savePendingRef.current > 0 ||
        saveJobsRef.current.size > 0
      ) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    const onOffline = () => {
      if (saveDirtyRef.current || savePendingRef.current > 0 || saveJobsRef.current.size > 0) {
        setSaveStatus("offline")
      }
    }
    const onOnline = () => {
      if (saveJobsRef.current.size > 0) retrySave()
    }
    const onVis = () => {
      if (document.visibilityState === "visible" && saveJobsRef.current.size > 0) retrySave()
    }
    window.addEventListener("beforeunload", onLeave)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("beforeunload", onLeave)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [retrySave])

  const showNotice = useCallback((text: string) => {
    const notice: LiveNotice = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      at: Date.now(),
    }
    setLiveNotice(notice)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => {
      setLiveNotice((current) => (current?.id === notice.id ? null : current))
    }, 5600)
  }, [])

  const dismissLiveNotice = useCallback(() => setLiveNotice(null), [])

  const maybeShowRemoteNotice = useCallback(
    (
      message: string | undefined,
      audience: LiveNoticeAudience | undefined,
      rev: number,
      originId?: string,
    ) => {
      if (!message) return
      if (originId && originId === originIdRef.current) return
      if (!liveNoticeVisibleToRole(userRoleRef.current, audience, false)) return
      const key = `${rev}:${message}`
      if (lastNoticeKeyRef.current === key) return
      lastNoticeKeyRef.current = key
      showNotice(message)
    },
    [showNotice],
  )

  /**
   * Programa mensaje para el hub compartido (solo admins lo ven).
   * Por defecto `except_self`: otros admins, no la pestaña que originó el cambio.
   * Si hay `inbox`, también entra a la campana (badge) hasta que se marque como vista.
   */
  const announce = useCallback(
    (
      message: string,
      audience: LiveNoticeAudience = "except_self",
      inbox?: Omit<InboxEvent, "id" | "at"> & { id?: string; at?: string },
    ) => {
      pendingMessageRef.current = message
      pendingAudienceRef.current = audience
      if (inbox) {
        pendingInboxRef.current = {
          id: inbox.id ?? `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: inbox.kind,
          title: inbox.title,
          body: inbox.body,
          at: inbox.at ?? new Date().toISOString(),
          href: inbox.href,
        }
        if (isSupabaseConfigured()) {
          void trackPersist(`inbox:${pendingInboxRef.current.id}`, () =>
            persistInboxEvent(pendingInboxRef.current!),
          )
        }
      } else {
        pendingInboxRef.current = undefined
      }
      if (liveNoticeVisibleToRole(userRoleRef.current, audience, true)) {
        showNotice(message)
      }
    },
    [showNotice, trackPersist],
  )

  const persistQuoteNow = useCallback((q: Quotation) => {
    if (!isSupabaseConfigured()) return
    void trackPersist(`quote:${q.id}`, () =>
      enqueuePersistQuotation(q, {
        actorAuthId: userAuthIdRef.current,
        users: workspaceRef.current.users,
        isAdmin: userRoleRef.current === "admin",
      }),
    )
  }, [trackPersist])

  const persistProjectNow = useCallback((project: Project) => {
    if (!isSupabaseConfigured()) return
    void trackPersist(`project:${project.id}`, () =>
      enqueuePersistProject(project, {
        actorAuthId: userAuthIdRef.current,
        users: workspaceRef.current.users,
      }),
    )
  }, [trackPersist])

  const applyLoadedOps = useCallback(
    (ops: Extract<Awaited<ReturnType<typeof loadOpsWorkspace>>, { ok: true }>) => {
      if (!ops.projectsError) {
        setProjects((prev) => adoptProjects(prev, ops.projects))
      }
      if (!ops.paymentEventsError) {
        setPaymentEvents((prev) =>
          adoptById(prev, ops.paymentEvents, (a, b) => ((a.at ?? "") >= (b.at ?? "") ? a : b)),
        )
      }
      if (!ops.inboxEventsError) {
        setInboxEvents((prev) =>
          adoptById(prev, ops.inboxEvents, (a, b) => ((a.at ?? "") >= (b.at ?? "") ? a : b)),
        )
      }
      if (!ops.expensesError) {
        setExpenses((prev) =>
          adoptById(prev, ops.expenses, (a, b) =>
            (a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b,
          ),
        )
      }
      if (!ops.treasuryMonthsError) {
        setTreasuryMonths((prev) =>
          adoptByKey(prev, ops.treasuryMonths, (m) => m.yearMonth, (_a, b) => b),
        )
      }
      if (!ops.treasurySeparadosError) {
        setTreasurySeparados((prev) =>
          adoptById(
            prev,
            ops.treasurySeparados.filter(isManualReserve),
            (a, b) => ((a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b),
          ),
        )
      }
      if (!ops.apartadoMovementsError) {
        setApartadoMovements((prev) =>
          adoptById(prev, ops.apartadoMovements, (a, b) =>
            (a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b,
          ),
        )
      }
    },
    [],
  )

  const applyLoadedCore = useCallback(
    (core: Awaited<ReturnType<typeof loadCoreWorkspace>>) => {
      if (!core.departmentsError && core.departments.length > 0) {
        setDepartments((prev) => adoptById(prev, core.departments, (_a, b) => b))
      }
      if (!core.clientsError) {
        setClients((prev) => adoptById(prev, core.clients, (_a, b) => b))
      }
      if (!core.suppliersError) {
        setSuppliers((prev) => adoptById(prev, core.suppliers, (_a, b) => b))
      }
      if (!core.catalogError) {
        setCatalog((prev) => adoptById(prev, core.catalog, (_a, b) => b))
      }
    },
    [],
  )

  const applySnapshot = useCallback((snapshot: WorkspaceSnapshot) => {
    skipBroadcastRef.current = true
    revRef.current = snapshot.rev
    // Con Supabase el hub en RAM no es fuente de verdad: un deploy lo deja
    // vacío y no puede borrar usuarios, catálogo, cotizaciones ni cobros.
    if (isSupabaseConfigured()) return
    setUsers(snapshot.users)
    setClients(
      snapshot.clients.map((c) => ({
        ...c,
        rfc: (c as Client).rfc ?? "",
      })),
    )
    setSuppliers(snapshot.suppliers)
    setCatalog(snapshot.catalog)
    setDepartments(
      snapshot.departments
        .filter((d) => d.id !== "soldadura_maquinados")
        .map((d) => ({
          ...d,
          colorId: normalizeDepartmentColorId(d.colorId),
        })),
    )
    setQuotations((prev) =>
      adoptQuotations(
        prev,
        snapshot.quotations
          .map((q) => ({
            ...q,
            departments: quotationDepartments(q),
          }))
          .filter((q) => !quotationTrashExpired(q)),
        snapshot.inboxEvents ?? [],
      ).filter((q) => !quotationTrashExpired(q)),
    )
    setProjects((prev) =>
      adoptProjects(
        prev,
        snapshot.projects.map((p) => normalizeProject(p)),
      ),
    )
    setPaymentEvents((prev) =>
      adoptById(prev, snapshot.paymentEvents ?? [], (a, b) => ((a.at ?? "") >= (b.at ?? "") ? a : b)),
    )
    setInboxEvents((prev) =>
      adoptById(prev, snapshot.inboxEvents ?? [], (a, b) => ((a.at ?? "") >= (b.at ?? "") ? a : b)),
    )
    setExpenses((prev) =>
      adoptById(prev, snapshot.expenses ?? [], (a, b) =>
        (a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b,
      ),
    )
    setTreasuryMonths((prev) =>
      adoptByKey(
        prev,
        snapshot.treasuryMonths ?? [],
        (m) => m.yearMonth,
        (_a, b) => b,
      ),
    )
    setTreasurySeparados((prev) => {
      const incoming = (snapshot.treasurySeparados ?? [])
        .map((s) => normalizeTreasurySeparado(s as TreasurySeparado))
        .filter(isManualReserve)
      return adoptById(prev, incoming, (a, b) =>
        (a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b,
      )
    })
    setApartadoMovements((prev) =>
      adoptById(
        prev,
        (snapshot.apartadoMovements ?? []).map((m) =>
          normalizeApartadoMovement(m as ApartadoMovement),
        ),
        (a, b) => ((a.createdAt ?? "") >= (b.createdAt ?? "") ? a : b),
      ),
    )
    setSettings({ ...DEFAULT_SETTINGS, ...snapshot.settings })
  }, [])

  const buildSnapshot = useCallback(
    (overrides?: Partial<WorkspaceSnapshot>): WorkspaceSnapshot => {
      const base = workspaceRef.current
      // No tocar revRef aquí: si se adelanta, el poll del admin ignora updates del empleado.
      const rev = overrides?.rev ?? Date.now()
      // Nunca permitir que un override `undefined` (cola de publish) borre arrays del snapshot.
      const clean = overrides
        ? (Object.fromEntries(
            Object.entries(overrides).filter(([, v]) => v !== undefined),
          ) as Partial<WorkspaceSnapshot>)
        : undefined
      const snapshot: WorkspaceSnapshot = {
        users: base.users,
        clients: base.clients,
        suppliers: base.suppliers,
        catalog: base.catalog,
        quotations: base.quotations,
        projects: base.projects,
        departments: base.departments,
        paymentEvents: base.paymentEvents,
        inboxEvents: base.inboxEvents,
        expenses: base.expenses,
        treasuryMonths: base.treasuryMonths,
        treasurySeparados: base.treasurySeparados,
        apartadoMovements: base.apartadoMovements,
        settings: base.settings,
        ...clean,
        rev,
      }
      const reserves = (snapshot.treasurySeparados ?? []).filter(isManualReserve)
      const reserveIds = new Set(reserves.map((s) => s.id))
      return {
        ...snapshot,
        treasurySeparados: reserves,
        apartadoMovements: (snapshot.apartadoMovements ?? []).filter((m) =>
          reserveIds.has(m.apartadoId),
        ),
      }
    },
    [],
  )

  /** Publica al hub en memoria del servidor (compartido entre todas las pestañas). */
  const flushPublish = useCallback(
    (overrides?: Partial<WorkspaceSnapshot>) => {
      if (suppressPublishRef.current) return

      // No descartar: si hay un push en vuelo, encola el más reciente (p. ej. enviar a revisión tras autosave).
      if (pushingRef.current) {
        needsRepublishRef.current = true
        if (overrides) {
          const prev = queuedOverridesRef.current ?? {}
          const next: Partial<WorkspaceSnapshot> = { ...prev }
          for (const [key, value] of Object.entries(overrides) as [keyof WorkspaceSnapshot, unknown][]) {
            if (value !== undefined) {
              ;(next as Record<string, unknown>)[key] = value
            }
          }
          queuedOverridesRef.current = next
        }
        return
      }

      const queued = queuedOverridesRef.current
      queuedOverridesRef.current = null
      needsRepublishRef.current = false

      const mergedOverrides: Partial<WorkspaceSnapshot> = {}
      for (const src of [queued, overrides]) {
        if (!src) continue
        for (const [key, value] of Object.entries(src) as [keyof WorkspaceSnapshot, unknown][]) {
          if (value !== undefined) {
            ;(mergedOverrides as Record<string, unknown>)[key] = value
          }
        }
      }
      const hasOverrides = Object.keys(mergedOverrides).length > 0

      const message = pendingMessageRef.current
      const audience = pendingAudienceRef.current
      const inboxItem = pendingInboxRef.current
      pendingMessageRef.current = undefined
      pendingAudienceRef.current = "except_self"
      pendingInboxRef.current = undefined

      let nextOverrides: Partial<WorkspaceSnapshot> | undefined = hasOverrides
        ? mergedOverrides
        : undefined
      if (inboxItem) {
        const prev = nextOverrides?.inboxEvents ?? workspaceRef.current.inboxEvents
        nextOverrides = {
          ...nextOverrides,
          inboxEvents: [inboxItem, ...prev.filter((e) => e.id !== inboxItem.id)].slice(0, 80),
        }
      }

      const snapshot = buildSnapshot(nextOverrides)
      skipBroadcastRef.current = true
      pushingRef.current = true

      void pushRemoteWorkspace({
        snapshot,
        originId: originIdRef.current,
        actorName: user?.name,
        message,
        audience: message ? audience : undefined,
      })
        .then((res) => {
          if (!res.ok || !res.snapshot) {
            setSyncStatus("offline")
            return
          }
          setSyncStatus("live")
          // Si hay otro publish encolado (p. ej. envío a revisión tras autosave),
          // no apliques este snapshot intermedio: pisaría el estado optimista local.
          if (needsRepublishRef.current || queuedOverridesRef.current) {
            revRef.current = Math.max(revRef.current, res.snapshot.rev)
            return
          }
          applySnapshot(res.snapshot)
        })
        .finally(() => {
          pushingRef.current = false
          if (
            needsRepublishRef.current ||
            queuedOverridesRef.current ||
            pendingMessageRef.current ||
            pendingInboxRef.current
          ) {
            const again = queuedOverridesRef.current
            queuedOverridesRef.current = null
            needsRepublishRef.current = false
            queueMicrotask(() => flushPublishRef.current(again ?? undefined))
          }
        })
    },
    [buildSnapshot, user?.name, applySnapshot],
  )
  flushPublishRef.current = flushPublish

  // Hidratar desde Supabase; el hub solo sirve avisos en vivo.
  useEffect(() => {
    let cancelled = false

    const pull = async (isBoot = false) => {
      const res = await fetchRemoteWorkspace()
      if (cancelled) return
      if (!res.ok || !res.snapshot) {
        setSyncStatus("offline")
        if (isBoot) suppressPublishRef.current = false
      } else {
        setSyncStatus("live")
        if (res.snapshot.rev > revRef.current || isBoot) {
          applySnapshot(res.snapshot)
        }
        if (!isBoot) {
          const pulse = res.snapshot.lastLive
          if (pulse && pulse.rev === res.snapshot.rev) {
            maybeShowRemoteNotice(pulse.message, pulse.audience, pulse.rev, pulse.originId)
          }
        }
      }

      if (isSupabaseConfigured()) {
        const quotesRes = await loadQuotations(workspaceRef.current.users)
        if (cancelled) return
        if (quotesRes.ok) {
          const prev = workspaceRef.current.quotations
          const next = adoptQuotations(prev, quotesRes.quotations).filter(
            (q) => !quotationTrashExpired(q),
          )
          const remoteIds = new Set(quotesRes.quotations.map((q) => q.id))
          const authId = userAuthIdRef.current
          const role = userRoleRef.current
          for (const q of next) {
            if (remoteIds.has(q.id)) continue
            const owner = workspaceRef.current.users.find(
              (u) => u.id === q.createdById || u.authId === q.createdById,
            )
            const mine = Boolean(authId && (owner?.authId === authId || q.createdById === authId))
            if (mine) {
              void trackPersist(`quote:${q.id}`, () =>
                enqueuePersistQuotation(q, {
                  actorAuthId: authId,
                  users: workspaceRef.current.users,
                  isAdmin: role === "admin",
                }),
              )
            }
          }
          if (quotesSignature(prev) !== quotesSignature(next)) {
            setQuotations(next)
          }
        }
        const ops = await loadOpsWorkspace(workspaceRef.current.users)
        if (cancelled) return
        if (ops.ok) applyLoadedOps(ops)
        const core = await loadCoreWorkspace()
        if (cancelled) return
        applyLoadedCore(core)
      }

      if (isBoot) suppressPublishRef.current = false
    }

    void pull(true)
    const timer = window.setInterval(() => {
      if (!pushingRef.current) void pull(false)
    }, 4000)
    const onFocus = () => {
      if (!pushingRef.current) void pull(false)
    }
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [applySnapshot, maybeShowRemoteNotice, applyLoadedOps, applyLoadedCore])

  useEffect(() => {
    const backup = readOpsBackup()
    const legacy = loadWorkspace()
    const quotes = [...backup.quotations, ...(legacy?.quotations ?? [])]
    const projectsBackup = [...backup.projects, ...(legacy?.projects ?? [])]
    if (quotes.length > 0) {
      setQuotations((prev) =>
        adoptQuotations(prev, quotes).filter((q) => !quotationTrashExpired(q)),
      )
    }
    if (projectsBackup.length > 0) {
      setProjects((prev) => adoptProjects(prev, projectsBackup.map((p) => normalizeProject(p))))
    }
  }, [])

  useEffect(() => {
    writeOpsBackup(quotations, projects)
  }, [quotations, projects])

  // Empujar cambios locales al hub cuando muta el workspace.
  // Con Supabase, usuarios/clientes/catálogo/depts no viven en el hub:
  // republicarlos en cada recarga de perfiles hace parpadear la lista.
  const persistCoreInSupabase = isSupabaseConfigured()
  useEffect(() => {
    if (suppressPublishRef.current) return
    if (skipBroadcastRef.current) {
      skipBroadcastRef.current = false
      return
    }
    flushPublish()
  }, [
    persistCoreInSupabase ? null : users,
    persistCoreInSupabase ? null : clients,
    persistCoreInSupabase ? null : suppliers,
    persistCoreInSupabase ? null : catalog,
    persistCoreInSupabase ? null : departments,
    quotations,
    projects,
    paymentEvents,
    inboxEvents,
    expenses,
    treasuryMonths,
    treasurySeparados,
    apartadoMovements,
    settings,
    flushPublish,
  ])
  const updateSettings = useCallback((patch: Partial<WorkspaceSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const addExpense = useCallback((input: Omit<ExpenseEntry, "id" | "createdAt">) => {
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const entry: ExpenseEntry = {
      ...input,
      description: input.description.trim(),
      id,
      createdAt: new Date().toISOString(),
    }
    setExpenses((prev) => [entry, ...prev])
    if (isSupabaseConfigured()) {
      void trackPersist(`expense:${entry.id}`, () => persistExpense(entry, userAuthIdRef.current))
    }
    return id
  }, [trackPersist])

  const updateExpense = useCallback(
    (id: string, patch: Partial<Omit<ExpenseEntry, "id" | "createdAt">>) => {
      setExpenses((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e
          const next = {
            ...e,
            ...patch,
            description:
              patch.description !== undefined ? patch.description.trim() : e.description,
          }
          if (isSupabaseConfigured()) {
            void trackPersist(`expense:${next.id}`, () => persistExpense(next, userAuthIdRef.current))
          }
          return next
        }),
      )
    },
    [trackPersist],
  )

  const removeExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    if (isSupabaseConfigured()) {
      void trackPersist(`expense-del:${id}`, () => deleteExpenseRow(id))
    }
  }, [trackPersist])

  const setTreasuryMonth = useCallback(
    (yearMonth: string, patch: Partial<Omit<TreasuryMonth, "yearMonth">>) => {
      setTreasuryMonths((prev) => {
        const existing = prev.find((m) => m.yearMonth === yearMonth)
        const next = existing
          ? prev.map((m) => (m.yearMonth === yearMonth ? { ...m, ...patch } : m))
          : [
              {
                yearMonth,
                openingBank: patch.openingBank ?? 0,
                openingCash: patch.openingCash ?? 0,
              },
              ...prev,
            ]
        const saved = next.find((m) => m.yearMonth === yearMonth)
        if (saved && isSupabaseConfigured()) {
          void trackPersist(`treasury-month:${saved.yearMonth}`, () => persistTreasuryMonth(saved))
        }
        return next
      })
    },
    [trackPersist],
  )

  const addTreasurySeparado = useCallback(
    (
      input: Omit<TreasurySeparado, "id" | "createdAt" | "category" | "status"> & {
        category?: TreasurySeparado["category"]
        status?: TreasurySeparado["status"]
      },
    ) => {
      const id = `sep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const entry = normalizeTreasurySeparado({
        ...input,
        category: input.category ?? "custom",
        status: input.status ?? "open",
        name: input.name.trim(),
        id,
        createdAt: new Date().toISOString(),
      })
      setTreasurySeparados((prev) => [entry, ...prev])
      if (isSupabaseConfigured()) {
        void trackPersist(`separado:${entry.id}`, () => persistSeparado(entry))
      }
      return id
    },
    [trackPersist],
  )

  const updateTreasurySeparado = useCallback(
    (id: string, patch: Partial<Omit<TreasurySeparado, "id" | "createdAt">>) => {
      setTreasurySeparados((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s
          const next = {
            ...s,
            ...patch,
            name: patch.name !== undefined ? patch.name.trim() : s.name,
          }
          if (isSupabaseConfigured()) {
            void trackPersist(`separado:${next.id}`, () => persistSeparado(next))
          }
          return next
        }),
      )
    },
    [trackPersist],
  )

  const removeTreasurySeparado = useCallback((id: string) => {
    setTreasurySeparados((prev) => prev.filter((s) => s.id !== id))
    setApartadoMovements((prev) => prev.filter((m) => m.apartadoId !== id))
    if (isSupabaseConfigured()) {
      void trackPersist(`separado-del:${id}`, () => deleteSeparadoRow(id))
    }
  }, [trackPersist])

  const addApartadoMovement = useCallback(
    (input: {
      apartadoId: string
      kind: ApartadoMovementKind
      amount: number
      date: string
      note?: string
      createExpense?: boolean
      channel?: ExpenseEntry["channel"]
    }) => {
      const amount = Number(input.amount)
      if (!Number.isFinite(amount) || amount <= 0) return ""
      const id = `amov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const shouldExpense =
        input.kind === "out" && (input.createExpense === undefined || input.createExpense)
      let expenseId: string | undefined
      if (shouldExpense) {
        const sep = workspaceRef.current.treasurySeparados.find(
          (s) => s.id === input.apartadoId,
        )
        expenseId = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const entry: ExpenseEntry = {
          id: expenseId,
          amount,
          date: input.date,
          description:
            input.note?.trim() ||
            `Salida apartado${sep ? `: ${sep.name}` : ""}`.trim(),
          channel: input.channel ?? "banco",
          createdAt: new Date().toISOString(),
        }
        setExpenses((prev) => [entry, ...prev])
        if (isSupabaseConfigured()) {
          void trackPersist(`expense:${entry.id}`, () => persistExpense(entry, userAuthIdRef.current))
        }
      }
      const movement = normalizeApartadoMovement({
        id,
        apartadoId: input.apartadoId,
        kind: input.kind,
        amount,
        date: input.date,
        note: input.note,
        expenseId,
        createdAt: new Date().toISOString(),
        createdById: user?.id,
      })
      setApartadoMovements((prev) => [movement, ...prev])
      if (isSupabaseConfigured()) {
        void trackPersist(`apartado-mov:${movement.id}`, () =>
          persistApartadoMovement(movement, userAuthIdRef.current),
        )
      }
      return id
    },
    [user?.id, trackPersist],
  )

  const removeApartadoMovement = useCallback((id: string) => {
    setApartadoMovements((prev) => {
      const target = prev.find((m) => m.id === id)
      if (target?.expenseId) {
        const expenseId = target.expenseId
        setExpenses((exps) => exps.filter((e) => e.id !== expenseId))
        if (isSupabaseConfigured()) {
          void trackPersist(`expense-del:${expenseId}`, () => deleteExpenseRow(expenseId))
        }
      }
      if (isSupabaseConfigured()) {
        void trackPersist(`apartado-mov-del:${id}`, () => deleteApartadoMovementRow(id))
      }
      return prev.filter((m) => m.id !== id)
    })
  }, [])

  const applyAuthUser = useCallback(async (authUserId: string, authEmail?: string | null) => {
    if (logoutIntentRef.current) return { ok: false as const, error: "Sesión cerrada." }
    if (hydrateInFlight.current && hydrateInFlightId.current === authUserId) {
      return hydrateInFlight.current
    }
    const gen = ++authHydrateGen.current
    hydrateInFlightId.current = authUserId
    const run = (async () => {
      await Promise.resolve()
      if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
      const supabase = getSupabaseBrowser()
      let { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", authUserId)
        .maybeSingle()
      if (error && /invite_pending/i.test(error.message)) {
        const retry = await supabase
          .from("profiles")
          .select(PROFILE_COLUMNS_LEGACY)
          .eq("id", authUserId)
          .maybeSingle()
        data = retry.data
        error = retry.error
      }
      if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
      if (error || !data) {
        return {
          ok: false as const,
          error: "Tu usuario no tiene perfil en Technik. Pide a un admin que lo cree.",
        }
      }
      let row = data as ProfileRow
      if (!row.active) {
        return { ok: false as const, error: "Esta cuenta está desactivada." }
      }
      const email = authEmail?.trim()
      if (email && email !== row.email) {
        const { data: synced, error: syncError } = await supabase
          .from("profiles")
          .update({ email })
          .eq("id", authUserId)
          .select(PROFILE_COLUMNS)
          .maybeSingle()
        if (syncError && /invite_pending/i.test(syncError.message)) {
          const retry = await supabase
            .from("profiles")
            .update({ email })
            .eq("id", authUserId)
            .select(PROFILE_COLUMNS_LEGACY)
            .maybeSingle()
          if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
          row = (retry.data as ProfileRow | null) ?? { ...row, email }
        } else {
          if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
          row = (synced as ProfileRow | null) ?? { ...row, email }
        }
      }
      const next = userFromProfile(row)
      if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
      setUser(next)
      const rosterAlreadyLoaded =
        rosterReadyForAuthId.current === authUserId && workspaceRef.current.users.length > 0
      if (rosterAlreadyLoaded) {
        return { ok: true as const }
      }
      const [rosterRes, core] = await Promise.all([loadProfiles(), loadCoreWorkspace()])
      if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
      if (rosterRes.ok) {
        setUsers((prev) =>
          dedupeUsers(
            adoptByKey(
              prev.length > 0 ? prev : [next],
              rosterRes.users.length > 0 ? rosterRes.users : [next],
              (u) => u.authId || u.id,
              (_a, b) => b,
            ),
          ),
        )
        rosterReadyForAuthId.current = authUserId
      } else {
        setUsers((prev) => (prev.length > 0 ? prev : [next]))
      }
      applyLoadedCore(core)
      const roster = rosterRes.ok
        ? rosterRes.users.length > 0
          ? rosterRes.users
          : [next]
        : workspaceRef.current.users.length > 0
          ? workspaceRef.current.users
          : [next]
      const quotesRes = await loadQuotations(roster)
      if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
      if (quotesRes.ok) {
        setQuotations((prev) => {
          const adopted = adoptQuotations(prev, quotesRes.quotations).filter(
            (q) => !quotationTrashExpired(q),
          )
          return quotesSignature(prev) === quotesSignature(adopted) ? prev : adopted
        })
      }
      const ops = await loadOpsWorkspace(roster)
      if (logoutIntentRef.current || gen !== authHydrateGen.current) return { ok: true as const }
      if (ops.ok) applyLoadedOps(ops)
      return { ok: true as const }
    })()
    hydrateInFlight.current = run
    try {
      return await run
    } finally {
      if (hydrateInFlightId.current === authUserId) {
        hydrateInFlight.current = null
        hydrateInFlightId.current = null
      }
    }
  }, [applyLoadedOps, applyLoadedCore])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthReady(true)
      return
    }
    const supabase = getSupabaseBrowser()
    let cancelled = false
    if (capturePasswordSetupHintFromLocation()) setMustSetPassword(true)

    function gatePassword(event: string | undefined, authUser: { user_metadata?: Record<string, unknown> } | null | undefined) {
      if (userMustSetPassword(authUser)) return true
      if (event === "PASSWORD_RECOVERY") return true
      if (authUser) return false
      return capturePasswordSetupHintFromLocation()
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || logoutIntentRef.current) {
        if (!cancelled) setAuthReady(true)
        return
      }
      const authUser = data.session?.user
      if (authUser && gatePassword(undefined, authUser)) {
        if (!cancelled) {
          setMustSetPassword(true)
          setAuthReady(true)
        }
        return
      }
      if (authUser && !cancelled) await applyAuthUser(authUser.id, authUser.email)
      if (!cancelled) setAuthReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null)
        if (!capturePasswordSetupHintFromLocation()) setMustSetPassword(false)
        rosterReadyForAuthId.current = null
        hydrateInFlight.current = null
        hydrateInFlightId.current = null
        return
      }
      if (logoutIntentRef.current) return
      if (event === "TOKEN_REFRESHED") return
      if (gatePassword(event, session.user)) {
        setMustSetPassword(true)
        return
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        void applyAuthUser(session.user.id, session.user.email)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [applyAuthUser])

  const login = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured()) {
        return {
          ok: false as const,
          error: "Supabase no está configurado. Revisa las variables en Vercel y vuelve a desplegar.",
        }
      }
      const supabase = getSupabaseBrowser()
      logoutIntentRef.current = false
      clearPasswordSetupHint()
      setMustSetPassword(false)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error || !data.user) {
        return { ok: false as const, error: "Correo o contraseña incorrectos." }
      }
      const applied = await applyAuthUser(data.user.id, data.user.email)
      if (!applied.ok) {
        await supabase.auth.signOut()
        return applied
      }
      return { ok: true as const }
    },
    [applyAuthUser],
  )

  const logout = useCallback(async () => {
    logoutIntentRef.current = true
    setUser(null)
    setMustSetPassword(false)
    rosterReadyForAuthId.current = null
    authHydrateGen.current += 1
    hydrateInFlight.current = null
    hydrateInFlightId.current = null
    clearPasswordSetupHint()
    if (!isSupabaseConfigured()) return
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut({ scope: "local" })
    void supabase.auth.signOut({ scope: "global" }).catch(() => undefined)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        signal: AbortSignal.timeout(20_000),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!json?.ok) {
        return { ok: false as const, error: json?.error || "No se pudo enviar el correo de recuperación." }
      }
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: "No se pudo enviar el correo de recuperación." }
    }
  }, [])

  const completePasswordSetup = useCallback(
    async (password: string) => {
      if (password.length < 8) {
        return { ok: false as const, error: "La contraseña debe tener al menos 8 caracteres." }
      }
      if (!isSupabaseConfigured()) {
        return { ok: false as const, error: "Supabase no está configurado." }
      }
      const supabase = getSupabaseBrowser()
      await establishAuthSessionFromUrl()
      let session = (await supabase.auth.getSession()).data.session
      for (let i = 0; i < 20 && !session?.user; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        session = (await supabase.auth.getSession()).data.session
      }
      if (!session?.user) {
        return { ok: false as const, error: "El enlace expiró. Pide una nueva invitación." }
      }
      const { error } = await supabase.auth.updateUser({
        password,
        data: { ...(session.user.user_metadata ?? {}), must_set_password: false },
      })
      if (error) {
        return { ok: false as const, error: error.message || "No se pudo guardar la contraseña." }
      }
      await supabase.auth.refreshSession().catch(() => null)
      await supabase.from("profiles").update({ invite_pending: false }).eq("id", session.user.id)
      authHydrateGen.current += 1
      clearPasswordSetupHint()
      setMustSetPassword(false)
      if (typeof window !== "undefined") {
        window.location.replace("/")
      }
      return { ok: true as const }
    },
    [],
  )

  const inviteUser = useCallback(
    async (input: {
      name: string
      email: string
      username: string
      role: Role
      department: string
    }) => {
      const supabase = getSupabaseBrowser()
      let { data } = await supabase.auth.getSession()
      let token = data.session?.access_token
      if (!token) {
        const refreshed = await supabase.auth.refreshSession()
        token = refreshed.data.session?.access_token
      }
      if (!token) return { ok: false as const, error: "Sesión inválida. Cierra sesión y vuelve a entrar." }
      try {
        const res = await fetch("/api/users/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(40_000),
        })
        const json = (await res.json().catch(() => null)) as
          | { ok: true; id: string; emailed?: boolean; inviteLink?: string; mailError?: string }
          | { ok: false; error: string }
          | null
        if (!json || !json.ok) {
          return { ok: false as const, error: json && "error" in json ? json.error : "No se pudo invitar." }
        }
        const invited: User = {
          id: input.username,
          authId: json.id,
          username: input.username,
          name: input.name,
          email: input.email,
          role: input.role,
          password: "",
          department: input.department,
          location: "",
          since: new Date().getFullYear().toString(),
          active: true,
          invitePending: true,
        }
        setUsers((prev) => dedupeUsers([...prev, invited]))
        const roster = await loadProfiles()
        if (roster.ok && roster.users.length > 0) {
          setUsers((prev) =>
            dedupeUsers(
              adoptByKey(prev, roster.users, (u) => u.authId || u.id, (_a, b) => b),
            ),
          )
        }
        return {
          ok: true as const,
          emailed: json.emailed,
          inviteLink: json.inviteLink,
          mailError: json.mailError,
        }
      } catch (err) {
        const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
        return {
          ok: false as const,
          error: timedOut
            ? "La invitación tardó demasiado. Revisa la service role key y Auth en Supabase."
            : "No se pudo contactar al servidor de invitaciones.",
        }
      }
    },
    [],
  )

  const refreshUsers = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const roster = await loadProfiles()
    if (roster.ok && roster.users.length > 0) {
      setUsers((prev) =>
        dedupeUsers(adoptByKey(prev, roster.users, (u) => u.authId || u.id, (_a, b) => b)),
      )
      if (user?.authId) rosterReadyForAuthId.current = user.authId
    }
  }, [user?.authId])

  const deleteUser = useCallback(async (authId: string) => {
    const supabase = getSupabaseBrowser()
    let { data } = await supabase.auth.getSession()
    let token = data.session?.access_token
    if (!token) {
      const refreshed = await supabase.auth.refreshSession()
      token = refreshed.data.session?.access_token
    }
    if (!token) return { ok: false as const, error: "Sesión inválida. Cierra sesión y vuelve a entrar." }
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(authId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null
      if (!json || !json.ok) {
        return { ok: false as const, error: json && "error" in json ? json.error : "No se pudo eliminar." }
      }
      setUsers((prev) => prev.filter((u) => u.authId !== authId))
      return { ok: true as const }
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
      return {
        ok: false as const,
        error: timedOut ? "La eliminación tardó demasiado." : "No se pudo contactar al servidor.",
      }
    }
  }, [])

  const upsertUser = useCallback((u: User) => {
    setUsers((prev) => {
      const exists = prev.some((x) => x.authId === u.authId || x.id === u.id)
      const next = exists
        ? prev.map((x) => (x.authId === u.authId || x.id === u.id ? u : x))
        : [u, ...prev]
      return dedupeUsers(next)
    })
    setUser((current) =>
      current && (current.authId === u.authId || current.id === u.id) ? u : current,
    )
  }, [])

  const applyPersistedUser = useCallback((next: User) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.authId === next.authId)
      return exists
        ? prev.map((u) => (u.authId === next.authId ? next : u))
        : [next, ...prev]
    })
    setUser((current) => (current?.authId === next.authId ? next : current))
  }, [])

  const updateUser = useCallback(
    async (authId: string, patch: ProfilePatch) => {
      if (!isSupabaseConfigured()) {
        return { ok: false as const, error: "Supabase no está configurado." }
      }
      let saved: User | undefined
      const result = await trackPersist(`profile:${authId}`, async () => {
        const r = await persistProfile(authId, patch)
        if (!r.ok) return r
        saved = r.user
        return { ok: true as const }
      })
      if (!result.ok) return { ok: false as const, error: result.error || "No se pudo guardar el perfil." }
      if (saved) applyPersistedUser(saved)
      return { ok: true as const }
    },
    [applyPersistedUser, trackPersist],
  )

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      const current = user
      if (!current) return { ok: false as const, error: "No hay sesión." }
      if (!current.authId || !isSupabaseConfigured()) {
        const next = { ...current, ...patch, id: patch.username ?? current.id }
        upsertUser(next)
        return { ok: true as const }
      }
      const allowed: ProfilePatch = {
        name: patch.name,
        department: patch.department,
      }
      if (current.role === "admin" && patch.username !== undefined) {
        allowed.username = patch.username
      }
      return updateUser(current.authId, allowed)
    },
    [user, updateUser, upsertUser],
  )

  const uploadProfilePhoto = useCallback(
    async (file: File, authId?: string) => {
      const id = authId ?? user?.authId
      if (!id || !isSupabaseConfigured()) {
        return { ok: false as const, error: "No se puede guardar la foto sin sesión en Supabase." }
      }
      let saved: User | undefined
      const result = await trackPersist(`avatar:${id}`, async () => {
        const r = await persistAvatar(id, file)
        if (!r.ok) return r
        saved = r.user
        return { ok: true as const }
      })
      if (!result.ok) return { ok: false as const, error: result.error || "No se pudo guardar la foto." }
      if (saved) applyPersistedUser(saved)
      return { ok: true as const }
    },
    [user?.authId, applyPersistedUser, trackPersist],
  )

  const removeProfilePhoto = useCallback(
    async (authId?: string) => {
      const id = authId ?? user?.authId
      if (!id || !isSupabaseConfigured()) {
        return { ok: false as const, error: "No se puede quitar la foto sin sesión en Supabase." }
      }
      let saved: User | undefined
      const result = await trackPersist(`avatar-clear:${id}`, async () => {
        const r = await clearAvatar(id)
        if (!r.ok) return r
        saved = r.user
        return { ok: true as const }
      })
      if (!result.ok) return { ok: false as const, error: result.error || "No se pudo quitar la foto." }
      if (saved) applyPersistedUser(saved)
      return { ok: true as const }
    },
    [user?.authId, applyPersistedUser, trackPersist],
  )

  const addClient = useCallback(
    async (input: Omit<Client, "id" | "since">) => {
      const id = nextClientCode(clients.map((c) => c.id))
      const client: Client = { ...input, id, since: new Date().getFullYear().toString() }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`client:${client.id}`, () => persistClient(client))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el cliente." }
      }
      setClients((prev) => [client, ...prev])
      return { ok: true as const, id }
    },
    [clients, trackPersist],
  )

  const updateClient = useCallback(
    async (id: string, patch: Partial<Client>) => {
      const current = clients.find((c) => c.id === id)
      if (!current) return { ok: false as const, error: "Cliente no encontrado." }
      const next = { ...current, ...patch }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`client:${next.id}`, () => persistClient(next))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el cliente." }
      }
      setClients((prev) => prev.map((c) => (c.id === id ? next : c)))
      return { ok: true as const }
    },
    [clients, trackPersist],
  )

  const removeClient = useCallback(
    async (id: string) => {
      if (quotations.some((q) => q.clientId === id) || projects.some((p) => p.clientId === id)) {
        return {
          ok: false as const,
          error: "No se puede eliminar: hay cotizaciones o proyectos de este cliente.",
        }
      }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`client-del:${id}`, () => deleteClient(id))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo eliminar el cliente." }
      }
      setClients((prev) => prev.filter((c) => c.id !== id))
      return { ok: true as const }
    },
    [quotations, projects, trackPersist],
  )

  const addSupplier = useCallback(
    async (input: Omit<Supplier, "id">) => {
      const id = nextVendorCode(suppliers.map((s) => s.id))
      const supplier: Supplier = { ...input, id }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`supplier:${supplier.id}`, () => persistSupplier(supplier))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el proveedor." }
      }
      setSuppliers((prev) => [supplier, ...prev])
      return { ok: true as const, id }
    },
    [suppliers, trackPersist],
  )

  const updateSupplier = useCallback(
    async (id: string, patch: Partial<Supplier>) => {
      const current = suppliers.find((s) => s.id === id)
      if (!current) return { ok: false as const, error: "Proveedor no encontrado." }
      const next = { ...current, ...patch }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`supplier:${next.id}`, () => persistSupplier(next))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el proveedor." }
      }
      setSuppliers((prev) => prev.map((s) => (s.id === id ? next : s)))
      return { ok: true as const }
    },
    [suppliers, trackPersist],
  )

  const removeSupplier = useCallback(async (id: string) => {
    if (isSupabaseConfigured()) {
      const res = await trackPersist(`supplier-del:${id}`, () => deleteSupplier(id))
      if (!res.ok) return { ok: false as const, error: res.error || "No se pudo eliminar el proveedor." }
    }
    setCatalog((prev) =>
      prev.map((item) => (item.supplierId === id ? { ...item, supplierId: undefined } : item)),
    )
    setSuppliers((prev) => prev.filter((s) => s.id !== id))
    return { ok: true as const }
  }, [trackPersist])

  const createQuotation: TechnikState["createQuotation"] = useCallback(
    (input) => {
      const code = nextQuotationCode(quotations.map((q) => q.reference))
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const q: Quotation = {
        id: code,
        reference: code,
        clientId: input.clientId,
        title: input.title,
        departments: input.departments.length
          ? input.departments
          : [departments[0]?.id].filter(Boolean) as WorkDepartment[],
        status: input.submit ? "pending_review" : "draft",
        lines: input.lines,
        publicItems: [],
        terms: DEFAULT_QUOTE_TERMS,
        taxRate: DEFAULT_TAX_RATE,
        isrRetentionRate: DEFAULT_ISR_RETENTION_RATE,
        createdBy: actor,
        createdById: user?.id ?? "system",
        createdAt: d,
        updatedAt: d,
        notes: input.notes,
        visitPhotos: [],
        history: [
          {
            at: stamp,
            by: actor,
            action: input.submit ? "Creó y envió a revisión" : "Creó borrador",
          },
        ],
      }
      const nextQuotations = [q, ...quotations]
      if (input.submit) {
        const inboxItem: InboxEvent = {
          id: `review-${code}-${stamp}`,
          kind: "review_queue",
          title: "Nueva cotización por revisar",
          body: `${code} · ${input.title}`,
          at: new Date().toISOString(),
          href: { name: "review", id: code },
        }
        announce(`${actor} · Nueva cotización en revisión ${code}`, "admin", inboxItem)
        setQuotations(nextQuotations)
        persistQuoteNow(q)
        flushPublish({
          quotations: nextQuotations,
          inboxEvents: [inboxItem, ...workspaceRef.current.inboxEvents],
        })
      } else {
        setQuotations(nextQuotations)
        persistQuoteNow(q)
        flushPublish({ quotations: nextQuotations })
      }
      return code
    },
    [user, quotations, departments, announce, flushPublish, persistQuoteNow],
  )

  const updateQuotation = useCallback(
    (id: string, patch: Partial<Quotation>, historyAction?: string) => {
      const current = quotations.find((q) => q.id === id)
      if (!current) return { ok: false as const, error: "Cotización no encontrada." }

      let nextPatch = { ...patch }

      // Tras envío al cliente: no alterar montos / alcance comercial
      if (current.clientSentAt) {
        const blockedKeys = [
          "lines",
          "publicItems",
          "terms",
          "taxRate",
          "isrRetentionRate",
          "title",
          "clientId",
          "departments",
        ] as const
        const attempted = blockedKeys.filter((k) => k in nextPatch)
        if (attempted.length > 0) {
          return {
            ok: false as const,
            error:
              "Cotización enviada: no se puede editar alcance ni montos. Duplica para una nueva versión.",
          }
        }
      }

      if (nextPatch.clientResponse === "rechazada") {
        const hasProject = projects.some(
          (p) => p.quotationId === id || p.id === id || p.id === current.reference,
        )
        if (hasProject) {
          return {
            ok: false as const,
            error:
              "Ya existe un proyecto para esta cotización. Cierra o cancela el proyecto antes de marcar rechazo.",
          }
        }
      }

      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const nextQuotations = quotations.map((q) => {
        if (q.id !== id) return q
        return {
          ...q,
          ...nextPatch,
          updatedAt: stamp,
          history: historyAction
            ? [...q.history, { at: stamp, by: actor, action: historyAction }]
            : q.history,
        }
      })
      const nextStatus = nextPatch.status ?? current.status
      const isReviewQueue =
        historyAction === "Envió a revisión" ||
        (nextStatus === "pending_review" && current.status !== "pending_review")

      let inboxPayload: InboxEvent[] | undefined
      if (isReviewQueue) {
        const inboxItem: InboxEvent = {
          id: `review-${id}-${stamp}`,
          kind: "review_queue",
          title: "Nueva cotización por revisar",
          body: `${current.reference} · ${nextPatch.title ?? current.title}`,
          at: new Date().toISOString(),
          href: { name: "review", id },
        }
        inboxPayload = [inboxItem, ...workspaceRef.current.inboxEvents.filter((e) => e.id !== inboxItem.id)]
        announce(`${actor} · Envió a revisión · ${id}`, "admin", inboxItem)
      }
      setQuotations(nextQuotations)
      const updated = nextQuotations.find((q) => q.id === id)
      if (updated) persistQuoteNow(updated)
      flushPublish({
        quotations: nextQuotations,
        ...(inboxPayload ? { inboxEvents: inboxPayload } : {}),
      })
      return { ok: true as const }
    },
    [user, announce, quotations, projects, flushPublish, persistQuoteNow],
  )

  const setStatus = useCallback(
    (id: string, status: QuoteStatus, historyAction?: string) => {
      updateQuotation(id, { status }, historyAction ?? `Estado → ${status}`)
    },
    [updateQuotation],
  )

  const submitForReview = useCallback(
    (id: string) => {
      updateQuotation(id, { status: "pending_review" }, "Envió a revisión")
    },
    [updateQuotation],
  )

  const duplicateQuotation = useCallback(
    (id: string) => {
      const src = quotations.find((q) => q.id === id)
      if (!src) return null
      const code = nextQuotationCode(quotations.map((q) => q.reference))
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const q: Quotation = {
        id: code,
        reference: code,
        clientId: src.clientId,
        title: src.title,
        departments: [...src.departments],
        status: "draft",
        lines: src.lines.map((l) => ({ ...l })),
        publicItems: (src.publicItems ?? []).map((it) => ({
          ...it,
          id: `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        })),
        terms: src.terms ?? DEFAULT_QUOTE_TERMS,
        taxRate: src.taxRate ?? DEFAULT_TAX_RATE,
        isrRetentionRate: src.isrRetentionRate ?? DEFAULT_ISR_RETENTION_RATE,
        notes: src.notes,
        comments: src.comments,
        createdBy: actor,
        createdById: user?.id ?? "system",
        createdAt: d,
        updatedAt: d,
        history: [
          {
            at: stamp,
            by: actor,
            action: `Duplicada desde ${src.reference}`,
          },
        ],
      }
      setQuotations((prev) => [q, ...prev])
      persistQuoteNow(q)
      return code
    },
    [quotations, user, persistQuoteNow],
  )

  const archiveQuotation = useCallback(
    (id: string) => {
      updateQuotation(id, { status: "closed" }, "Archivó cotización")
    },
    [updateQuotation],
  )

  const deleteDraftQuotation = useCallback(
    (id: string): { ok: true } | { ok: false; error: string } => {
      const q = quotations.find((x) => x.id === id)
      if (!q) return { ok: false, error: "Cotización no encontrada" }
      if (q.status !== "draft") {
        return { ok: false, error: "Solo se pueden borrar borradores" }
      }
      if (quotationIsTrashed(q)) {
        return { ok: false, error: "Ese borrador ya está en Eliminados" }
      }
      if (user?.role === "empleado" && q.createdById !== user.id) {
        return { ok: false, error: "Solo puedes borrar tus propios borradores" }
      }
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const nextQuotations = quotations.map((x) =>
        x.id === id
          ? {
              ...x,
              deletedAt: new Date().toISOString(),
              updatedAt: stamp,
              history: [...x.history, { at: stamp, by: actor, action: "Envió a eliminados" }],
            }
          : x,
      )
      setQuotations(nextQuotations)
      const updated = nextQuotations.find((x) => x.id === id)
      if (updated) persistQuoteNow(updated)
      flushPublish({ quotations: nextQuotations })
      return { ok: true }
    },
    [quotations, user, flushPublish, persistQuoteNow],
  )

  const restoreDraftQuotation = useCallback(
    (id: string): { ok: true } | { ok: false; error: string } => {
      const q = quotations.find((x) => x.id === id)
      if (!q) return { ok: false, error: "Cotización no encontrada" }
      if (!quotationIsTrashed(q)) {
        return { ok: false, error: "Ese borrador no está en Eliminados" }
      }
      if (user?.role === "empleado" && q.createdById !== user.id) {
        return { ok: false, error: "Solo puedes recuperar tus propios borradores" }
      }
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const nextQuotations = quotations.map((x) =>
        x.id === id
          ? {
              ...x,
              deletedAt: undefined,
              updatedAt: stamp,
              history: [...x.history, { at: stamp, by: actor, action: "Recuperó de eliminados" }],
            }
          : x,
      )
      setQuotations(nextQuotations)
      const updated = nextQuotations.find((x) => x.id === id)
      if (updated) persistQuoteNow(updated)
      flushPublish({ quotations: nextQuotations })
      return { ok: true }
    },
    [quotations, user, flushPublish, persistQuoteNow],
  )

  const purgeExpiredTrashedDrafts = useCallback(() => {
    setQuotations((prev) => {
      const expired = prev.filter((q) => quotationTrashExpired(q))
      const next = prev.filter((q) => !quotationTrashExpired(q))
      if (next.length === prev.length) return prev
      for (const q of expired) {
        void deleteAllVisitPhotosRequest(q.id)
        if (isSupabaseConfigured()) {
          void trackPersist(`quote-del:${q.id}`, () => deleteQuotationRow(q.id))
        }
      }
      queueMicrotask(() => flushPublishRef.current({ quotations: next }))
      return next
    })
  }, [])

  const uploadVisitPhotos = useCallback(
    async (quotationId: string, files: File[]) => {
      const current = quotations.find((q) => q.id === quotationId)
      if (!current) return { ok: false as const, error: "Cotización no encontrada." }
      const have = current.visitPhotos?.length ?? 0
      const room = VISIT_PHOTO_MAX - have
      if (room <= 0) {
        return { ok: false as const, error: `Máximo ${VISIT_PHOTO_MAX} fotos por cotización.` }
      }
      const slice = files.slice(0, room)
      const added: VisitPhoto[] = []
      for (const file of slice) {
        try {
          const compressed = await compressVisitImage(file)
          const posted = await postVisitPhoto({
            quotationId,
            full: compressed.full,
            thumb: compressed.thumb,
            width: compressed.width,
            height: compressed.height,
            uploadedById: user?.id ?? "system",
            uploadedBy: user?.name ?? "Usuario",
          })
          if (!posted.ok) return { ok: false as const, error: posted.error }
          added.push(posted.photo)
        } catch (err) {
          const msg = err instanceof Error ? err.message : "No se pudo comprimir la foto."
          return { ok: false as const, error: msg }
        }
      }
      setQuotations((prev) =>
        prev.map((q) => {
          if (q.id !== quotationId) return q
          const merged = [...(q.visitPhotos ?? [])]
          for (const p of added) {
            if (!merged.some((x) => x.id === p.id)) merged.push(p)
          }
          return { ...q, visitPhotos: merged }
        }),
      )
      return { ok: true as const, photos: added }
    },
    [quotations, user],
  )

  const hydrateVisitPhotos = useCallback((quotationId: string, nextPhotos: VisitPhoto[]) => {
    setQuotations((prev) => {
      const current = prev.find((q) => q.id === quotationId)
      if (!current) return prev
      const a = (current.visitPhotos ?? []).map((p) => p.id).sort().join("|")
      const b = nextPhotos.map((p) => p.id).sort().join("|")
      if (a === b) return prev
      return prev.map((q) => (q.id === quotationId ? { ...q, visitPhotos: nextPhotos } : q))
    })
  }, [])

  const removeVisitPhoto = useCallback(async (quotationId: string, photoId: string) => {
    const res = await deleteVisitPhotoRequest(quotationId, photoId)
    if (!res.ok) return res
    setQuotations((prev) =>
      prev.map((q) =>
        q.id === quotationId
          ? { ...q, visitPhotos: (q.visitPhotos ?? []).filter((p) => p.id !== photoId) }
          : q,
      ),
    )
    return { ok: true as const }
  }, [])

  const createProjectFromQuotation = useCallback(
    (quotationId: string) => {
      const quote = quotations.find((q) => q.id === quotationId)
      if (!quote) return null

      const existing = projects.find(
        (p) => p.quotationId === quotationId || p.id === quotationId,
      )
      if (existing) return existing.id

      // Folio único: el proyecto hereda el número de la cotización
      const id = quote.reference || quote.id
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const project: Project = {
        id,
        quotationId,
        stage: "procesando_solicitud",
        installments: [],
        createdAt: d,
        updatedAt: d,
        history: [
          {
            at: stamp,
            by: actor,
            action: "Proyecto creado desde cotización aprobada",
          },
        ],
      }
      setProjects((prev) => {
        if (prev.some((p) => p.quotationId === quotationId || p.id === id)) return prev
        return [project, ...prev]
      })
      persistProjectNow(project)
      announce(`${actor} · Nuevo proyecto ${id}`, "except_self", {
        id: `project-new-${id}`,
        kind: "activity",
        title: "Nuevo proyecto",
        body: `${id} · ${quote.title}`,
        href: { name: "project", id },
      })
      return id
    },
    [quotations, projects, user, announce, persistProjectNow],
  )

  const setClientResponse = useCallback(
    (id: string, response: ClientResponse) => {
      const result = updateQuotation(
        id,
        { clientResponse: response },
        `Cliente: ${CLIENT_RESPONSE_META[response].label}`,
      )
      if (!result.ok) return result
      if (response === "aprobada") {
        const projectId = createProjectFromQuotation(id)
        return { ok: true as const, projectId: projectId ?? undefined }
      }
      return { ok: true as const }
    },
    [updateQuotation, createProjectFromQuotation],
  )

  const createManualProject = useCallback(
    (input: {
      title: string
      clientId: string
      departments?: WorkDepartment[]
      totalDue: number
      notes?: string
      stage?: ProjectStage
      dueDate?: string
    }) => {
      const id = nextProjectCode(projects.map((p) => p.id))
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const stage = input.stage ?? "en_proceso"
      const dueDate = input.dueDate?.trim() || undefined
      const project: Project = {
        id,
        title: input.title.trim(),
        clientId: input.clientId,
        departments: input.departments?.length ? input.departments : undefined,
        totalDue: input.totalDue,
        notes: input.notes?.trim() || undefined,
        createdById: user?.id,
        stage,
        dueDate,
        installments: [],
        createdAt: d,
        updatedAt: d,
        history: [
          {
            at: stamp,
            by: actor,
            action: `Proyecto cargado · ${PROJECT_STAGE_META[stage].label}`,
          },
        ],
      }
      setProjects((prev) => [project, ...prev])
      persistProjectNow(project)
      announce(`${actor} · Proyecto cargado ${id}`, "except_self", {
        id: `project-new-${id}`,
        kind: "activity",
        title: "Proyecto cargado",
        body: `${id} · ${input.title.trim()}`,
        href: { name: "project", id },
      })
      return id
    },
    [projects, user, announce, persistProjectNow],
  )

  const updateProject = useCallback(
    (id: string, patch: Partial<Project>, historyAction?: string) => {
      const current = projects.find((p) => p.id === id)
      if (!current) return

      const nextDue = patch.dueDate !== undefined ? patch.dueDate : current.dueDate
      const nextDelivered =
        patch.deliveredAt !== undefined ? patch.deliveredAt : current.deliveredAt
      const nextNotes = patch.notes !== undefined ? patch.notes : current.notes
      const changed =
        (patch.dueDate !== undefined &&
          (patch.dueDate || undefined) !== (current.dueDate || undefined)) ||
        (patch.deliveredAt !== undefined &&
          (patch.deliveredAt || undefined) !== (current.deliveredAt || undefined)) ||
        (patch.notes !== undefined &&
          (patch.notes || undefined) !== (current.notes || undefined)) ||
        (patch.stage !== undefined && patch.stage !== current.stage) ||
        (patch.paymentMode !== undefined && patch.paymentMode !== current.paymentMode) ||
        (patch.title !== undefined && patch.title !== current.title) ||
        (patch.totalDue !== undefined && patch.totalDue !== current.totalDue)

      if (!changed) return

      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p
          const next = {
            ...p,
            ...patch,
            dueDate: nextDue,
            deliveredAt: nextDelivered,
            notes: nextNotes,
            updatedAt: d,
            history: historyAction
              ? [...p.history, { at: stamp, by: actor, action: historyAction }]
              : p.history,
          }
          persistProjectNow(next)
          return next
        }),
      )
      // Sin ticker: guardar fechas/notas no debe avisar a otros admins.
    },
    [user, projects, persistProjectNow],
  )

  const setProjectStage = useCallback(
    (id: string, stage: ProjectStage) => {
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const label = PROJECT_STAGE_META[stage].label
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p
          const deliveredAt =
            stage === "completado" ? (p.deliveredAt ?? d) : p.deliveredAt
          const next = {
            ...p,
            stage,
            deliveredAt,
            updatedAt: d,
            history: [...p.history, { at: stamp, by: actor, action: `Etapa → ${label}` }],
          }
          persistProjectNow(next)
          return next
        }),
      )
      announce(
        stage === "completado"
          ? `${actor} · Proyecto ${id} completado`
          : `${actor} · ${id} · ${label}`,
        "except_self",
        {
          id: `stage-${id}-${stage}-${stamp}`,
          kind: "activity",
          title: stage === "completado" ? "Proyecto completado" : `Etapa: ${label}`,
          body: `${id} · ${actor}`,
          href: { name: "project", id },
        },
      )
    },
    [user, announce],
  )

  const setProjectPaymentMode = useCallback(
    (projectId: string, mode: PaymentMode) => {
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const label =
        mode === "unico" ? "pago en una sola exhibición" : "pago en parcialidades"
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          const next = {
            ...p,
            paymentMode: mode,
            installments: (p.installments ?? []).map((inst) => ({
              ...inst,
              paymentComplement:
                mode === "unico"
                  ? "na"
                  : inst.paymentComplement === "sent"
                    ? "sent"
                    : "pending",
            })),
            updatedAt: d,
            history: [
              ...p.history,
              { at: stamp, by: actor, action: `Plan de cobro: ${label}` },
            ],
          }
          persistProjectNow(next)
          return next
        }),
      )
      announce(`${actor} · Plan de cobro (${label}) · ${projectId}`, "except_self", {
        id: `paymode-${projectId}-${stamp}`,
        kind: "activity",
        title: "Plan de cobro actualizado",
        body: `${projectId} · ${label}`,
        href: { name: "project", id: projectId },
      })
    },
    [user, announce],
  )

  const addProjectInstallment = useCallback(
    (
      projectId: string,
      installment: Omit<ProjectInstallment, "id" | "paidAt">,
    ) => {
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const amountLabel = installment.amount.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
      })
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          const entry: ProjectInstallment = {
            ...installment,
            paymentComplement:
              installment.paymentComplement ?? defaultPaymentComplement(p.paymentMode),
            invoiceUuid: installment.invoiceUuid?.trim() || undefined,
            invoiceDate: installment.invoiceDate || undefined,
            id: `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          }
          const next = {
            ...p,
            installments: [...(p.installments ?? []), entry],
            updatedAt: d,
            history: [
              ...p.history,
              {
                at: stamp,
                by: actor,
                action: `Cuota programada: ${amountLabel} · ${installment.dueDate}`,
              },
            ],
          }
          persistProjectNow(next)
          return next
        }),
      )
      announce(`${actor} · Cuota ${amountLabel} programada · ${projectId}`, "except_self", {
        id: `inst-add-${projectId}-${stamp}`,
        kind: "activity",
        title: "Cuota programada",
        body: `${projectId} · ${amountLabel}`,
        href: { name: "project", id: projectId },
      })
    },
    [user, announce],
  )

  const updateProjectInstallment = useCallback(
    (
      projectId: string,
      installmentId: string,
      patch: Partial<
        Pick<
          ProjectInstallment,
          | "amount"
          | "dueDate"
          | "note"
          | "invoiceUuid"
          | "invoiceDate"
          | "paymentComplement"
          | "method"
        >
      >,
    ) => {
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      let historyAction: string | null = null
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          const next = {
            ...p,
            installments: (p.installments ?? []).map((inst) => {
              if (inst.id !== installmentId) return inst
              const paid = !!inst.paidAt
              const next: ProjectInstallment = { ...inst }
              const changed: string[] = []

              if (patch.invoiceUuid !== undefined) {
                const uuid = patch.invoiceUuid.trim() || undefined
                if (uuid !== inst.invoiceUuid) {
                  next.invoiceUuid = uuid
                  changed.push("CFDI")
                }
              }
              if (patch.invoiceDate !== undefined) {
                const date = patch.invoiceDate || undefined
                if (date !== inst.invoiceDate) {
                  next.invoiceDate = date
                  changed.push("día generada")
                }
              }
              if (patch.paymentComplement !== undefined) {
                if (patch.paymentComplement !== inst.paymentComplement) {
                  next.paymentComplement = patch.paymentComplement
                  changed.push("complemento")
                }
              }
              if (patch.method !== undefined) {
                if (patch.method !== inst.method) {
                  next.method = patch.method
                  changed.push("medio de cobro")
                }
              }
              if (patch.note !== undefined) {
                const note = patch.note.trim() || undefined
                if (note !== inst.note) {
                  next.note = note
                  changed.push("nota")
                }
              }
              // Monto / fecha de plan: solo si aún no está cobrada
              if (!paid) {
                if (patch.amount !== undefined && patch.amount !== inst.amount) {
                  next.amount = patch.amount
                  changed.push("monto")
                }
                if (patch.dueDate !== undefined && patch.dueDate !== inst.dueDate) {
                  next.dueDate = patch.dueDate
                  changed.push("fecha")
                }
              }

              if (changed.length > 0) {
                historyAction = `Actualizó abono: ${changed.join(" / ")}`
              }
              return next
            }),
            updatedAt: historyAction ? d : p.updatedAt,
            history: historyAction
              ? [...p.history, { at: stamp, by: actor, action: historyAction }]
              : p.history,
          }
          persistProjectNow(next)
          return next
        }),
      )
    },
    [user, persistProjectNow],
  )

  const removeProjectInstallment = useCallback(
    (projectId: string, installmentId: string) => {
      const project = projects.find((p) => p.id === projectId)
      const target = project?.installments?.find((x) => x.id === installmentId)
      if (!target) return { ok: false as const, error: "Cuota no encontrada." }
      if (target.paidAt) {
        return {
          ok: false as const,
          error: "No se puede eliminar un abono cobrado. Registra una nota de corrección.",
        }
      }
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const amountLabel = target.amount.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
      })
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          const next = {
            ...p,
            installments: (p.installments ?? []).filter((x) => x.id !== installmentId),
            updatedAt: d,
            history: [
              ...p.history,
              { at: stamp, by: actor, action: `Cuota eliminada: ${amountLabel}` },
            ],
          }
          persistProjectNow(next)
          return next
        }),
      )
      announce(`${actor} · Cuota eliminada · ${projectId}`, "except_self", {
        id: `inst-del-${projectId}-${stamp}`,
        kind: "activity",
        title: "Cuota eliminada",
        body: `${projectId} · ${amountLabel}`,
        href: { name: "project", id: projectId },
      })
      return { ok: true as const }
    },
    [user, announce, projects],
  )

  const markInstallmentPaid = useCallback(
    (
      projectId: string,
      installmentId: string,
      input: { paidAt: string; method: PaymentMethod },
    ) => {
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const project = projects.find((p) => p.id === projectId)
      const target = project?.installments?.find((x) => x.id === installmentId)
      if (!target || target.paidAt) return
      const amountLabel = formatMoneyShort(target.amount)
      const event: PaymentEvent = {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        installmentId,
        kind: "collected",
        amount: target.amount,
        method: input.method,
        paidAt: input.paidAt,
        at: stamp,
        by: actor,
      }
      setPaymentEvents((prev) => [event, ...prev])
      if (isSupabaseConfigured()) {
        void trackPersist(`pay:${event.id}`, () => persistPaymentEvent(event, userAuthIdRef.current))
      }
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          const next = {
            ...p,
            installments: (p.installments ?? []).map((inst) =>
              inst.id === installmentId
                ? { ...inst, paidAt: input.paidAt, method: input.method }
                : inst,
            ),
            updatedAt: d,
            history: [
              ...p.history,
              {
                at: stamp,
                by: actor,
                action: `Abono cobrado: ${amountLabel} (evento ${event.id})`,
              },
            ],
          }
          persistProjectNow(next)
          return next
        }),
      )
      announce(`${actor} · Abono ${amountLabel} cobrado · ${projectId}`, "except_self", {
        id: `pay-${event.id}`,
        kind: "activity",
        title: "Abono cobrado",
        body: `${projectId} · ${amountLabel}`,
        href: { name: "project", id: projectId },
      })
    },
    [user, announce, projects],
  )

  const addPaymentCorrectionNote = useCallback(
    (projectId: string, installmentId: string, note: string) => {
      const trimmed = note.trim()
      if (!trimmed) return
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"
      const project = projects.find((p) => p.id === projectId)
      const target = project?.installments?.find((x) => x.id === installmentId)
      if (!target?.paidAt) return
      const event: PaymentEvent = {
        id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        projectId,
        installmentId,
        kind: "correction_note",
        amount: target.amount,
        method: target.method,
        paidAt: target.paidAt,
        note: trimmed,
        at: stamp,
        by: actor,
      }
      setPaymentEvents((prev) => [event, ...prev])
      if (isSupabaseConfigured()) {
        void trackPersist(`pay:${event.id}`, () => persistPaymentEvent(event, userAuthIdRef.current))
      }
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p
          const next = {
            ...p,
            updatedAt: today(),
            history: [
              ...p.history,
              { at: stamp, by: actor, action: `Nota de corrección de cobro: ${trimmed}` },
            ],
          }
          persistProjectNow(next)
          return next
        }),
      )
      announce(`${actor} · Nota de cobro · ${projectId}`, "except_self", {
        id: `pay-note-${event.id}`,
        kind: "activity",
        title: "Nota de cobro",
        body: `${projectId} · ${trimmed}`,
        href: { name: "project", id: projectId },
      })
    },
    [user, announce, projects],
  )

  const projectByQuotationId = useCallback(
    (quotationId: string) => projects.find((p) => p.quotationId === quotationId),
    [projects],
  )

  const addCatalogItem = useCallback(
    async (item: Omit<CatalogItem, "id"> & { id?: string }) => {
      if (user?.role === "empleado" && item.kind !== "extra") {
        return {
          ok: false as const,
          error: "Solo administración puede crear materiales o mano de obra.",
        }
      }
      const fallbackId = nextCatalogCode(
        catalog.map((c) => c.id),
        item.kind,
        item.category,
      )
      const id =
        item.id ??
        (isSupabaseConfigured()
          ? ((await nextServerCode(catalogRpcKind(item.kind, item.category))) ?? fallbackId)
          : fallbackId)
      const next: CatalogItem = {
        ...item,
        id,
        sku: item.sku?.trim() ?? "",
        unitCost: user?.role === "empleado" ? 0 : item.unitCost,
        supplierId: item.kind === "material" ? item.supplierId || undefined : undefined,
      }
      if (catalog.some((c) => c.id === id)) {
        return { ok: false as const, error: "Ese código de catálogo ya existe." }
      }
      if (isSupabaseConfigured()) {
        if (next.kind === "extra" && user?.role !== "admin") {
          const supabase = getSupabaseBrowser()
          const token = (await supabase.auth.getSession()).data.session?.access_token
          if (!token) return { ok: false as const, error: "Sesión inválida. Cierra sesión y vuelve a entrar." }
          let saved: CatalogItem | undefined
          const extraRes = await trackPersist(`catalog:${next.id}`, async () => {
            const res = await fetch("/api/catalog/extras", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                id: next.id,
                name: next.name,
                unit: next.unit,
                sku: next.sku,
                category: next.category,
                unitCost: next.unitCost,
              }),
              signal: AbortSignal.timeout(20_000),
            })
            const json = (await res.json().catch(() => null)) as
              | { ok: true; id: string; item?: CatalogItem }
              | { ok: false; error: string }
              | null
            if (!json || !json.ok) {
              return { ok: false as const, error: json && "error" in json ? json.error : "No se pudo crear el extra." }
            }
            saved = json.item ?? { ...next, id: json.id }
            return { ok: true as const }
          })
          if (!extraRes.ok) {
            return { ok: false as const, error: extraRes.error || "No se pudo crear el extra." }
          }
          const item = saved ?? next
          setCatalog((prev) => [item, ...prev])
          return { ok: true as const, id: item.id }
        }
        const res = await trackPersist(`catalog:${next.id}`, () => persistCatalogItem(next))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el catálogo." }
      }
      setCatalog((prev) => [next, ...prev])
      return { ok: true as const, id }
    },
    [catalog, user?.role, trackPersist],
  )

  const updateCatalogItem = useCallback(
    async (id: string, patch: Partial<CatalogItem>) => {
      const current = catalog.find((c) => c.id === id)
      if (!current) return { ok: false as const, error: "Ítem no encontrado." }
      const next = { ...current, ...patch, id: current.id }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`catalog:${next.id}`, () => persistCatalogItem(next))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el catálogo." }
      }
      setCatalog((prev) => prev.map((c) => (c.id !== id ? c : next)))
      return { ok: true as const }
    },
    [catalog, trackPersist],
  )

  const removeCatalogItem = useCallback(async (id: string) => {
    if (isSupabaseConfigured()) {
      const res = await trackPersist(`catalog-del:${id}`, () => deleteCatalogItem(id))
      if (!res.ok) return { ok: false as const, error: res.error || "No se pudo eliminar del catálogo." }
    }
    setCatalog((prev) => prev.filter((c) => c.id !== id))
    return { ok: true as const }
  }, [trackPersist])

  const addDepartment = useCallback(
    async (input: { label: string; short?: string; colorId?: DepartmentColorId }) => {
      const label = input.label.trim()
      if (!label) return { ok: false as const, error: "Escribe el nombre del departamento." }
      const id = departmentIdFromLabel(
        label,
        departments.map((d) => d.id),
      )
      const dept: DepartmentConfig = {
        id,
        label,
        short: (input.short?.trim() || shortDepartmentLabel(label)),
        colorId: normalizeDepartmentColorId(input.colorId ?? "azul"),
      }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`dept:${dept.id}`, () => persistDepartment(dept))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el departamento." }
      }
      setDepartments((prev) => [...prev, dept])
      return { ok: true as const, id }
    },
    [departments, trackPersist],
  )

  const updateDepartment = useCallback(
    async (id: WorkDepartment, patch: Partial<Omit<DepartmentConfig, "id">>) => {
      const current = departments.find((d) => d.id === id)
      if (!current) return { ok: false as const, error: "Departamento no encontrado." }
      const next: DepartmentConfig = { ...current, ...patch }
      if (patch.label && !patch.short) {
        next.short = shortDepartmentLabel(patch.label)
      }
      if (patch.colorId) {
        next.colorId = normalizeDepartmentColorId(patch.colorId)
      }
      if (isSupabaseConfigured()) {
        const res = await trackPersist(`dept:${next.id}`, () => persistDepartment(next))
        if (!res.ok) return { ok: false as const, error: res.error || "No se pudo guardar el departamento." }
      }
      setDepartments((prev) => prev.map((d) => (d.id === id ? next : d)))
      return { ok: true as const }
    },
    [departments, trackPersist],
  )

  const removeDepartment = useCallback(
    (id: WorkDepartment) => {
      const usedByQuotes = quotations.some((q) => quotationHasDepartment(q, id))
      const usedByUsers = users.some((u) => u.department === id)
      if (usedByQuotes || usedByUsers) {
        const parts = [
          usedByQuotes ? "cotizaciones" : null,
          usedByUsers ? "usuarios" : null,
        ].filter(Boolean)
        return {
          ok: false as const,
          error: `No se puede eliminar: hay ${parts.join(" y ")} asignados a este departamento.`,
        }
      }
      if (departments.length <= 1) {
        return { ok: false as const, error: "Debe existir al menos un departamento." }
      }
      setDepartments((prev) => prev.filter((d) => d.id !== id))
      if (isSupabaseConfigured()) {
        void trackPersist(`dept-del:${id}`, () => deleteDepartment(id))
      }
      return { ok: true as const }
    },
    [quotations, users, departments.length, trackPersist],
  )

  const value = useMemo(
    () => ({
      authed: !!user,
      authReady,
      mustSetPassword,
      user,
      users,
      clients,
      suppliers,
      catalog,
      quotations,
      projects,
      departments,
      paymentEvents,
      inboxEvents,
      expenses,
      treasuryMonths,
      treasurySeparados,
      apartadoMovements,
      settings,
      liveNotice,
      dismissLiveNotice,
      syncStatus,
      saveStatus,
      saveError,
      markSaving,
      retrySave,
      updateSettings,
      login,
      logout,
      requestPasswordReset,
      completePasswordSetup,
      refreshUsers,
      inviteUser,
      deleteUser,
      upsertUser,
      updateProfile,
      updateUser,
      uploadProfilePhoto,
      removeProfilePhoto,
      addClient,
      updateClient,
      removeClient,
      addSupplier,
      updateSupplier,
      removeSupplier,
      addDepartment,
      updateDepartment,
      removeDepartment,
      addExpense,
      updateExpense,
      removeExpense,
      setTreasuryMonth,
      addTreasurySeparado,
      updateTreasurySeparado,
      removeTreasurySeparado,
      addApartadoMovement,
      removeApartadoMovement,
      createQuotation,
      updateQuotation,
      setStatus,
      submitForReview,
      setClientResponse,
      duplicateQuotation,
      archiveQuotation,
      deleteDraftQuotation,
      restoreDraftQuotation,
      purgeExpiredTrashedDrafts,
      uploadVisitPhotos,
      removeVisitPhoto,
      hydrateVisitPhotos,
      createProjectFromQuotation,
      createManualProject,
      updateProject,
      setProjectStage,
      setProjectPaymentMode,
      addProjectInstallment,
      updateProjectInstallment,
      removeProjectInstallment,
      markInstallmentPaid,
      addPaymentCorrectionNote,
      projectByQuotationId,
      addCatalogItem,
      updateCatalogItem,
      removeCatalogItem,
    }),
    [
      user,
      authReady,
      mustSetPassword,
      users,
      clients,
      suppliers,
      catalog,
      quotations,
      projects,
      departments,
      paymentEvents,
      inboxEvents,
      expenses,
      treasuryMonths,
      treasurySeparados,
      apartadoMovements,
      settings,
      liveNotice,
      dismissLiveNotice,
      syncStatus,
      saveStatus,
      saveError,
      markSaving,
      retrySave,
      updateSettings,
      login,
      logout,
      requestPasswordReset,
      completePasswordSetup,
      refreshUsers,
      inviteUser,
      deleteUser,
      upsertUser,
      updateProfile,
      updateUser,
      uploadProfilePhoto,
      removeProfilePhoto,
      addClient,
      updateClient,
      removeClient,
      addSupplier,
      updateSupplier,
      removeSupplier,
      addDepartment,
      updateDepartment,
      removeDepartment,
      addExpense,
      updateExpense,
      removeExpense,
      setTreasuryMonth,
      addTreasurySeparado,
      updateTreasurySeparado,
      removeTreasurySeparado,
      addApartadoMovement,
      removeApartadoMovement,
      createQuotation,
      updateQuotation,
      setStatus,
      submitForReview,
      setClientResponse,
      duplicateQuotation,
      archiveQuotation,
      deleteDraftQuotation,
      restoreDraftQuotation,
      purgeExpiredTrashedDrafts,
      uploadVisitPhotos,
      removeVisitPhoto,
      hydrateVisitPhotos,
      createProjectFromQuotation,
      createManualProject,
      updateProject,
      setProjectStage,
      setProjectPaymentMode,
      addProjectInstallment,
      updateProjectInstallment,
      removeProjectInstallment,
      markInstallmentPaid,
      addPaymentCorrectionNote,
      projectByQuotationId,
      addCatalogItem,
      updateCatalogItem,
      removeCatalogItem,
    ],
  )

  return <TechnikContext.Provider value={value}>{children}</TechnikContext.Provider>
}

export function useTechnik() {
  const ctx = useContext(TechnikContext)
  if (!ctx) throw new Error("useTechnik must be used within TechnikProvider")
  return ctx
}

export function useIsAdmin() {
  return useTechnik().user?.role === "admin"
}

export function useCanSeeCosts() {
  return useTechnik().user?.role === "admin"
}

// ─── Derived calculations ───────────────────────────────────────

export function quoteTotals(q: Quotation, catalog: CatalogItem[]) {
  let materialCost = 0
  let materialCharge = 0
  let extrasCost = 0
  let extrasCharge = 0
  let laborBase = 0
  let laborCharge = 0
  let laborHours = 0

  for (const line of q.lines) {
    const item = catalog.find((c) => c.id === line.itemId)
    if (!item) continue
    const sell = line.unitPrice ?? suggestedPrice(item)
    if (item.kind === "labor") {
      laborBase += item.unitCost * line.quantity
      laborCharge += sell * line.quantity
      laborHours += line.quantity
    } else if (item.kind === "extra") {
      extrasCost += item.unitCost * line.quantity
      extrasCharge += sell * line.quantity
    } else {
      materialCost += item.unitCost * line.quantity
      materialCharge += sell * line.quantity
    }
  }

  const laborBurden = Number((laborBase * LABOR_BURDEN_RATE).toFixed(2))
  const laborCost = Number((laborBase + laborBurden).toFixed(2))
  const eco = internalEconomy(q, catalog)
  const total = materialCharge + extrasCharge + laborCharge
  const loadedCost = eco.loadedCostTotal
  const margin = total - loadedCost
  const marginPct = total > 0 ? (margin / total) * 100 : 0
  return {
    materialCost,
    materialCharge,
    extrasCost,
    extrasCharge,
    laborCost,
    laborBase,
    laborBurden,
    laborCharge,
    laborHours,
    loadedCost,
    total,
    margin,
    marginPct,
  }
}

/**
 * Totales del PDF al cliente (mismo criterio que la cotización impresa):
 * Total parcial = Σ (cant × p.unitario)
 * Subtotal = Total parcial
 * IVA = Subtotal × tasa IVA
 * Retención ISR = Subtotal × tasa ISR
 * TOTAL MXN = Subtotal + IVA − Retención ISR
 *
 * Cada importe se redondea a 2 decimales (centavos) antes de sumar/restar.
 */
export function publicQuoteTotals(
  items: PublicQuoteItem[],
  taxRate = DEFAULT_TAX_RATE,
  isrRetentionRate = DEFAULT_ISR_RETENTION_RATE,
) {
  const rateIva = Number.isFinite(taxRate) ? taxRate : 0
  const rateIsr = Number.isFinite(isrRetentionRate) ? isrRetentionRate : 0

  const partial = roundMxn(
    items.reduce((sum, it) => sum + lineTotalMxn(it.quantity, it.unitPrice), 0),
  )
  const subtotal = partial
  const tax = roundMxn(subtotal * rateIva)
  const isrRetention = roundMxn(subtotal * rateIsr)
  const total = roundMxn(subtotal + tax - isrRetention)

  return {
    partial,
    subtotal,
    tax,
    isrRetention,
    total,
    taxRate: rateIva,
    isrRetentionRate: rateIsr,
  }
}

export function roleLabel(role: Role): string {
  return role === "admin" ? "Administrador" : "Colaborador"
}
