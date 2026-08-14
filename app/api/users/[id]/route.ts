import {
  getSupabaseAdmin,
  getSupabaseAuthed,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

void process.env.SUPABASE_SERVICE_ROLE_KEY
void process.env.SUPABASE_SECRET_KEY

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!token) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const { id: targetId } = await params
  if (!targetId || !isUuid(targetId)) {
    return Response.json({ ok: false, error: "Usuario inválido." }, { status: 400 })
  }

  let authed
  try {
    authed = getSupabaseAuthed(token)
  } catch {
    return Response.json({ ok: false, error: "Supabase no está configurado." }, { status: 503 })
  }

  const { data: authData, error: authError } = await authed.auth.getUser(token)
  if (authError || !authData.user) {
    return Response.json({ ok: false, error: "Sesión inválida. Cierra sesión y vuelve a entrar." }, { status: 401 })
  }

  const { data: actor, error: actorError } = await authed
    .from("profiles")
    .select("id, role, active")
    .eq("id", authData.user.id)
    .maybeSingle()
  if (actorError || !actor || actor.role !== "admin" || !actor.active) {
    return Response.json({ ok: false, error: "Solo un admin puede eliminar usuarios." }, { status: 403 })
  }
  if (actor.id === targetId) {
    return Response.json({ ok: false, error: "No puedes eliminar tu propia cuenta." }, { status: 400 })
  }

  const { data: target } = await authed
    .from("profiles")
    .select("id, role, avatar_path")
    .eq("id", targetId)
    .maybeSingle()
  if (!target) {
    return Response.json({ ok: false, error: "Ese usuario ya no existe." }, { status: 404 })
  }

  if (target.role === "admin") {
    const { count } = await authed
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true)
    if ((count ?? 0) <= 1) {
      return Response.json({ ok: false, error: "No se puede eliminar al último administrador." }, { status: 400 })
    }
  }

  await authed.from("quotations").update({ created_by: actor.id }).eq("created_by", targetId)
  await authed.from("projects").update({ created_by: actor.id }).eq("created_by", targetId)

  if (target.avatar_path) {
    await authed.storage.from("avatars").remove([target.avatar_path, `${targetId}/avatar.webp`, `${targetId}/avatar.jpg`])
  }

  if (isSupabaseAdminConfigured()) {
    const admin = getSupabaseAdmin()
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId)
    if (deleteError) {
      return Response.json(
        { ok: false, error: deleteError.message || "No se pudo eliminar la cuenta." },
        { status: 400 },
      )
    }
    return Response.json({ ok: true })
  }

  const { error: profileError } = await authed.from("profiles").delete().eq("id", targetId)
  if (profileError) {
    return Response.json(
      { ok: false, error: profileError.message || "No se pudo eliminar el perfil." },
      { status: 400 },
    )
  }
  return Response.json({ ok: true })
}
