import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

const SIGNED_TTL_SEC = 60 * 60 * 12
const QUOTE_PUBLIC = "/object/public/quote-images/"
const QUOTE_SIGN = "/object/sign/quote-images/"

function decodePath(raw: string) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function visitRefFromCover(path: string): { quotationId: string; photoId: string } | null {
  const api = path.match(/\/api\/quotes\/([^/?#]+)\/photos\/([^/?#]+)/)
  if (api) {
    return { quotationId: decodePath(api[1]), photoId: decodePath(api[2]) }
  }
  const sign = path.match(/\/object\/sign\/visit-photos\/([^/?#]+)\/([^/?#]+)/)
  if (sign) {
    return { quotationId: decodePath(sign[1]), photoId: decodePath(sign[2]).replace(/\.(thumb\.)?(jpe?g|webp)$/i, "") }
  }
  return null
}

function quoteImagesPath(raw: string): string | null {
  for (const marker of [QUOTE_PUBLIC, QUOTE_SIGN]) {
    const idx = raw.indexOf(marker)
    if (idx >= 0) {
      const rest = decodePath(raw.slice(idx + marker.length).split("?")[0])
      if (rest && !rest.startsWith("http")) return rest
    }
  }
  if (raw.startsWith("http") || raw.startsWith("/") || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return null
  }
  return raw
}

async function signBucket(bucket: string, paths: string[]) {
  const out = new Map<string, string>()
  if (paths.length === 0 || !isSupabaseAdminConfigured()) return out
  const admin = getSupabaseAdmin()
  const unique = [...new Set(paths)]
  const { data } = await admin.storage.from(bucket).createSignedUrls(unique, SIGNED_TTL_SEC)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl)
  }
  return out
}

/** Portadas firmadas con service role: el colaborador no pasa RLS de storage ni de cotizaciones. */
export async function signedProjectCoverMap(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!isSupabaseAdminConfigured()) return out
  const admin = getSupabaseAdmin()

  const { data: projectRows } = await admin
    .from("projects")
    .select("id, cover_image_path, quotation_id")
  const projects = (projectRows ?? []) as {
    id: string
    cover_image_path: string | null
    quotation_id: string | null
  }[]
  if (projects.length === 0) return out

  const quoteIds = [...new Set(projects.map((row) => row.quotation_id).filter(Boolean))] as string[]
  const quoteCover = new Map<string, string | null>()
  if (quoteIds.length > 0) {
    const { data: quoteRows } = await admin
      .from("quotations")
      .select("id, cover_image_path")
      .in("id", quoteIds)
    for (const row of (quoteRows ?? []) as { id: string; cover_image_path: string | null }[]) {
      quoteCover.set(row.id, row.cover_image_path)
    }
  }

  type Entry = { projectId: string; path: string }
  const visitEntries: (Entry & { quotationId: string; photoId: string })[] = []
  const quoteEntries: Entry[] = []
  const passthrough: Entry[] = []

  for (const row of projects) {
    const raw = (row.cover_image_path || (row.quotation_id ? quoteCover.get(row.quotation_id) : null) || "").trim()
    if (!raw) continue
    if (raw.startsWith("data:") || raw.startsWith("blob:") || raw.startsWith("/brand/")) {
      passthrough.push({ projectId: row.id, path: raw })
      continue
    }
    const visit = visitRefFromCover(raw)
    if (visit) {
      visitEntries.push({ projectId: row.id, path: raw, ...visit })
      continue
    }
    const stored = quoteImagesPath(raw)
    if (stored) {
      quoteEntries.push({ projectId: row.id, path: stored })
      continue
    }
    passthrough.push({ projectId: row.id, path: raw })
  }

  for (const item of passthrough) out.set(item.projectId, item.path)

  if (visitEntries.length > 0) {
    const photoIds = [...new Set(visitEntries.map((item) => item.photoId))]
    const { data: photoRows } = await admin
      .from("quotation_visit_photos")
      .select("id, storage_path, thumb_path")
      .in("id", photoIds)
    const byId = new Map(
      ((photoRows ?? []) as { id: string; storage_path: string; thumb_path: string | null }[]).map((row) => [
        row.id,
        row,
      ]),
    )
    const storagePaths = [
      ...new Set(
        [...byId.values()].flatMap((row) => [row.thumb_path, row.storage_path].filter(Boolean) as string[]),
      ),
    ]
    const signed = await signBucket("visit-photos", storagePaths)
    for (const item of visitEntries) {
      const row = byId.get(item.photoId)
      const url =
        (row?.thumb_path ? signed.get(row.thumb_path) : undefined) ||
        (row?.storage_path ? signed.get(row.storage_path) : undefined)
      if (url) out.set(item.projectId, url)
    }
  }

  if (quoteEntries.length > 0) {
    const signed = await signBucket(
      "quote-images",
      quoteEntries.map((item) => item.path),
    )
    for (const item of quoteEntries) {
      const url = signed.get(item.path)
      if (url) out.set(item.projectId, url)
    }
  }

  return out
}
