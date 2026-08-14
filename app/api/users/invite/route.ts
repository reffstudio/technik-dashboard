import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isValidUsername, sanitizeUsername } from "@/lib/technik/codes"

export const dynamic = "force-dynamic"

type Body = {
  name?: string
  email?: string
  username?: string
  role?: "admin" | "empleado"
  department?: string
  location?: string
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://dashboard.solutionstechnik.com"
  ).replace(/\/$/, "")
}

export async function POST(req: Request) {
  if (!isSupabaseAdminConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel (.env del servidor). Agrégala y vuelve a desplegar.",
      },
      { status: 503 },
    )
  }

  const { url, key: publishable } = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!url || !publishable || !token) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  if (authError || !authData.user) {
    return Response.json({ ok: false, error: "Sesión inválida." }, { status: 401 })
  }

  const { data: actor, error: actorError } = await userClient
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .maybeSingle()
  if (actorError || !actor) {
    return Response.json({ ok: false, error: "No se encontró tu perfil para validar el rol." }, { status: 403 })
  }
  if (actor.role !== "admin" || !actor.active) {
    return Response.json({ ok: false, error: "Solo un admin puede invitar." }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  const body = (await req.json()) as Body
  const name = body.name?.trim() ?? ""
  const email = body.email?.trim().toLowerCase() ?? ""
  const username = sanitizeUsername(body.username ?? "")
  const role = body.role === "admin" ? "admin" : "empleado"
  const department = body.department?.trim() ?? ""
  const location = body.location?.trim() ?? ""

  if (!name || !email || !department) {
    return Response.json({ ok: false, error: "Nombre, correo y departamento son obligatorios." }, { status: 400 })
  }
  if (!isValidUsername(username)) {
    return Response.json(
      { ok: false, error: "El username debe tener 2–32 caracteres (a-z, 0-9 o _)." },
      { status: 400 },
    )
  }

  const origin = siteUrl().startsWith("http") ? siteUrl() : `https://${siteUrl()}`
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name, username, role },
    redirectTo: origin,
  })
  if (inviteError || !invited.user) {
    const msg = inviteError?.message ?? ""
    if (msg.toLowerCase().includes("already")) {
      return Response.json({ ok: false, error: "Ese correo ya tiene una cuenta." }, { status: 409 })
    }
    return Response.json(
      { ok: false, error: "No se pudo enviar la invitación. Revisa Auth → Email en Supabase." },
      { status: 400 },
    )
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    username,
    name,
    email,
    role,
    department_id: department,
    location,
    since: new Date().getFullYear().toString(),
    active: true,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id)
    if (profileError.code === "23505") {
      return Response.json({ ok: false, error: "Ese username o correo ya está en uso." }, { status: 409 })
    }
    return Response.json({ ok: false, error: "No se pudo crear el perfil." }, { status: 400 })
  }

  return Response.json({ ok: true, id: invited.user.id })
}
