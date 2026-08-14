import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isValidUsername, sanitizeUsername } from "@/lib/technik/codes"
import { passwordSetupRedirect } from "@/lib/technik/password-setup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

void process.env.SUPABASE_SERVICE_ROLE_KEY
void process.env.SUPABASE_SECRET_KEY

function explainInviteError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
    return "Ese correo ya tiene una cuenta."
  }
  if (m.includes("api key") || m.includes("invalid jwt") || m.includes("not allowed")) {
    return "La SUPABASE_SERVICE_ROLE_KEY no es válida. En Vercel debe ser service_role / sb_secret_, no la publishable."
  }
  if (m.includes("redirect")) {
    return "Agrega http://localhost:3000/** y https://dashboard.solutionstechnik.com/** en Authentication → URL configuration → Redirect URLs (incluye /auth/callback)."
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
    invitePending: boolean
  },
) {
  const row = {
    id: input.id,
    username: input.username,
    name: input.name,
    email: input.email,
    role: input.role,
    department_id: input.department,
    location: input.location,
    since: new Date().getFullYear().toString(),
    active: true,
    invite_pending: input.invitePending,
  }
  let { error } = await admin.from("profiles").upsert(row, { onConflict: "id" })
  if (error && /invite_pending/i.test(error.message)) {
    const { invite_pending: _ignored, ...legacy } = row
    const retry = await admin.from("profiles").upsert(legacy, { onConflict: "id" })
    error = retry.error
  }
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
          "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. Debe ser sb_secret_… o el JWT service_role (eyJ…), no la URL ni la publishable. Reinicia next dev.",
      },
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
    return Response.json(
      { ok: false, error: authError?.message || "Sesión inválida. Cierra sesión y vuelve a entrar." },
      { status: 401 },
    )
  }

  const { data: actor, error: actorError } = await admin
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

  const originHeader = req.headers.get("origin")
  const origin = (originHeader || siteUrl()).replace(/\/$/, "")
  const originWithScheme = origin.startsWith("http") ? origin : `https://${origin}`
  const redirectTo = passwordSetupRedirect(originWithScheme)
  const meta = { name, username, role, must_set_password: true }

  let userId: string | undefined
  let inviteLink: string | undefined
  let emailed = false
  let lastError = ""

  try {
    const invited = await admin.auth.admin.inviteUserByEmail(email, { data: meta, redirectTo })
    if (invited.error) {
      lastError = invited.error.message
    } else if (invited.data?.user?.id) {
      userId = invited.data.user.id
      emailed = true
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Error al enviar la invitación."
  }

  const alreadyRegistered = /already|registered|exists/i.test(lastError)

  if (!emailed && alreadyRegistered) {
    try {
      const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
      if (!resetError) emailed = true
      else lastError = resetError.message
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError
    }
  }

  const linkType = userId || alreadyRegistered ? "recovery" : "invite"
  try {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: linkType,
      email,
      options: { data: meta, redirectTo },
    })
    userId = userId ?? linkData?.user?.id
    inviteLink = linkData?.properties?.action_link
    if (linkError?.message) lastError = linkError.message
  } catch (err) {
    lastError = err instanceof Error ? err.message : lastError || "Error al generar el enlace de invitación."
  }

  if (!userId) {
    return Response.json({ ok: false, error: explainInviteError(lastError) }, { status: 400 })
  }

  await admin.auth.admin.updateUserById(userId, { user_metadata: meta }).catch(() => null)

  if (inviteLink) {
    try {
      const link = new URL(inviteLink)
      if (link.searchParams.has("redirect_to")) link.searchParams.set("redirect_to", redirectTo)
      inviteLink = link.toString()
    } catch {
      /* keep original */
    }
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, invite_pending")
    .eq("id", userId)
    .maybeSingle()
  const invitePending = existingProfile ? existingProfile.invite_pending === true : true

  const profileError = await ensureProfile(admin, {
    id: userId,
    username,
    name,
    email,
    role,
    department,
    location,
    invitePending,
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

  return Response.json({
    ok: true,
    id: userId,
    emailed,
    inviteLink,
    mailError: emailed ? undefined : lastError || undefined,
  })
}
