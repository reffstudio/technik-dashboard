import { getSupabaseBrowser } from "@/lib/supabase/browser"
import type {
  ApartadoMovement,
  CashChannel,
  ExpenseEntry,
  PaymentEvent,
  PaymentEventKind,
  Project,
  ProjectInstallment,
  TreasuryMonth,
  TreasurySeparado,
  User,
} from "./data"
import {
  normalizeApartadoMovement,
  normalizeProject,
  normalizeTreasurySeparado,
  projectTrashExpired,
} from "./data"
import { persistStorageImage, storagePublicUrl, coverPathForProject, extFromDataUrl } from "./cover-image"
import { activityEventKey, dedupeActivityHistory } from "./activity-history"
import type { InboxEvent } from "./notifications"
import { isoDay } from "./dates"
import { resolveProjectStageForPersist } from "./live"

function num(value: number | string | null | undefined, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function authorOf(id: string | null | undefined, users: User[]) {
  if (!id) return { name: "Sistema", id: "" }
  const u = users.find((x) => x.authId === id || x.id === id)
  return { name: u?.name ?? "Colaborador", id: u?.id ?? id }
}

function eventAt(iso: string) {
  return (iso ?? "").slice(0, 16).replace("T", " ")
}

function parseStamp(at: string) {
  const parsed = new Date(at.includes("T") ? at : at.replace(" ", "T"))
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function toDbPaymentKind(kind: PaymentEventKind): "marked_paid" | "correction_note" {
  return kind === "collected" ? "marked_paid" : "correction_note"
}

function fromDbPaymentKind(kind: string): PaymentEventKind {
  return kind === "marked_paid" ? "collected" : "correction_note"
}

type ProjectRow = {
  id: string
  quotation_id: string | null
  title: string | null
  client_id: string | null
  total_due: number | string | null
  created_by: string | null
  stage: Project["stage"]
  due_date: string | null
  delivered_at: string | null
  notes: string | null
  payment_mode: Project["paymentMode"] | null
  cover_image_path?: string | null
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

type InstRow = {
  id: string
  project_id: string
  amount: number | string
  due_date: string
  note: string | null
  invoice_uuid: string | null
  invoice_date: string | null
  payment_complement: ProjectInstallment["paymentComplement"] | null
  paid_at: string | null
  method: ProjectInstallment["method"] | null
  sort_order: number
}

export async function loadOpsWorkspace(users: User[]): Promise<
  | {
      ok: true
      projects: Project[]
      paymentEvents: PaymentEvent[]
      expenses: ExpenseEntry[]
      treasuryMonths: TreasuryMonth[]
      treasurySeparados: TreasurySeparado[]
      apartadoMovements: ApartadoMovement[]
      inboxEvents: InboxEvent[]
      projectsError?: string
      paymentEventsError?: string
      expensesError?: string
      treasuryMonthsError?: string
      treasurySeparadosError?: string
      apartadoMovementsError?: string
      inboxEventsError?: string
    }
  | { ok: false; error: string }
> {
  const supabase = getSupabaseBrowser()
  const [
    projectsRes,
    deptsRes,
    instRes,
    eventsRes,
    payRes,
    expensesRes,
    monthsRes,
    sepsRes,
    movsRes,
    inboxRes,
  ] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("project_departments").select("project_id, department_id"),
    supabase.from("project_installments").select("*").order("sort_order"),
    supabase.from("project_events").select("project_id, actor_id, action, created_at").order("created_at"),
    supabase.from("payment_events").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").order("date", { ascending: false }),
    supabase.from("treasury_months").select("*").order("year_month", { ascending: false }),
    supabase.from("treasury_separados").select("*").order("created_at", { ascending: false }),
    supabase.from("apartado_movements").select("*").order("created_at", { ascending: false }),
    supabase.from("inbox_events").select("*").order("at", { ascending: false }).limit(80),
  ])

  if (projectsRes.error) {
    return { ok: false, error: projectsRes.error.message }
  }

  const deptsBy = new Map<string, string[]>()
  for (const row of (deptsRes.data ?? []) as { project_id: string; department_id: string }[]) {
    const list = deptsBy.get(row.project_id) ?? []
    list.push(row.department_id)
    deptsBy.set(row.project_id, list)
  }

  const instBy = new Map<string, ProjectInstallment[]>()
  if (instRes.error) {
    console.warn("[technik] No se pudieron leer cuotas", instRes.error.message)
  }
  for (const row of (instRes.data ?? []) as InstRow[]) {
    const list = instBy.get(row.project_id) ?? []
    list.push({
      id: row.id,
      amount: num(row.amount),
      dueDate: isoDay(row.due_date),
      note: row.note || undefined,
      invoiceUuid: row.invoice_uuid || undefined,
      invoiceDate: isoDay(row.invoice_date) || undefined,
      paymentComplement: row.payment_complement ?? undefined,
      paidAt: isoDay(row.paid_at) || undefined,
      method: row.method || undefined,
    })
    instBy.set(row.project_id, list)
  }

  const histBy = new Map<string, Project["history"]>()
  for (const row of (eventsRes.data ?? []) as { project_id: string; actor_id: string | null; action: string; created_at: string }[]) {
    const list = histBy.get(row.project_id) ?? []
    list.push({
      at: eventAt(row.created_at),
      by: authorOf(row.actor_id, users).name,
      action: row.action,
    })
    histBy.set(row.project_id, list)
  }
  for (const [id, list] of histBy) {
    histBy.set(id, dedupeActivityHistory(list))
  }

  const projects = ((projectsRes.data ?? []) as ProjectRow[]).map((row) =>
    normalizeProject({
      id: row.id,
      quotationId: row.quotation_id || undefined,
      title: row.title || undefined,
      clientId: row.client_id || undefined,
      departments: deptsBy.get(row.id),
      totalDue: row.total_due == null ? undefined : num(row.total_due),
      createdById: authorOf(row.created_by, users).id || undefined,
      stage: row.stage,
      dueDate: row.due_date || undefined,
      deliveredAt: row.delivered_at || undefined,
      notes: row.notes || undefined,
      paymentMode: row.payment_mode || undefined,
      installments: (() => {
        const own = instBy.get(row.id) ?? []
        if (own.length > 0) return own
        return row.quotation_id ? (instBy.get(row.quotation_id) ?? []) : []
      })(),
      createdAt: (row.created_at ?? "").slice(0, 10),
      updatedAt: row.updated_at?.slice(0, 16).replace("T", " ") ?? (row.updated_at ?? "").slice(0, 10),
      history: histBy.get(row.id) ?? [],
      coverImageUrl: row.cover_image_path ? storagePublicUrl(row.cover_image_path) : undefined,
      deletedAt: row.deleted_at ?? undefined,
    }),
  ).filter((p) => !projectTrashExpired(p))

  const paymentEvents: PaymentEvent[] = ((payRes.data ?? []) as {
    id: string
    project_id: string
    installment_id: string
    kind: string
    amount: number | string | null
    method: PaymentEvent["method"] | null
    note: string | null
    created_at: string
    actor_id: string | null
  }[]).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    installmentId: row.installment_id,
    kind: fromDbPaymentKind(row.kind),
    amount: num(row.amount),
    method: row.method || undefined,
    note: row.note || undefined,
    at: eventAt(row.created_at),
    by: authorOf(row.actor_id, users).name,
  }))

  const expenses: ExpenseEntry[] = ((expensesRes.data ?? []) as {
    id: string
    amount: number | string
    date: string
    description: string
    channel: CashChannel
    created_at: string
  }[]).map((row) => ({
    id: row.id,
    amount: num(row.amount),
    date: row.date,
    description: row.description ?? "",
    channel: row.channel,
    createdAt: row.created_at,
  }))

  const treasuryMonths: TreasuryMonth[] = ((monthsRes.data ?? []) as {
    year_month: string
    opening_bank: number | string
    opening_cash: number | string
  }[]).map((row) => ({
    yearMonth: row.year_month,
    openingBank: num(row.opening_bank),
    openingCash: num(row.opening_cash),
  }))

  const treasurySeparados = ((sepsRes.data ?? []) as {
    id: string
    name: string
    category: TreasurySeparado["category"]
    kind: TreasurySeparado["kind"]
    value: number | string
    suggested_amount: number | string | null
    status: TreasurySeparado["status"]
    paid_expense_id: string | null
    year_month: string | null
    amount_overridden: boolean | null
    opening_balance: number | string | null
    created_at: string
  }[]).map((row) =>
    normalizeTreasurySeparado({
      id: row.id,
      name: row.name,
      category: row.category,
      kind: row.kind,
      value: num(row.value),
      suggestedAmount: row.suggested_amount == null ? undefined : num(row.suggested_amount),
      status: row.status,
      paidExpenseId: row.paid_expense_id || undefined,
      yearMonth: row.year_month || undefined,
      amountOverridden: row.amount_overridden === true,
      openingBalance: num(row.opening_balance),
      createdAt: row.created_at,
    }),
  )

  const apartadoMovements = ((movsRes.data ?? []) as {
    id: string
    apartado_id: string
    kind: ApartadoMovement["kind"]
    amount: number | string
    date: string
    note: string | null
    expense_id: string | null
    created_at: string
    created_by: string | null
  }[]).map((row) =>
    normalizeApartadoMovement({
      id: row.id,
      apartadoId: row.apartado_id,
      kind: row.kind,
      amount: num(row.amount),
      date: row.date,
      note: row.note || undefined,
      expenseId: row.expense_id || undefined,
      createdAt: row.created_at,
      createdById: authorOf(row.created_by, users).id || undefined,
    }),
  )

  const inboxEvents: InboxEvent[] = ((inboxRes.data ?? []) as {
    id: string
    kind: InboxEvent["kind"]
    title: string
    body: string
    at: string
    href: InboxEvent["href"] | null
  }[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? "",
    at: row.at,
    href: row.href || undefined,
  }))

  return {
    ok: true,
    projects,
    paymentEvents: payRes.error ? [] : paymentEvents,
    expenses: expensesRes.error ? [] : expenses,
    treasuryMonths: monthsRes.error ? [] : treasuryMonths,
    treasurySeparados: sepsRes.error ? [] : treasurySeparados,
    apartadoMovements: movsRes.error ? [] : apartadoMovements,
    inboxEvents: inboxRes.error ? [] : inboxEvents,
    paymentEventsError: payRes.error?.message,
    expensesError: expensesRes.error?.message,
    treasuryMonthsError: monthsRes.error?.message,
    treasurySeparadosError: sepsRes.error?.message,
    apartadoMovementsError: movsRes.error?.message,
    inboxEventsError: inboxRes.error?.message,
  }
}

