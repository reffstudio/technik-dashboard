import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isValidUsername, sanitizeUsername } from "@/lib/technik/codes"

function explainInviteError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
    return "Ese correo ya tiene una cuenta."
  }
  if (m.includes("api key") || m.includes("invalid jwt") || m.includes("not allowed")) {
    return "La SUPABASE_SERVICE_ROLE_KEY no es válida. En Vercel debe ser service_role / sb_secret_, no la publishable."
  }
  if (m.includes("redirect")) {
    return "Agrega https://dashboard.solutionstechnik.com y https://dashboard.solutionstechnik.com/** en Authentication → URL configuration → Redirect URLs."
  }
  if (m.includes("sign up") || m.includes("signup") || m.includes("disabled")) {
    return "Activa el proveedor Email en Authentication → Sign in / Providers (Allow new users to sign up)."
  }
  if (m.includes("rate")) {
    return "Supabase limitó el envío de correos. Espera un minuto e inténtalo de nuevo."
  }
  return msg.trim() || "No se pudo crear la invitación."
}

async function ensureProfile(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: {
    id: string
    username: string
    name: string
    email: string
    role: "admin" | "empleado"
    department: string
    location: string
  },
) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: input.id,
      username: input.username,
      name: input.name,
      email: input.email,
      role: input.role,
      department_id: input.department,
      location: input.location,
      since: new Date().getFullYear().toString(),
      active: true,
    },
    { onConflict: "id" },
  )
  return error
}

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
  const meta = { name, username, role }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: meta,
    redirectTo: origin,
  })

  let userId = invited?.user?.id
  let emailed = Boolean(userId) && !inviteError
  let inviteLink: string | undefined

  if (!userId) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: meta, redirectTo: origin },
    })
    userId = linkData?.user?.id
    inviteLink = linkData?.properties?.action_link
    if (!userId) {
      const raw = inviteError?.message || linkError?.message || ""
      return Response.json({ ok: false, error: explainInviteError(raw) }, { status: 400 })
    }
    emailed = false
  }

  const profileError = await ensureProfile(admin, {
    id: userId,
    username,
    name,
    email,
    role,
    department,
    location,
  })
  if (profileError) {
    if (profileError.code === "23505") {
      return Response.json({ ok: false, error: "Ese username o correo ya está en uso." }, { status: 409 })
    }
    return Response.json(
      { ok: false, error: profileError.message || "No se pudo crear el perfil." },
      { status: 400 },
    )
  }

  return Response.json({ ok: true, id: userId, emailed, inviteLink })
}
