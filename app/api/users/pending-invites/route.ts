import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!isSupabaseAdminConfigured()) {
    return Response.json({ ok: false, error: "Admin no configurado." }, { status: 503 })
  }
  const token = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7)
    : ""
  if (!token) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 })

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
  if (!actor || actor.role !== "admin" || !actor.active) {
    return Response.json({ ok: false, error: "Solo un admin puede listar invitaciones." }, { status: 403 })
  }

  const pending = new Set<string>()
  const { data: profiles } = await admin.from("profiles").select("id, invite_pending")
  for (const row of profiles ?? []) {
    if ((row as { invite_pending?: boolean }).invite_pending === true) pending.add(row.id)
  }

  return Response.json({ ok: true, ids: [...pending] })
}
