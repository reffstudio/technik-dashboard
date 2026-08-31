"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
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
  canRestoreQuotation,
  canTrashQuotation,
  canTrashProject,
  quotationIsTrashed,
  quotationTrashExpired,
  projectTrashExpired,
  quotationCoverUrl,
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
  promoteInboxQueuedDrafts,
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
  persistQuotationDeletedAt,
  loadQuotations,
  quotesSignature,
  readOpsBackup,
  writeOpsBackup,
} from "./quotation-persist"
import {
  deleteApartadoMovementRow,
  deleteExpenseRow,
  deleteSeparadoRow,
  deleteProjectRow,
  enqueuePersistProject,
  persistProjectDeletedAt,
  loadOpsWorkspace,
  persistApartadoMovement,
  persistExpense,
  persistInboxEvent,
  persistPaymentEvent,
  persistSeparado,
  persistTreasuryMonth,
} from "./ops-persist"
import {
  displayPersistError,
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
  }) => Promise<string>
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
  duplicateQuotation: (id: string) => Promise<string | null>
  archiveQuotation: (id: string) => void
  /** Manda una cotización a Eliminados (15 días). Si hay proyecto ligado, va junto. */
  deleteDraftQuotation: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  restoreDraftQuotation: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  trashProject: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  restoreProject: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
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
  createProjectFromQuotation: (quotationId: string, quoteSnapshot?: Quotation) => string | null
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

/** Marca de tiempo para historial (ISO, comparable entre cliente y Supabase). */
function nowStamp() {
  return new Date().toISOString()
}

/** updatedAt de cotización: mismo formato que carga Supabase (evita re-guardar en bucle). */
function fieldStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ")
}

