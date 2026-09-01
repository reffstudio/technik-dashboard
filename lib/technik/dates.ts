/** YYYY-MM-DD desde ISO o timestamp de Postgres. */
export function isoDay(value?: string | null): string {
  if (!value) return ""
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ""
}

/** Hoy en el calendario local (no UTC). */
export function todayLocalIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Meses en tres letras (es-MX) para no confundir día y mes. */
export const MONTH_SHORT_ES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
] as const

function fromYmd(y: string, m: string, d: string): string | null {
  const mi = Number(m)
  if (!y || !d || !Number.isInteger(mi) || mi < 1 || mi > 12) return null
  const day = d.replace(/\D.*$/, "").padStart(2, "0")
  if (day === "00" || day.length > 2) return null
  return `${MONTH_SHORT_ES[mi - 1]}/${day}/${y}`
}

/**
 * Fecha visible: SEP/01/2026.
 * ISO solo-día usa el calendario guardado; con hora usa la fecha local.
 */
export function formatDisplayDate(iso?: string | null, empty = ""): string {
  if (!iso?.trim()) return empty
  const raw = iso.trim()
  const hasTime = raw.includes("T") || /\d{4}-\d{2}-\d{2} /.test(raw)
  if (hasTime) {
    const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"))
    if (!Number.isNaN(parsed.getTime())) {
      return `${MONTH_SHORT_ES[parsed.getMonth()]}/${String(parsed.getDate()).padStart(2, "0")}/${parsed.getFullYear()}`
    }
  }
  const [y, m, d] = raw.slice(0, 10).split("-")
  return fromYmd(y ?? "", m ?? "", d ?? "") ?? raw
}
