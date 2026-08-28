/**
 * Technik Solutions — Sistema de códigos (TKS)
 *
 * | Entidad      | Formato              | Ejemplo            |
 * |--------------|----------------------|--------------------|
 * | Usuario      | username             | iochoa (@)         |
 * | Cotización   | TKS-Q-YYYY-####      | TKS-Q-2026-2041    |
 * | Proyecto     | = folio cotización   | TKS-Q-2026-2041    |
 * | Proyecto N/A | TKS-P-YYYY-####      | TKS-P-2026-0001    |
 * | Cliente      | TKS-C-####           | TKS-C-1042         |
 * | Proveedor    | TKS-V-###            | TKS-V-001          |
 * | Material     | TKS-M-###            | TKS-M-001          |
 * | Componente   | TKS-K-###            | TKS-K-010          |
 * | Consumible   | TKS-N-###            | TKS-N-020          |
 * | Mano de obra | TKS-L-###            | TKS-L-001          |
 * | Extra        | TKS-E-###            | TKS-E-001          |
 */

export const BRAND_CODE = "TKS"

type CatalogKind = "material" | "labor" | "extra"
type CatalogCategory =
  | "Material"
  | "Componente"
  | "Consumible"
  | "Mano de obra"
  | "Extra"
  | "Viático"
  | "Flete"
  | "Otro"

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0")
}

/** Genera username a partir del nombre completo: "Isaac Ochoa" → "iochoa" */
export function usernameFromName(name: string): string {
  const parts = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 16)

  const first = parts[0][0] ?? "u"
  const last = parts[parts.length - 1] ?? "user"
  return `${first}${last}`.slice(0, 16)
}

export function formatUsername(username: string): string {
  const clean = username.replace(/^@/, "")
  return `@${clean}`
}

export function sanitizeUsername(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32)
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{2,32}$/.test(username)
}

export function nextQuotationCode(existing: string[], year = new Date().getFullYear()): string {
  const prefix = `${BRAND_CODE}-Q-${year}-`
  let max = 2000
  for (const code of existing) {
    if (!code?.startsWith(prefix)) continue
    const n = Number(code.slice(prefix.length))
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${pad(max + 1, 4)}`
}

/**
 * Folio solo para proyectos sin cotización (N/A).
 * Proyectos nacidos de cotización usan el mismo `TKS-Q-…`.
 */
export function nextProjectCode(existing: string[], year = new Date().getFullYear()): string {
  const prefix = `${BRAND_CODE}-P-${year}-`
  let max = 0
  for (const code of existing) {
    if (!code?.startsWith(prefix)) continue
    const n = Number(code.slice(prefix.length))
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${pad(max + 1, 4)}`
}

export function nextClientCode(existing: string[]): string {
  const prefix = `${BRAND_CODE}-C-`
  let max = 1000
  for (const code of existing) {
    if (!code?.startsWith(prefix)) continue
    const n = Number(code.slice(prefix.length))
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${pad(max + 1, 4)}`
}

export function nextVendorCode(existing: string[]): string {
  const prefix = `${BRAND_CODE}-V-`
  let max = 0
  for (const code of existing) {
    if (!code?.startsWith(prefix)) continue
    const n = Number(code.slice(prefix.length))
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${pad(max + 1, 3)}`
}

export function catalogRpcKind(kind: CatalogKind, category: CatalogCategory): string {
  if (kind === "labor" || category === "Mano de obra") return "catalog_l"
  if (kind === "extra") return "catalog_e"
  if (category === "Componente") return "catalog_k"
  if (category === "Consumible") return "catalog_n"
  return "catalog_m"
}

export function catalogPrefix(kind: CatalogKind, category: CatalogCategory): string {
  if (kind === "labor" || category === "Mano de obra") return `${BRAND_CODE}-L-`
  if (kind === "extra") return `${BRAND_CODE}-E-`
  if (category === "Componente") return `${BRAND_CODE}-K-`
  if (category === "Consumible") return `${BRAND_CODE}-N-`
  return `${BRAND_CODE}-M-`
}

export function nextCatalogCode(
  existing: string[],
  kind: CatalogKind,
  category: CatalogCategory,
): string {
  const prefix = catalogPrefix(kind, category)
  let max = 0
  for (const code of existing) {
    if (!code?.startsWith(prefix)) continue
    const n = Number(code.slice(prefix.length))
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${pad(max + 1, 3)}`
}

export function uniqueUsername(base: string, existing: string[]): string {
  const clean = base.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "") || "user"
  if (!existing.includes(clean)) return clean
  let i = 2
  while (existing.includes(`${clean}${i}`)) i++
  return `${clean}${i}`
}

/** ID de departamento a partir del nombre: "Soldadura y maquinados" → "soldadura_y_maquinados" */
export function departmentIdFromLabel(label: string, existing: string[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "departamento"
  if (!existing.includes(base)) return base
  let i = 2
  while (existing.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}
