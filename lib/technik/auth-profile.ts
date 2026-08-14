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
  invite_pending?: boolean
  updated_at?: string | null
}

export const PROFILE_COLUMNS =
  "id, username, name, email, role, department_id, location, since, active, avatar_path, invite_pending, updated_at"

export const PROFILE_COLUMNS_LEGACY =
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
    invitePending: row.invite_pending === true,
    avatarUrl: publicAvatarUrl(row.avatar_path, row.updated_at),
  }
}

export function dedupeUsers(list: User[]): User[] {
  const byAuth = new Map<string, User>()
  const leftover: User[] = []
  for (const u of list) {
    if (u.authId) byAuth.set(u.authId, u)
    else leftover.push(u)
  }
  const emails = new Set(
    [...byAuth.values()].map((u) => u.email.trim().toLowerCase()).filter(Boolean),
  )
  const usernames = new Set(
    [...byAuth.values()].map((u) => u.username.trim().toLowerCase()).filter(Boolean),
  )
  for (const u of leftover) {
    const email = u.email.trim().toLowerCase()
    const username = u.username.trim().toLowerCase()
    if (email && emails.has(email)) continue
    if (username && usernames.has(username)) continue
    if (email) emails.add(email)
    if (username) usernames.add(username)
    byAuth.set(`local:${u.id}`, u)
  }
  return Array.from(byAuth.values())
}