export function TechnikProvider({
  children,
  supabase,
}: {
  children: ReactNode
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
  const quotationsRef = useRef<Quotation[]>([])
  quotationsRef.current = quotations
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
  const lastAnnouncedInboxIdRef = useRef("")
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
      let res: PersistResult = { ok: false, error: "No se pudo guardar." }
      try {
        res = await runWithRetries(job)
        return res
      } catch (err) {
        res = { ok: false, error: displayPersistError(err instanceof Error ? err.message : undefined) }
        return res
      } finally {
        savePendingRef.current = Math.max(0, savePendingRef.current - 1)
        if (res.ok) {
          if (saveJobsRef.current.get(key) === job) saveJobsRef.current.delete(key)
          if (savePendingRef.current === 0 && saveJobsRef.current.size === 0) {
            saveDirtyRef.current = false
            setSaveStatus("saved")
          } else if (savePendingRef.current > 0) {
            setSaveStatus("saving")
          }
        } else if (persistFailedOffline(res)) {
          setSaveStatus("offline")
        } else if (key.startsWith("inbox:")) {
          console.warn("[technik] Aviso de bandeja no se pudo guardar", res.error)
          if (saveJobsRef.current.get(key) === job) saveJobsRef.current.delete(key)
          if (savePendingRef.current === 0 && saveJobsRef.current.size === 0) {
            saveDirtyRef.current = false
            setSaveStatus("saved")
          }
        } else {
          const message = displayPersistError(res.error)
          console.warn("[technik] No se pudo guardar", key, message)
          setSaveError(message)
          setSaveStatus("error")
        }
      }
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
        const inboxEvent = {
          id: inbox.id ?? `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: inbox.kind,
          title: inbox.title,
          body: inbox.body,
          at: inbox.at ?? new Date().toISOString(),
          href: inbox.href,
        }
        pendingInboxRef.current = inboxEvent
        if (isSupabaseConfigured()) {
          lastAnnouncedInboxIdRef.current = inboxEvent.id
          void trackPersist(`inbox:${inboxEvent.id}`, () => persistInboxEvent(inboxEvent))
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

  const persistQuoteNowAsync = useCallback(
    async (q: Quotation) => {
      try {
        if (!q?.id) {
          return { ok: false as const, error: "Cotización sin folio.", id: "" }
        }
        if (!isSupabaseConfigured()) return { ok: true as const, id: q.id }
        let id = q.id
        const res = await trackPersist(`quote:${q.id}`, async () => {
          try {
            const saved = await enqueuePersistQuotation(q, {
              actorAuthId: userAuthIdRef.current || undefined,
              users: workspaceRef.current.users.filter(Boolean),
              isAdmin: userRoleRef.current === "admin",
            })
            if (!saved?.ok) {
              return {
                ok: false as const,
                error: displayPersistError(
                  saved && "error" in saved && saved.error
                    ? saved.error
                    : "No se pudo guardar la cotización.",
                ),
              }
            }
            id = saved.id || q.id
            return { ok: true as const }
          } catch (err) {
            return {
              ok: false as const,
              error: displayPersistError(err instanceof Error ? err.message : undefined),
            }
          }
        })
        if (res?.ok && id && id !== q.id) {
          const remap = (list: Quotation[]) =>
            list
              .filter((x) => x?.id)
              .map((x) => (x.id === q.id ? { ...x, id, reference: id } : x))
          setQuotations((prev) => remap(prev))
          quotationsRef.current = remap(quotationsRef.current)
        }
        if (!res?.ok) {
          return {
            ok: false as const,
            error: displayPersistError(res?.error || "No se pudo guardar la cotización."),
            id,
          }
        }
        return { ok: true as const, id }
      } catch (err) {
        return {
          ok: false as const,
          error: displayPersistError(err instanceof Error ? err.message : undefined),
          id: q?.id || "",
        }
      }
    },
    [trackPersist],
  )

  const persistQuoteNow = useCallback(
    (q: Quotation) => {
      void persistQuoteNowAsync(q)
    },
    [persistQuoteNowAsync],
  )

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
    // Con Supabase el hub no es fuente de verdad (Realtime + tablas).
    if (isSupabaseConfigured()) {
      return
    }
    setUsers(snapshot.users)
    setClients(
      snapshot.clients.map((c) => ({
        ...c,
        rfc: (c as Client).rfc ?? "",
        ccEmails: (c as Client).ccEmails ?? [],
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
        snapshot.projects.map((p) => normalizeProject(p)).filter((p) => !projectTrashExpired(p)),
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
      if (isSupabaseConfigured()) {
        pendingMessageRef.current = undefined
        pendingAudienceRef.current = "except_self"
        pendingInboxRef.current = undefined
        queuedOverridesRef.current = null
        needsRepublishRef.current = false
        return
      }

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

  // Hidratar desde Supabase (Realtime + poll de respaldo). Sin DB, el hub mock.
  useEffect(() => {
    let cancelled = false
    const supabaseMode = isSupabaseConfigured()

    const pullFromSupabase = async () => {
      if (!supabaseMode) return
      const quotesRes = await loadQuotations(workspaceRef.current.users)
      if (cancelled) return
      if (quotesRes.ok) {
        const remote = quotesRes.quotations
        const inbox = workspaceRef.current.inboxEvents
        const merged = adoptQuotations(
          workspaceRef.current.quotations,
          remote,
          inbox,
        ).filter((q) => !quotationTrashExpired(q))
        const remoteIds = new Set(remote.filter((q) => q?.id).map((q) => q.id))
        const authId = userAuthIdRef.current
        for (const q of merged) {
          if (!q?.id || remoteIds.has(q.id)) continue
          const owner = workspaceRef.current.users.find(
            (u) => u && (u.id === q.createdById || u.authId === q.createdById),
          )
          const mine = Boolean(authId && (owner?.authId === authId || q.createdById === authId))
          if (mine) {
            void persistQuoteNowAsync(q)
          }
        }
        setQuotations((live) => {
          const next = adoptQuotations(live, remote, inbox).filter(
            (q) => !quotationTrashExpired(q),
          )
          return quotesSignature(live) === quotesSignature(next) ? live : next
        })
      }
      const ops = await loadOpsWorkspace(workspaceRef.current.users)
      if (cancelled) return
      if (ops.ok) applyLoadedOps(ops)
      const inbox =
        ops.ok && !ops.inboxEventsError
          ? adoptById(
              workspaceRef.current.inboxEvents,
              ops.inboxEvents,
              (a, b) => ((a.at ?? "") >= (b.at ?? "") ? a : b),
            )
          : workspaceRef.current.inboxEvents
      setQuotations((prev) => {
        const promoted = promoteInboxQueuedDrafts(prev, inbox)
        return quotesSignature(prev) === quotesSignature(promoted) ? prev : promoted
      })
      const core = await loadCoreWorkspace()
      if (cancelled) return
      applyLoadedCore(core)
      setSyncStatus("live")
    }

    const pull = async (isBoot = false) => {
      if (supabaseMode) {
        await pullFromSupabase()
        if (isBoot) suppressPublishRef.current = false
        return
      }

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
      if (isBoot) suppressPublishRef.current = false
    }

    void pull(true)
    const timer = window.setInterval(() => {
      if (!pushingRef.current) void pull(false)
    }, supabaseMode ? 30_000 : 4_000)
    const onFocus = () => {
      if (!pushingRef.current) void pull(false)
    }
    window.addEventListener("focus", onFocus)

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | undefined
    let debounce: ReturnType<typeof setTimeout> | undefined
    if (supabaseMode) {
      const supabase = getSupabaseBrowser()
      const refresh = () => {
        window.clearTimeout(debounce)
        debounce = setTimeout(() => {
          if (!cancelled && !pushingRef.current) void pullFromSupabase()
        }, 280)
      }
      channel = supabase
        .channel("technik-ops")
        .on("postgres_changes", { event: "*", schema: "public", table: "quotations" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "quotation_visit_photos" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, refresh)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "inbox_events" }, (payload) => {
          const row = payload.new as { id?: string; title?: string; body?: string }
          if (row.id && row.id === lastAnnouncedInboxIdRef.current) {
            refresh()
            return
          }
          if (row.title && userRoleRef.current === "admin") {
            showNotice(row.body ? `${row.title} · ${row.body}` : row.title)
          }
          refresh()
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setSyncStatus("live")
        })
    }

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(debounce)
      window.removeEventListener("focus", onFocus)
      if (channel) void getSupabaseBrowser().removeChannel(channel)
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [applySnapshot, maybeShowRemoteNotice, applyLoadedOps, applyLoadedCore, showNotice, persistQuoteNowAsync])

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
      setProjects((prev) =>
        adoptProjects(
          prev,
          projectsBackup.map((p) => normalizeProject(p)).filter((p) => !projectTrashExpired(p)),
        ),
      )
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

  const fetchPendingInviteIds = useCallback(async (): Promise<Set<string>> => {
    const ids = new Set<string>()
    if (!isSupabaseConfigured()) return ids
    try {
      const supabase = getSupabaseBrowser()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return ids
      const res = await fetch("/api/users/pending-invites", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; ids?: string[] } | null
      if (json?.ok && Array.isArray(json.ids)) {
        for (const id of json.ids) ids.add(id)
      }
    } catch {
      /* roster sigue con invite_pending de profiles */
    }
    return ids
  }, [])

  const withPendingInvites = useCallback((list: User[], pendingIds: Set<string>) => {
    if (pendingIds.size === 0) return list
    return list.map((u) =>
      u.authId && pendingIds.has(u.authId) ? { ...u, invitePending: true } : u,
    )
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
        data = retry.data as typeof data
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
      if (rosterAlreadyLoaded) return { ok: true as const }

      void (async () => {
        try {
          const [rosterRes, core] = await Promise.all([loadProfiles(), loadCoreWorkspace()])
          if (logoutIntentRef.current || gen !== authHydrateGen.current) return
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
          if (logoutIntentRef.current || gen !== authHydrateGen.current) return
          if (quotesRes.ok) {
            setQuotations((prev) => {
              const adopted = adoptQuotations(
                prev,
                quotesRes.quotations,
                workspaceRef.current.inboxEvents,
              ).filter(
                (q) => !quotationTrashExpired(q),
              )
              return quotesSignature(prev) === quotesSignature(adopted) ? prev : adopted
            })
          }
          const ops = await loadOpsWorkspace(roster)
          if (logoutIntentRef.current || gen !== authHydrateGen.current) return
          if (ops.ok) applyLoadedOps(ops)
          if (row.role === "admin") {
            const pendingIds = await fetchPendingInviteIds()
            if (logoutIntentRef.current || gen !== authHydrateGen.current) return
            if (pendingIds.size > 0) {
              setUsers((prev) => dedupeUsers(withPendingInvites(prev, pendingIds)))
            }
          }
        } catch (err) {
          console.error("[technik] No se pudo hidratar el workspace", err)
        }
      })()

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
  }, [applyLoadedOps, applyLoadedCore, fetchPendingInviteIds, withPendingInvites])

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
      try {
        if (cancelled || logoutIntentRef.current) return
        const authUser = data.session?.user
        if (authUser && gatePassword(undefined, authUser)) {
          setMustSetPassword(true)
          return
        }
        if (authUser) await applyAuthUser(authUser.id, authUser.email)
      } catch (err) {
        console.error("[technik] Sesión inicial", err)
      } finally {
        if (!cancelled) setAuthReady(true)
      }
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
          const pendingIds = await fetchPendingInviteIds()
          pendingIds.add(json.id)
          setUsers((prev) =>
            dedupeUsers(
              adoptByKey(
                prev,
                withPendingInvites(roster.users, pendingIds),
                (u) => u.authId || u.id,
                (_a, b) => b,
              ),
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
    [fetchPendingInviteIds, withPendingInvites],
  )

  const refreshUsers = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const roster = await loadProfiles()
    if (roster.ok && roster.users.length > 0) {
      const pendingIds = await fetchPendingInviteIds()
      setUsers((prev) =>
        dedupeUsers(
          adoptByKey(
            prev,
            withPendingInvites(roster.users, pendingIds),
            (u) => u.authId || u.id,
            (_a, b) => b,
          ),
        ),
      )
      if (user?.authId) rosterReadyForAuthId.current = user.authId
    }
  }, [user?.authId, fetchPendingInviteIds, withPendingInvites])

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
    async (input) => {
      const fallback = nextQuotationCode(
        quotationsRef.current.filter((x) => x?.id).map((x) => x.reference),
      )
      const code = isSupabaseConfigured()
        ? ((await nextServerCode("quotation")) ?? fallback)
        : fallback
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
          : ([departments[0]?.id].filter(Boolean) as WorkDepartment[]),
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
      const nextQuotations = [q, ...quotationsRef.current.filter((x) => x?.id)]
      setQuotations(nextQuotations)
      quotationsRef.current = nextQuotations
      flushPublish({ quotations: nextQuotations })
      let saved: Awaited<ReturnType<typeof persistQuoteNowAsync>>
      try {
        saved = await persistQuoteNowAsync(q)
      } catch (err) {
        saved = {
          ok: false as const,
          error: displayPersistError(err instanceof Error ? err.message : undefined),
          id: q.id,
        }
      }
      const finalId = saved?.id || q.id
      if (input.submit && saved?.ok) {
        const inboxItem: InboxEvent = {
          id: `review-${finalId}-${stamp}`,
          kind: "review_queue",
          title: "Nueva cotización por revisar",
          body: `${finalId} · ${input.title}`,
          at: new Date().toISOString(),
          href: { name: "review", id: finalId },
        }
        announce(`${actor} · Nueva cotización en revisión ${finalId}`, "admin", inboxItem)
        flushPublish({
          inboxEvents: [inboxItem, ...workspaceRef.current.inboxEvents],
        })
      }
      return finalId
    },
    [user, departments, announce, flushPublish, persistQuoteNowAsync],
  )

  const updateQuotation = useCallback(
    (id: string, patch: Partial<Quotation>, historyAction?: string) => {
      const current = quotationsRef.current.find((q) => q?.id === id)
      if (!current) return { ok: false as const, error: "Cotización no encontrada." }

      let nextPatch = { ...patch }

      // Cotización aprobada o archivada: no alterar montos / alcance comercial.
      // En revisión o borrador se puede volver a editar (aunque se haya enviado antes).
      if (current.status === "approved" || current.status === "closed") {
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
              "Cotización aprobada: pásala a En revisión para actualizar totales y vuelve a aprobar.",
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
      const nextQuotations = quotationsRef.current.map((q) => {
        if (!q || q.id !== id) return q
        return {
          ...q,
          ...nextPatch,
          updatedAt: fieldStamp(),
          history: historyAction
            ? (() => {
                const prev = q.history ?? []
                const last = prev[prev.length - 1]
                if (last && last.action === historyAction && last.by === actor) {
                  return [...prev.slice(0, -1), { at: stamp, by: actor, action: historyAction }]
                }
                return [...prev, { at: stamp, by: actor, action: historyAction }]
              })()
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
      quotationsRef.current = nextQuotations
      const updated = nextQuotations.find((q) => q?.id === id)
      if (updated) persistQuoteNow(updated)
      flushPublish({
        quotations: nextQuotations,
        ...(inboxPayload ? { inboxEvents: inboxPayload } : {}),
      })
      return { ok: true as const }
    },
    [user, announce, projects, flushPublish, persistQuoteNow],
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
    async (id: string) => {
      const src = quotationsRef.current.find((q) => q?.id === id)
      if (!src) return null
      const fallback = nextQuotationCode(
        quotationsRef.current.filter((x) => x?.id).map((x) => x.reference),
      )
      const code = isSupabaseConfigured()
        ? ((await nextServerCode("quotation")) ?? fallback)
        : fallback
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
      const nextQuotations = [q, ...quotationsRef.current.filter((x) => x?.id)]
      setQuotations(nextQuotations)
      quotationsRef.current = nextQuotations
      try {
        const saved = await persistQuoteNowAsync(q)
        return saved?.id || q.id
      } catch {
        return q.id
      }
    },
    [user, persistQuoteNowAsync],
  )

  const archiveQuotation = useCallback(
    (id: string) => {
      updateQuotation(id, { status: "closed" }, "Archivó cotización")
    },
    [updateQuotation],
  )

  const persistTrashFlags = useCallback(
    async (
      quoteFlags: Array<{ id: string; deletedAt?: string }>,
      projectFlags: Array<{ id: string; deletedAt?: string }>,
    ) => {
      if (!isSupabaseConfigured()) return { ok: true as const }
      for (const q of quoteFlags) {
        const res = await persistQuotationDeletedAt(q.id, q.deletedAt ?? null)
        if (!res.ok) return res
      }
      for (const p of projectFlags) {
        const res = await persistProjectDeletedAt(p.id, p.deletedAt ?? null)
        if (!res.ok) return res
      }
      return { ok: true as const }
    },
    [],
  )

  const deleteDraftQuotation = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const q = quotations.find((x) => x?.id === id)
      if (!q) return { ok: false, error: "Cotización no encontrada" }
      if (quotationIsTrashed(q)) {
        return { ok: false, error: "Esa cotización ya está en Eliminados" }
      }
      if (!canTrashQuotation(user, q)) {
        return {
          ok: false,
          error:
            user?.role === "empleado"
              ? "Solo puedes eliminar tus borradores o las que enviaste a administración"
              : "No se puede eliminar esta cotización",
        }
      }
      const deletedAt = new Date().toISOString()
      const stamp = fieldStamp()
      const actor = user?.name ?? "Usuario"
      const prevQuotations = quotations
      const prevProjects = projects
      const nextQuotations = quotations.map((x) =>
        x?.id === id
          ? {
              ...x,
              deletedAt,
              updatedAt: stamp,
              history: [...(x.history ?? []), { at: nowStamp(), by: actor, action: "Envió a eliminados" }],
            }
          : x,
      )
      const linked = projects.filter((p) => p.quotationId === id && !p.deletedAt)
      const nextProjects =
        linked.length === 0
          ? projects
          : projects.map((p) =>
              p.quotationId === id && !p.deletedAt
                ? {
                    ...p,
                    deletedAt,
                    updatedAt: stamp,
                    history: [
                      ...(p.history ?? []),
                      { at: nowStamp(), by: actor, action: "Envió a eliminados (con cotización)" },
                    ],
                  }
                : p,
            )
      setQuotations(nextQuotations)
      if (linked.length > 0) setProjects(nextProjects)
      const updated = nextQuotations.find((x) => x?.id === id)
      const saved = await persistTrashFlags(
        updated ? [{ id: updated.id, deletedAt }] : [],
        linked.map((p) => ({ id: p.id, deletedAt })),
      )
      if (!saved.ok) {
        setQuotations(prevQuotations)
        setProjects(prevProjects)
        setSaveError(saved.error)
        return saved
      }
      if (updated) persistQuoteNow(updated)
      for (const p of nextProjects) {
        if (p.quotationId === id && p.deletedAt === deletedAt) persistProjectNow(p)
      }
      flushPublish({ quotations: nextQuotations, projects: nextProjects })
      return { ok: true }
    },
    [quotations, projects, user, flushPublish, persistQuoteNow, persistProjectNow, persistTrashFlags],
  )

  const restoreDraftQuotation = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const q = quotations.find((x) => x?.id === id)
      if (!q) return { ok: false, error: "Cotización no encontrada" }
      if (!quotationIsTrashed(q)) {
        return { ok: false, error: "Esa cotización no está en Eliminados" }
      }
      if (!canRestoreQuotation(user, q)) {
        return { ok: false, error: "Solo puedes recuperar tus propias cotizaciones" }
      }
      const stamp = fieldStamp()
      const actor = user?.name ?? "Usuario"
      const prevQuotations = quotations
      const prevProjects = projects
      const nextQuotations = quotations.map((x) =>
        x?.id === id
          ? {
              ...x,
              deletedAt: undefined,
              updatedAt: stamp,
              history: [...(x.history ?? []), { at: nowStamp(), by: actor, action: "Recuperó de eliminados" }],
            }
          : x,
      )
      const linked = projects.filter((p) => p.quotationId === id && p.deletedAt)
      const nextProjects =
        linked.length === 0
          ? projects
          : projects.map((p) =>
              p.quotationId === id && p.deletedAt
                ? {
                    ...p,
                    deletedAt: undefined,
                    updatedAt: stamp,
                    history: [
                      ...(p.history ?? []),
                      { at: nowStamp(), by: actor, action: "Recuperó de eliminados (con cotización)" },
                    ],
                  }
                : p,
            )
      setQuotations(nextQuotations)
      if (linked.length > 0) setProjects(nextProjects)
      const updated = nextQuotations.find((x) => x?.id === id)
      const saved = await persistTrashFlags(
        updated ? [{ id: updated.id, deletedAt: undefined }] : [],
        linked.map((p) => ({ id: p.id, deletedAt: undefined })),
      )
      if (!saved.ok) {
        setQuotations(prevQuotations)
        setProjects(prevProjects)
        setSaveError(saved.error)
        return saved
      }
      if (updated) persistQuoteNow(updated)
      for (const p of nextProjects) {
        if (p.quotationId === id && !p.deletedAt && linked.some((l) => l.id === p.id)) {
          persistProjectNow(p)
        }
      }
      flushPublish({ quotations: nextQuotations, projects: nextProjects })
      return { ok: true }
    },
    [quotations, projects, user, flushPublish, persistQuoteNow, persistProjectNow, persistTrashFlags],
  )

  const trashProject = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const p = projects.find((x) => x.id === id)
      if (!p) return { ok: false, error: "Proyecto no encontrado" }
      if (p.deletedAt) return { ok: false, error: "Ese proyecto ya está en Eliminados" }
      if (!canTrashProject(user)) {
        return { ok: false, error: "Solo administración puede eliminar proyectos" }
      }
      if (p.quotationId) {
        const q = quotations.find((x) => x?.id === p.quotationId)
        if (q && !quotationIsTrashed(q)) return deleteDraftQuotation(q.id)
      }
      const deletedAt = new Date().toISOString()
      const stamp = fieldStamp()
      const actor = user?.name ?? "Usuario"
      const prevProjects = projects
      const nextProjects = projects.map((x) =>
        x.id === id
          ? {
              ...x,
              deletedAt,
              updatedAt: stamp,
              history: [...(x.history ?? []), { at: nowStamp(), by: actor, action: "Envió a eliminados" }],
            }
          : x,
      )
      setProjects(nextProjects)
      const saved = await persistTrashFlags([], [{ id, deletedAt }])
      if (!saved.ok) {
        setProjects(prevProjects)
        setSaveError(saved.error)
        return saved
      }
      const updated = nextProjects.find((x) => x.id === id)
      if (updated) persistProjectNow(updated)
      flushPublish({ projects: nextProjects })
      return { ok: true }
    },
    [projects, quotations, user, deleteDraftQuotation, persistProjectNow, persistTrashFlags, flushPublish],
  )

  const restoreProject = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const p = projects.find((x) => x.id === id)
      if (!p) return { ok: false, error: "Proyecto no encontrado" }
      if (!canTrashProject(user)) {
        return { ok: false, error: "Solo administración puede recuperar proyectos" }
      }
      if (p.quotationId) {
        const q = quotations.find((x) => x?.id === p.quotationId)
        if (q && quotationIsTrashed(q)) return restoreDraftQuotation(q.id)
      }
      if (!p.deletedAt) return { ok: false, error: "Ese proyecto no está en Eliminados" }
      const stamp = fieldStamp()
      const actor = user?.name ?? "Usuario"
      const prevProjects = projects
      const nextProjects = projects.map((x) =>
        x.id === id
          ? {
              ...x,
              deletedAt: undefined,
              updatedAt: stamp,
              history: [...(x.history ?? []), { at: nowStamp(), by: actor, action: "Recuperó de eliminados" }],
            }
          : x,
      )
      setProjects(nextProjects)
      const saved = await persistTrashFlags([], [{ id, deletedAt: undefined }])
      if (!saved.ok) {
        setProjects(prevProjects)
        setSaveError(saved.error)
        return saved
      }
      const updated = nextProjects.find((x) => x.id === id)
      if (updated) persistProjectNow(updated)
      flushPublish({ projects: nextProjects })
      return { ok: true }
    },
    [projects, quotations, user, restoreDraftQuotation, persistProjectNow, persistTrashFlags, flushPublish],
  )

  const purgeExpiredTrashedDrafts = useCallback(() => {
    const prevQ = workspaceRef.current.quotations
    const prevP = workspaceRef.current.projects
    const expiredQuotes = prevQ.filter((q) => quotationTrashExpired(q))
    const expiredQuoteIds = new Set(expiredQuotes.map((q) => q.id))
    const expiredProjects = prevP.filter(
      (p) => projectTrashExpired(p) || Boolean(p.quotationId && expiredQuoteIds.has(p.quotationId)),
    )
    if (expiredQuotes.length === 0 && expiredProjects.length === 0) return

    const nextQ = prevQ.filter((q) => !expiredQuoteIds.has(q.id))
    const expiredProjectIds = new Set(expiredProjects.map((p) => p.id))
    const nextP = prevP.filter((p) => !expiredProjectIds.has(p.id))
    setQuotations(nextQ)
    setProjects(nextP)

    const paidProjectIds = new Set(
      expiredProjects
        .filter((p) => (p.installments ?? []).some((i) => i.paidAt))
        .map((p) => p.id),
    )

    for (const p of expiredProjects) {
      if (paidProjectIds.has(p.id)) continue
      if (isSupabaseConfigured()) {
        void trackPersist(`project-del:${p.id}`, () => deleteProjectRow(p.id))
      }
    }
    for (const q of expiredQuotes) {
      const linked = expiredProjects.filter((p) => p.quotationId === q.id)
      if (linked.some((p) => paidProjectIds.has(p.id))) continue
      void deleteAllVisitPhotosRequest(q.id)
      if (isSupabaseConfigured()) {
        void trackPersist(`quote-del:${q.id}`, () => deleteQuotationRow(q.id))
      }
    }
    queueMicrotask(() => flushPublishRef.current({ quotations: nextQ, projects: nextP }))
  }, [trackPersist])

  const uploadVisitPhotos = useCallback(
    async (quotationId: string, files: File[]) => {
      const current = quotations.find((q) => q?.id === quotationId)
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
    (quotationId: string, quoteSnapshot?: Quotation) => {
      const quote = quoteSnapshot ?? quotationsRef.current.find((q) => q.id === quotationId)
      if (!quote) return null

      const due = quoteClientDue(quote, catalog).total
      const existing = projects.find(
        (p) => p.quotationId === quotationId || p.id === quotationId || p.id === quote.reference,
      )
      const d = today()
      const stamp = nowStamp()
      const actor = user?.name ?? "Usuario"

      if (existing) {
        const next: Project = {
          ...existing,
          totalDue: due,
          clientId: existing.clientId ?? quote.clientId,
          title: existing.title ?? quote.title,
          departments: existing.departments?.length ? existing.departments : quote.departments,
          coverImageUrl: existing.coverImageUrl || quotationCoverUrl(quote),
          updatedAt: d,
          history:
            existing.totalDue === due
              ? existing.history
              : [
                  ...existing.history,
                  {
                    at: stamp,
                    by: actor,
                    action: `Actualizó totales desde cotización · ${due.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`,
                  },
                ],
        }
        setProjects((prev) => prev.map((p) => (p.id === existing.id ? next : p)))
        persistProjectNow(next)
        return existing.id
      }

      const id = quote.reference || quote.id
      const project: Project = {
        id,
        quotationId,
        title: quote.title,
        clientId: quote.clientId,
        departments: quote.departments,
        totalDue: due,
        stage: "procesando_solicitud",
        installments: [],
        coverImageUrl: quotationCoverUrl(quote),
        createdById: user?.id,
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
    [quotations, projects, catalog, user, announce, persistProjectNow],
  )

  const setClientResponse = useCallback(
    (id: string, response: ClientResponse) => {
      const current = quotationsRef.current.find((q) => q?.id === id)
      if (!current) return { ok: false as const, error: "Cotización no encontrada." }
      const patch: Partial<Quotation> = { clientResponse: response }
      if (response === "aprobada") {
        if (current.status !== "closed") patch.status = "approved"
        const filled = clientPublicItemsForQuote(current, catalog)
        if (!(current.publicItems ?? []).length && filled.length > 0) {
          patch.publicItems = filled
        }
      }
      const result = updateQuotation(
        id,
        patch,
        `Cliente: ${CLIENT_RESPONSE_META[response].label}`,
      )
      if (!result.ok) return result
      if (response === "aprobada") {
        const latest = quotationsRef.current.find((q) => q?.id === id) ?? { ...current, ...patch }
        const projectId = createProjectFromQuotation(id, latest)
        return { ok: true as const, projectId: projectId ?? undefined }
      }
      return { ok: true as const }
    },
    [catalog, updateQuotation, createProjectFromQuotation],
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
      const changed = (Object.keys(patch) as (keyof Project)[]).some((key) => {
        if (key === "history" || key === "updatedAt") return false
        return patch[key] !== current[key]
      })

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
              ? (() => {
                  const prevH = p.history ?? []
                  const last = prevH[prevH.length - 1]
                  if (last && last.action === historyAction && last.by === actor) {
                    return [...prevH.slice(0, -1), { at: stamp, by: actor, action: historyAction }]
                  }
                  return [...prevH, { at: stamp, by: actor, action: historyAction }]
                })()
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
          const next: Project = {
            ...p,
            paymentMode: mode,
            installments: (p.installments ?? []).map((inst): ProjectInstallment => ({
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
      trashProject,
      restoreProject,
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
      trashProject,
      restoreProject,
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
 * Ítems al cliente para cobro / proyecto.
 * Si no hay ítems públicos, arma Materiales / Mano de obra / Extras con los cargos de la cotización.
 */
export function clientPublicItemsForQuote(q: Quotation, catalog: CatalogItem[]): PublicQuoteItem[] {
  const existing = (q.publicItems ?? []).filter((it) => it.quantity > 0)
  if (existing.length > 0) return existing
  const t = quoteTotals(q, catalog)
  const rows: PublicQuoteItem[] = []
  const push = (id: string, title: string, amount: number) => {
    if (!(amount > 0)) return
    rows.push({
      id,
      quantity: 1,
      title,
      description: "",
      unitPrice: roundMxn(amount),
    })
  }
  push("pub-materiales", "Materiales", t.materialCharge)
  push("pub-mano-obra", "Mano de obra", t.laborCharge)
  push("pub-extras", "Extras", t.extrasCharge)
  return rows
}

/** Total MXN al cliente (ítems públicos o cargos internos + IVA − ISR). */
export function quoteClientDue(q: Quotation, catalog: CatalogItem[]) {
  return publicQuoteTotals(
    clientPublicItemsForQuote(q, catalog),
    q.taxRate,
    q.isrRetentionRate,
  )
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
