import { supabasePublicEnv } from "@/lib/supabase/public-env"
import type { User, WorkDepartment } from "./data"

export type ProfileRow = {
  id: string
  username: string
  name: string
  email: string
  role: "admin" | "empleado"
  department_id: string
  location: string | null
  since: string | null
  active: boolean
  avatar_path: string | null
  updated_at?: string | null
}

export const PROFILE_COLUMNS =
  "id, username, name, email, role, department_id, location, since, active, avatar_path, updated_at"

export function publicAvatarUrl(path: string | null | undefined, version?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("/")) {
    return path
  }
  const { url } = supabasePublicEnv()
  if (!url) return undefined
  const base = `${url}/storage/v1/object/public/avatars/${path}`
  const stamp = version ? Date.parse(version) : 0
  return stamp ? `${base}?v=${stamp}` : base
}

export function userFromProfile(row: ProfileRow): User {
  return {
    id: row.username,
    authId: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
    password: "",
    department: row.department_id as WorkDepartment,
    location: row.location ?? "",
    since: row.since ?? "",
    active: row.active,
    avatarUrl: publicAvatarUrl(row.avatar_path, row.updated_at),
  }
}
