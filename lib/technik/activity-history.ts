import { formatDisplayDate } from "./dates"

export type ActivityStamp = { at: string; action: string; by?: string }

/** Clave estable (UTC al minuto) para no duplicar historial por zona horaria. */
export function activityEventKey(at: string, action: string) {
  const raw = at.includes("T") ? at : at.replace(" ", "T")
  const ms = Date.parse(raw)
  const bucket = Number.isNaN(ms) ? at.slice(0, 16) : new Date(ms).toISOString().slice(0, 16)
  return `${bucket}|${action}`
}

export function dedupeActivityHistory<T extends ActivityStamp>(list: T[] | undefined): T[] {
  if (!list?.length) return []
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of list) {
    const key = activityEventKey(item.at, item.action)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.sort((a, b) => {
    const am = Date.parse(a.at.includes("T") ? a.at : a.at.replace(" ", "T"))
    const bm = Date.parse(b.at.includes("T") ? b.at : b.at.replace(" ", "T"))
    return (Number.isNaN(am) ? 0 : am) - (Number.isNaN(bm) ? 0 : bm)
  })
}

export function formatActivityAt(at: string): { date: string; time?: string; label: string } {
  const iso = at.includes("T") ? at : at.replace(" ", "T")
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: at, label: at }
  const date = formatDisplayDate(iso, at)
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
  return { date, time, label: `${date} ${time}` }
}

export function mergeActivityHistory<T extends ActivityStamp>(a?: T[], b?: T[]): T[] {
  return dedupeActivityHistory([...(a ?? []), ...(b ?? [])])
}
