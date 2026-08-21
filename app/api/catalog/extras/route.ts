import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { nextCatalogCode } from "@/lib/technik/codes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

void process.env.SUPABASE_SERVICE_ROLE_KEY
void process.env.SUPABASE_SECRET_KEY

type Body = {
  id?: string
  name?: string
  unit?: string
  sku?: string
  category?: string
  unitCost?: number
}

export async function POST(req: Request) {
  if (!isSupabaseAdminConfigured()) {
    return Response.json(
      { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY para guardar extras." },
      { status: 503 },
    )
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!token) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    return Response.json({ ok: false, error: "Sesión inválida." }, { status: 401 })
  }

  const { data: actor } = await admin
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .maybeSingle()
  if (!actor?.active || (actor.role !== "admin" && actor.role !== "empleado")) {
    return Response.json({ ok: false, error: "No tienes permiso para crear extras." }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as Body | null
  const name = body?.name?.trim() ?? ""
  if (!name) {
    return Response.json({ ok: false, error: "El nombre del extra es obligatorio." }, { status: 400 })
  }

  const { data: existing } = await admin.from("catalog_items").select("id").eq("kind", "extra")
  const ids = (existing ?? []).map((row) => row.id as string)
  const id = body?.id?.trim() || nextCatalogCode(ids, "extra", "Extra")
  const unitCost = actor.role === "admin" ? Math.max(0, Number(body?.unitCost) || 0) : 0

  const row = {
    id,
    kind: "extra" as const,
    name,
    sku: body?.sku?.trim() || `FIELD-${Date.now().toString(36).toUpperCase()}`,
    category: body?.category?.trim() || "Extra",
    unit: body?.unit?.trim() || "ud",
    unit_cost: unitCost,
    supplier_id: null,
    active: true,
  }

  const { error } = await admin.from("catalog_items").insert(row)
  if (error) {
    return Response.json(
      { ok: false, error: error.message || "No se pudo crear el extra." },
      { status: 400 },
    )
  }

  return Response.json({
    ok: true,
    id,
    item: {
      id,
      kind: "extra",
      name: row.name,
      sku: row.sku,
      category: row.category,
      unit: row.unit,
      unitCost,
      supplierId: undefined,
      active: true,
    },
  })
}
