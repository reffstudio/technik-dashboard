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
}

export function userFromProfile(row: ProfileRow): User {
  return {
    id: row.username,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
    password: "",
    department: row.department_id as WorkDepartment,
    location: row.location ?? "",
    since: row.since ?? "",
    active: row.active,
    avatarUrl: row.avatar_path ?? undefined,
  }
}
