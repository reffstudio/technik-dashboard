import { getSupabaseBrowser } from "@/lib/supabase/browser"
import { catalogRpcKind } from "./codes"
import type {
  CatalogItem,
  Client,
  DepartmentColorId,
  DepartmentConfig,
  Supplier,
  SupplierChannel,
} from "./data"
import { normalizeDepartmentColorId, SEED_DEPARTMENTS } from "./data"

type DeptRow = {
  id: string
  label: string
  short: string
  color_id: string
}

type ClientRow = {
  id: string
  company: string
  rfc: string
  contact: string
  email: string
  phone: string
  industry: string
  location: string
  since: string
}

type SupplierRow = {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  whatsapp: string
  preferred_channel: SupplierChannel
  specialty: string
  location: string
}

type CatalogRow = {
  id: string
  kind: CatalogItem["kind"]
  name: string
  sku: string
  category: CatalogItem["category"]
  unit: string
  unit_cost: number | null
  supplier_id: string | null
  active: boolean
}

function deptFromRow(row: DeptRow): DepartmentConfig {
  return {
    id: row.id,
    label: row.label,
    short: row.short,
    colorId: normalizeDepartmentColorId(row.color_id),
  }
}

function clientFromRow(row: ClientRow): Client {
  return {
    id: row.id,
    company: row.company,
    rfc: row.rfc ?? "",
    contact: row.contact ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    industry: row.industry ?? "",
    location: row.location ?? "",
    since: row.since ?? "",
  }
}

function supplierFromRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    preferredChannel: row.preferred_channel ?? "email",
    specialty: row.specialty ?? "",
    location: row.location ?? "",
  }
}

function catalogFromRow(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    sku: row.sku ?? "",
    category: row.category,
    unit: row.unit ?? "pza",
    unitCost: Number(row.unit_cost ?? 0),
    supplierId: row.supplier_id ?? undefined,
  }
}

export async function nextServerCode(kind: string): Promise<string | null> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase.rpc("next_code", { p_kind: kind })
  if (error || typeof data !== "string" || !data) return null
  return data
}

export async function loadCoreWorkspace(): Promise<{
  departments: DepartmentConfig[]
  clients: Client[]
  suppliers: Supplier[]
  catalog: CatalogItem[]
}> {
  const supabase = getSupabaseBrowser()
  const [depts, clients, suppliers, catalog] = await Promise.all([
    supabase.from("departments").select("id, label, short, color_id").order("label"),
    supabase.from("clients").select("id, company, rfc, contact, email, phone, industry, location, since").order("company"),
    supabase.from("suppliers").select("id, name, contact, email, phone, whatsapp, preferred_channel, specialty, location").order("name"),
    supabase.from("catalog_items").select("id, kind, name, sku, category, unit, unit_cost, supplier_id, active").order("name"),
  ])

  return {
    departments:
      depts.data && depts.data.length > 0
        ? (depts.data as DeptRow[]).map(deptFromRow)
        : SEED_DEPARTMENTS.map((d) => ({ ...d })),
    clients: ((clients.data ?? []) as ClientRow[]).map(clientFromRow),
    suppliers: ((suppliers.data ?? []) as SupplierRow[]).map(supplierFromRow),
    catalog: ((catalog.data ?? []) as CatalogRow[])
      .filter((row) => row.active !== false)
      .map(catalogFromRow),
  }
}

export async function persistDepartment(dept: DepartmentConfig) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("departments").upsert({
    id: dept.id,
    label: dept.label,
    short: dept.short,
    color_id: dept.colorId as DepartmentColorId,
  })
  if (error) return { ok: false as const, error: "No se pudo guardar el departamento." }
  return { ok: true as const }
}

export async function deleteDepartment(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("departments").delete().eq("id", id)
  if (error) return { ok: false as const, error: "No se pudo eliminar el departamento." }
  return { ok: true as const }
}

export async function persistClient(client: Client) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("clients").upsert({
    id: client.id,
    company: client.company,
    rfc: client.rfc ?? "",
    contact: client.contact ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    industry: client.industry ?? "",
    location: client.location ?? "",
    since: client.since ?? "",
  })
  if (error) {
    if (error.message.includes("clients_rfc_format")) {
      return { ok: false as const, error: "RFC inválido. Déjalo vacío o usa el formato SAT." }
    }
    return { ok: false as const, error: "No se pudo guardar el cliente." }
  }
  return { ok: true as const }
}

export async function deleteClient(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("clients").delete().eq("id", id)
  if (error) {
    if (error.code === "23503" || /foreign key|violat/i.test(error.message)) {
      return { ok: false as const, error: "No se puede eliminar: hay cotizaciones o proyectos ligados a este cliente." }
    }
    return { ok: false as const, error: "No se pudo eliminar el cliente." }
  }
  return { ok: true as const }
}

export async function persistSupplier(supplier: Supplier) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("suppliers").upsert({
    id: supplier.id,
    name: supplier.name,
    contact: supplier.contact ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    whatsapp: supplier.whatsapp ?? "",
    preferred_channel: supplier.preferredChannel,
    specialty: supplier.specialty ?? "",
    location: supplier.location ?? "",
  })
  if (error) return { ok: false as const, error: "No se pudo guardar el proveedor." }
  return { ok: true as const }
}

export async function deleteSupplier(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("suppliers").delete().eq("id", id)
  if (error) return { ok: false as const, error: "No se pudo eliminar el proveedor." }
  return { ok: true as const }
}

export async function persistCatalogItem(item: CatalogItem) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("catalog_items").upsert({
    id: item.id,
    kind: item.kind,
    name: item.name,
    sku: item.sku ?? "",
    category: item.category,
    unit: item.unit ?? "pza",
    unit_cost: item.unitCost ?? 0,
    supplier_id: item.supplierId || null,
    active: true,
  })
  if (error) {
    const msg = error.message ?? ""
    if (error.code === "42501" || /row-level security|permission denied/i.test(msg)) {
      return {
        ok: false as const,
        error:
          item.kind === "extra"
            ? "No se pudo crear el extra. Pide a administración que active extras de campo."
            : "Solo administración puede crear materiales o mano de obra.",
      }
    }
    return { ok: false as const, error: "No se pudo guardar el ítem de catálogo." }
  }
  return { ok: true as const }
}

export async function deleteCatalogItem(id: string) {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("catalog_items").delete().eq("id", id)
  if (!error) return { ok: true as const }
  const soft = await supabase.from("catalog_items").update({ active: false }).eq("id", id)
  if (soft.error) {
    return { ok: false as const, error: "No se pudo eliminar el ítem. Está usado en cotizaciones." }
  }
  return { ok: true as const }
}

export { catalogRpcKind }
