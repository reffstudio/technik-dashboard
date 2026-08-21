import { getSupabaseBrowser } from "@/lib/supabase/browser"
import { PROFILE_COLUMNS, PROFILE_COLUMNS_LEGACY, userFromProfile, type ProfileRow } from "./auth-profile"
import { isValidUsername, sanitizeUsername } from "./codes"
import { compressAvatar } from "./compress-image"
import type { User } from "./data"

export type ProfilePatch = Partial<Pick<User, "name" | "username" | "department" | "location" | "active">>

function profileError(error: { code?: string; message?: string } | null): string {
  const code = error?.code ?? ""
  const message = error?.message ?? ""
  if (code === "23505" || message.includes("profiles_username") || message.includes("profiles_email")) {
    return "Ese username o correo ya está en uso."
  }
  if (message.includes("profiles_username_format")) {
    return "El username debe tener 2–32 caracteres (a-z, 0-9 o _)."
  }
  return "No se pudieron guardar los cambios."
}

export async function loadProfiles(): Promise<{ ok: true; users: User[] } | { ok: false }> {
  const supabase = getSupabaseBrowser()
  let { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).order("name")
  if (error && /invite_pending/i.test(error.message)) {
    const retry = await supabase.from("profiles").select(PROFILE_COLUMNS_LEGACY).order("name")
    data = (retry.data ?? null) as typeof data
    error = retry.error
  }
  if (error || !data) return { ok: false }
  return { ok: true, users: (data as ProfileRow[]).map(userFromProfile) }
}

async function updateProfileAndRead(authId: string, body: Record<string, unknown>) {
  const supabase = getSupabaseBrowser()
  let { data, error } = await supabase
    .from("profiles")
    .update(body)
    .eq("id", authId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()
  if (error && /invite_pending/i.test(error.message)) {
    const retry = await supabase
      .from("profiles")
      .update(body)
      .eq("id", authId)
      .select(PROFILE_COLUMNS_LEGACY)
      .maybeSingle()
    data = (retry.data ?? null) as typeof data
    error = retry.error
  }
  if (error) return { ok: false as const, error: profileError(error) }
  if (!data) {
    return {
      ok: false as const,
      error: "No se pudo guardar el perfil. Recarga e inténtalo de nuevo.",
    }
  }
  return { ok: true as const, user: userFromProfile(data as ProfileRow) }
}

export async function persistProfile(authId: string, patch: ProfilePatch): Promise<
  { ok: true; user: User } | { ok: false; error: string }
> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name.trim()
  if (patch.department !== undefined) body.department_id = patch.department
  if (patch.location !== undefined) body.location = patch.location.trim()
  if (patch.active !== undefined) body.active = patch.active
  if (patch.username !== undefined) {
    const username = sanitizeUsername(patch.username)
    if (!isValidUsername(username)) {
      return { ok: false, error: "El username debe tener 2–32 caracteres (a-z, 0-9 o _)." }
    }
    body.username = username
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, error: "No hay cambios para guardar." }
  }

  return updateProfileAndRead(authId, body)
}

export async function persistAvatar(authId: string, file: File): Promise<
  { ok: true; user: User } | { ok: false; error: string }
> {
  try {
    const { blob, mime } = await compressAvatar(file)
    const ext = mime === "image/webp" ? "webp" : "jpg"
    const path = `${authId}/avatar.${ext}`
    const supabase = getSupabaseBrowser()
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, {
      upsert: true,
      contentType: mime,
      cacheControl: "3600",
    })
    if (uploadError) return { ok: false, error: "No se pudo subir la foto." }

    const saved = await updateProfileAndRead(authId, { avatar_path: path })
    if (!saved.ok) return { ok: false, error: "La foto se subió, pero no se guardó en el perfil." }
    return saved
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo procesar la foto." }
  }
}

export async function clearAvatar(authId: string): Promise<
  { ok: true; user: User } | { ok: false; error: string }
> {
  const supabase = getSupabaseBrowser()
  await supabase.storage.from("avatars").remove([`${authId}/avatar.webp`, `${authId}/avatar.jpg`])
  const saved = await updateProfileAndRead(authId, { avatar_path: null })
  if (!saved.ok) return { ok: false, error: saved.error || "No se pudo quitar la foto." }
  return saved
}