export async function persistProject(
  project: Project,
  ctx: { actorAuthId?: string; users: User[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await persistProjectInner(project, ctx)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el proyecto.",
    }
  }
}

async function persistProjectInner(
  project: Project,
  ctx: { actorAuthId?: string; users: User[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseBrowser()
  const createdBy =
    ctx.users.find((u) => u && (u.id === project.createdById || u.authId === project.createdById))?.authId ||
    ctx.actorAuthId ||
    null

  const { data: dbRow } = await supabase
    .from("projects")
    .select("stage, updated_at, delivered_at")
    .eq("id", project.id)
    .maybeSingle()
  const db = dbRow as { stage?: Project["stage"]; updated_at?: string; delivered_at?: string | null } | null
  const stage = resolveProjectStageForPersist(project, {
    stage: db?.stage,
    updatedAt: db?.updated_at?.slice(0, 16).replace("T", " ") ?? db?.updated_at,
  })

  const payload: Record<string, unknown> = {
    id: project.id,
    quotation_id: project.quotationId ?? null,
    title: project.title ?? null,
    client_id: project.clientId ?? null,
    total_due: project.totalDue ?? null,
    created_by: createdBy,
    stage,
    due_date: project.dueDate || null,
    delivered_at:
      (stage === "completado" ? project.deliveredAt || db?.delivered_at || isoDay(project.updatedAt) : project.deliveredAt) ||
      null,
    notes: project.notes ?? null,
    payment_mode: project.paymentMode ?? null,
    deleted_at: project.deletedAt ?? null,
  }

  const coverPath = project.coverImageUrl
    ? await persistStorageImage(
        project.coverImageUrl.startsWith("data:")
          ? coverPathForProject(project.id, extFromDataUrl(project.coverImageUrl))
          : coverPathForProject(project.id),
        project.coverImageUrl,
      )
    : null
  if (coverPath) payload.cover_image_path = coverPath
  else if (!project.coverImageUrl) payload.cover_image_path = null
  else if (project.coverImageUrl.startsWith("data:")) {
    return { ok: false, error: "No se pudo subir la foto de portada. Revisa Storage quote-images." }
  }

  let { error } = await supabase.from("projects").upsert(payload)
  if (error && /cover_image_path/i.test(error.message)) {
    delete payload.cover_image_path
    const retry = await supabase.from("projects").upsert(payload)
    error = retry.error
  }
  if (error && /deleted_at/i.test(error.message)) {
    delete payload.deleted_at
    const retry = await supabase.from("projects").upsert(payload)
    error = retry.error
  }
  if (error) return { ok: false, error: error.message }

  await supabase.from("project_departments").delete().eq("project_id", project.id)
  const depts = project.departments ?? []
  if (depts.length > 0) {
    const { error: dErr } = await supabase.from("project_departments").insert(
      depts.map((department_id) => ({ project_id: project.id, department_id })),
    )
    if (dErr) return { ok: false, error: dErr.message }
  }

  const { data: existingInst } = await supabase
    .from("project_installments")
    .select("id, paid_at")
    .eq("project_id", project.id)
  const incomingUnpaid = (project.installments ?? []).filter((i) => i?.id && !i.paidAt)
  // No borrar cuotas si el snapshot viene vacío: un persist viejo (crear proyecto /
  // cambiar etapa) se comía el abono recién programado.
  const allowDeleteUnpaid =
    incomingUnpaid.length > 0 || (project.installments ?? []).some((i) => i?.paidAt)
  if (allowDeleteUnpaid) {
    const nextIds = new Set((project.installments ?? []).filter((i) => i?.id).map((i) => i.id))
    for (const row of (existingInst ?? []) as { id: string; paid_at: string | null }[]) {
      if (nextIds.has(row.id)) continue
      if (row.paid_at) continue
      await supabase.from("project_installments").delete().eq("id", row.id)
    }
  }

  const existingPaidAt = new Map(
    ((existingInst ?? []) as { id: string; paid_at: string | null }[]).map((row) => [
      row.id,
      row.paid_at,
    ]),
  )

  for (const [i, inst] of (project.installments ?? []).entries()) {
    const amount = Number(inst?.amount)
    const due = isoDay(inst?.dueDate) || String(inst?.dueDate ?? "").slice(0, 10)
    if (!inst || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}/.test(due)) continue
    const paidAt =
      isoDay(inst.paidAt) || isoDay(existingPaidAt.get(inst.id) ?? null) || null
    const paid = Boolean(paidAt)
    const { error: iErr } = await supabase.from("project_installments").upsert({
      id: inst.id,
      project_id: project.id,
      amount,
      due_date: due.slice(0, 10),
      note: inst.note ?? null,
      invoice_uuid: inst.invoiceUuid ?? null,
      invoice_date: isoDay(inst.invoiceDate) || null,
      payment_complement: inst.paymentComplement ?? "na",
      paid_at: paidAt,
      method: paid ? inst.method ?? "otro" : null,
      sort_order: i,
    })
    if (iErr) return { ok: false, error: iErr.message }
  }

  const { data: existingEv } = await supabase
    .from("project_events")
    .select("action, created_at")
    .eq("project_id", project.id)
  const seen = new Set(
    ((existingEv ?? []) as { action: string; created_at: string }[]).map((e) =>
      activityEventKey(e.created_at, e.action),
    ),
  )
  const fresh = dedupeActivityHistory(project.history ?? [])
    .filter((h) => !seen.has(activityEventKey(h.at, h.action)))
    .slice(-20)
  if (fresh.length > 0) {
    const { error: eErr } = await supabase.from("project_events").insert(
      fresh.map((h) => ({
        project_id: project.id,
        actor_id: ctx.users.find((u) => u && u.name === h.by)?.authId ?? ctx.actorAuthId ?? null,
        action: h.action,
        created_at: parseStamp(h.at),
      })),
    )
    if (eErr) {
      console.warn("[technik] Historial de proyecto no se pudo append", eErr.message)
    }
  }

  return { ok: true }
}

export async function persistPaymentEvent(
  event: PaymentEvent,
  actorAuthId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("payment_events").upsert({
    id: event.id,
    installment_id: event.installmentId,
    project_id: event.projectId,
    kind: toDbPaymentKind(event.kind),
    actor_id: actorAuthId ?? null,
    amount: event.amount ?? null,
    method: event.method ?? null,
    note: event.note ?? null,
    created_at: parseStamp(event.at),
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function persistExpense(entry: ExpenseEntry, actorAuthId?: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("expenses").upsert({
    id: entry.id,
    amount: entry.amount,
    date: entry.date,
    description: entry.description,
    channel: entry.channel,
    created_at: entry.createdAt,
    created_by: actorAuthId ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteExpenseRow(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function persistTreasuryMonth(month: TreasuryMonth) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("treasury_months").upsert({
    year_month: month.yearMonth,
    opening_bank: month.openingBank,
    opening_cash: month.openingCash,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function persistSeparado(sep: TreasurySeparado) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("treasury_separados").upsert({
    id: sep.id,
    name: sep.name,
    category: sep.category,
    kind: sep.kind,
    value: sep.value,
    suggested_amount: sep.suggestedAmount ?? null,
    status: sep.status,
    paid_expense_id: sep.paidExpenseId ?? null,
    year_month: sep.yearMonth ?? null,
    amount_overridden: sep.amountOverridden === true,
    opening_balance: sep.openingBalance ?? 0,
    created_at: sep.createdAt,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteSeparadoRow(id: string) {
  const supabase = getSupabaseBrowser()
  await supabase.from("apartado_movements").delete().eq("apartado_id", id)
  const { error } = await supabase.from("treasury_separados").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function persistApartadoMovement(mov: ApartadoMovement, actorAuthId?: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("apartado_movements").upsert({
    id: mov.id,
    apartado_id: mov.apartadoId,
    kind: mov.kind,
    amount: mov.amount,
    date: mov.date,
    note: mov.note ?? null,
    expense_id: mov.expenseId ?? null,
    created_at: mov.createdAt,
    created_by: actorAuthId ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteApartadoMovementRow(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("apartado_movements").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function persistInboxEvent(event: InboxEvent) {
  if (!event?.id) return { ok: false as const, error: "Aviso sin identificador." }
  try {
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.from("inbox_events").insert({
      id: event.id,
      kind: event.kind,
      title: event.title,
      body: event.body ?? "",
      at: event.at,
      href: event.href ?? null,
    })
    if (!error) return { ok: true as const }
    if (error.code === "23505" || /duplicate key/i.test(error.message ?? "")) {
      return { ok: true as const }
    }
    if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
      return { ok: false as const, error: "No se pudo avisar a administración." }
    }
    return { ok: false as const, error: error.message }
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudo guardar el aviso.",
    }
  }
}

const tails = new Map<string, Promise<unknown>>()

function enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(run)
  tails.set(key, next)
  return next
}

export async function persistProjectDeletedAt(id: string, deletedAt: string | null) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("projects").update({ deleted_at: deletedAt }).eq("id", id)
  if (!error) return { ok: true as const }
  if (/deleted_at/i.test(error.message)) {
    return {
      ok: false as const,
      error: "Falta correr el SQL de papelera de proyectos (projects.deleted_at).",
    }
  }
  const upsert = await supabase.from("projects").upsert({ id, deleted_at: deletedAt })
  if (!upsert.error) return { ok: true as const }
  if (/deleted_at/i.test(upsert.error.message)) {
    return {
      ok: false as const,
      error: "Falta correr el SQL de papelera de proyectos (projects.deleted_at).",
    }
  }
  return { ok: false as const, error: upsert.error.message }
}

export async function deleteProjectRow(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteProjectInstallmentRow(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("project_installments").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export function enqueuePersistProject(project: Project, ctx: { actorAuthId?: string; users: User[] }) {
  return enqueue(`project:${project.id}`, () => persistProject(project, ctx))
}

export function enqueueDeleteProjectInstallment(projectId: string, installmentId: string) {
  return enqueue(`project:${projectId}`, () => deleteProjectInstallmentRow(installmentId))
}
