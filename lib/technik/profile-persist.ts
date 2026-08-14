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

export async function loadProfiles(): Promise<User[]> {
  const supabase = getSupabaseBrowser()
  let { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).order("name")
  if (error && /invite_pending/i.test(error.message)) {
    const retry = await supabase.from("profiles").select(PROFILE_COLUMNS_LEGACY).order("name")
    data = retry.data
    error = retry.error
  }
  if (error || !data) return []
  return (data as ProfileRow[]).map(userFromProfile)
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

  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("profiles")
    .update(body)
    .eq("id", authId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()
  if (error || !data) return { ok: false, error: profileError(error) }
  return { ok: true, user: userFromProfile(data as ProfileRow) }
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

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", authId)
      .select(PROFILE_COLUMNS)
      .maybeSingle()
    if (error || !data) return { ok: false, error: "La foto se subió, pero no se guardó en el perfil." }
    return { ok: true, user: userFromProfile(data as ProfileRow) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo procesar la foto." }
  }
}

export async function clearAvatar(authId: string): Promise<
  { ok: true; user: User } | { ok: false; error: string }
> {
  const supabase = getSupabaseBrowser()
  await supabase.storage.from("avatars").remove([`${authId}/avatar.webp`, `${authId}/avatar.jpg`])
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", authId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()
  if (error || !data) return { ok: false, error: "No se pudo quitar la foto." }
  return { ok: true, user: userFromProfile(data as ProfileRow) }
}
