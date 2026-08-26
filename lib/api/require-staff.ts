import { NextResponse } from "next/server"
import { getSupabaseAdmin, getSupabaseAuthed, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/public-env"

export type StaffActor = {
  id: string
  email?: string
  role: "admin" | "empleado"
  name: string
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization")
  return header?.startsWith("Bearer ") ? header.slice(7) : ""
}

export async function requireStaff(
  req: Request,
  opts?: { adminOnly?: boolean },
): Promise<{ ok: true; actor: StaffActor } | { ok: false; response: NextResponse }> {
  if (!isSupabaseConfigured() && !isSupabaseAdminConfigured()) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Servidor sin Supabase." }, { status: 503 }) }
  }

  const token = bearerToken(req)
  if (!token) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 }) }
  }

  try {
    if (isSupabaseAdminConfigured()) {
      const admin = getSupabaseAdmin()
      const { data: authData, error: authError } = await admin.auth.getUser(token)
      if (authError || !authData.user) {
        return { ok: false, response: NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 }) }
      }
      const { data: actor, error: actorError } = await admin
        .from("profiles")
        .select("id, role, active, email, name")
        .eq("id", authData.user.id)
        .maybeSingle()
      if (actorError || !actor || !actor.active) {
        return {
          ok: false,
          response: NextResponse.json({ ok: false, error: "No se encontró tu perfil." }, { status: 403 }),
        }
      }
      if (actor.role !== "admin" && actor.role !== "empleado") {
        return { ok: false, response: NextResponse.json({ ok: false, error: "Sin permiso." }, { status: 403 }) }
      }
      if (opts?.adminOnly && actor.role !== "admin") {
        return {
          ok: false,
          response: NextResponse.json({ ok: false, error: "Solo administración." }, { status: 403 }),
        }
      }
      return {
        ok: true,
        actor: {
          id: actor.id,
          email: typeof actor.email === "string" ? actor.email : authData.user.email,
          role: actor.role,
          name: typeof actor.name === "string" ? actor.name : "Usuario",
        },
      }
    }

    const authed = getSupabaseAuthed(token)
    const { data: authData, error: authError } = await authed.auth.getUser(token)
    if (authError || !authData.user) {
      return { ok: false, response: NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 }) }
    }
    const { data: actor } = await authed
      .from("profiles")
      .select("id, role, active, email, name")
      .eq("id", authData.user.id)
      .maybeSingle()
    if (!actor?.active || (actor.role !== "admin" && actor.role !== "empleado")) {
      return { ok: false, response: NextResponse.json({ ok: false, error: "Sin permiso." }, { status: 403 }) }
    }
    if (opts?.adminOnly && actor.role !== "admin") {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: "Solo administración." }, { status: 403 }),
      }
    }
    return {
      ok: true,
      actor: {
        id: actor.id,
        email: typeof actor.email === "string" ? actor.email : authData.user.email,
        role: actor.role,
        name: typeof actor.name === "string" ? actor.name : "Usuario",
      },
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "No se pudo validar la sesión." }, { status: 503 }),
    }
  }
}
