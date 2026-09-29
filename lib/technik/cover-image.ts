import { getSupabaseBrowser } from "@/lib/supabase/browser"

const BUCKET = "quote-images"
const PUBLIC_MARKER = `/object/public/${BUCKET}/`

function decodePath(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function storagePathFromUrl(imageUrl: string): string | null {
  let rest = imageUrl
  let found = false
  while (true) {
    const idx = rest.indexOf(PUBLIC_MARKER)
    if (idx < 0) break
    found = true
    rest = decodePath(rest.slice(idx + PUBLIC_MARKER.length).split("?")[0])
  }
  if (!found) return null
  if (!rest || rest.startsWith("http")) return null
  return rest
}

function visitCoverStorageRef(imageUrl: string): string | null {
  const api = imageUrl.match(/\/api\/quotes\/([^/?#]+)\/photos\/([^/?#]+)/)
  if (api) return `/api/quotes/${decodePath(api[1])}/photos/${decodePath(api[2])}`
  const sign = imageUrl.match(/\/object\/sign\/visit-photos\/([^/?#]+)\/([^/?#.]+)/)
  if (sign) return `/api/quotes/${decodePath(sign[1])}/photos/${decodePath(sign[2])}`
  return null
}

export async function persistStorageImage(
  path: string,
  imageUrl: string | undefined,
): Promise<string | null> {
  if (!imageUrl) return null
  if (imageUrl.startsWith("/brand/")) return null
  const visitRef = visitCoverStorageRef(imageUrl)
  if (visitRef) return visitRef
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i)
    if (!match) return null
    const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase()
    const raw = match[2]
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const supabase = getSupabaseBrowser()
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    })
    if (error) {
      console.warn("[technik] No se pudo subir imagen", error.message)
      return null
    }
    return path
  }
  const fromPublic = storagePathFromUrl(imageUrl)
  if (fromPublic) return fromPublic
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl
  return imageUrl
}

export function storagePublicUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (path.startsWith("data:") || path.startsWith("blob:")) return path
  if (path.startsWith("/")) return path
  const visitRef = visitCoverStorageRef(path)
  if (visitRef) return visitRef
  const stored = storagePathFromUrl(path) ?? (path.startsWith("http") ? null : path)
  if (!stored) return path
  const supabase = getSupabaseBrowser()
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(stored)
  return data.publicUrl
}

export function coverPathForQuote(quotationId: string, ext = "jpg") {
  return `${quotationId}/cover.${ext}`
}

export function coverPathForProject(projectId: string, ext = "jpg") {
  return `projects/${projectId}/cover.${ext}`
}

export function extFromDataUrl(imageUrl: string) {
  if (imageUrl.includes("image/webp")) return "webp"
  if (imageUrl.includes("image/png")) return "png"
  return "jpg"
}

const VISIT_API_RE = /\/api\/quotes\/([^/?#]+)\/photos\/([^/?#]+)/
export const SIGNED_TTL_SEC = 60 * 60 * 12
/** Reusar la URL firmada hasta 2 min antes de que caduque (evita recargar todas las fotos). */
const SIGNED_REUSE_SLACK_MS = 2 * 60 * 1000

type SignedCacheEntry = { url: string; expiresAt: number }
const signedUrlCache = new Map<string, SignedCacheEntry>()

function signedCacheKey(bucket: string, path: string) {
  return `${bucket}:${path}`
}

function cachedSignedUrl(bucket: string, path: string): string | undefined {
  const hit = signedUrlCache.get(signedCacheKey(bucket, path))
  if (!hit) return undefined
  if (hit.expiresAt - Date.now() <= SIGNED_REUSE_SLACK_MS) {
    signedUrlCache.delete(signedCacheKey(bucket, path))
    return undefined
  }
  return hit.url
}

function rememberSignedUrl(bucket: string, path: string, url: string, ttlSec = SIGNED_TTL_SEC) {
  signedUrlCache.set(signedCacheKey(bucket, path), {
    url,
    expiresAt: Date.now() + ttlSec * 1000,
  })
}

/** Firma solo las rutas que no tienen una URL vigente en caché. */
export async function signStoragePaths(
  bucket: string,
  paths: string[],
  ttlSec = SIGNED_TTL_SEC,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const missing: string[] = []
  for (const path of paths) {
    const cached = cachedSignedUrl(bucket, path)
    if (cached) out.set(path, cached)
    else missing.push(path)
  }
  if (missing.length === 0) return out
  const supabase = getSupabaseBrowser()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, ttlSec)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      rememberSignedUrl(bucket, item.path, item.signedUrl, ttlSec)
      out.set(item.path, item.signedUrl)
    }
  }
  return out
}

function visitRefFromCover(path: string): { quotationId: string; photoId: string } | null {
  const api = path.match(VISIT_API_RE)
  if (!api) return null
  return {
    quotationId: decodePath(api[1]),
    photoId: decodePath(api[2]),
  }
}

/** URLs firmadas para que el colaborador vea portadas sin abrir la cotización. */
export async function resolveProjectCoverMap(
  entries: { projectId: string; coverPath: string | null | undefined }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const visitRefs: { projectId: string; quotationId: string; photoId: string }[] = []
  const quoteImagePaths: { projectId: string; path: string }[] = []

  for (const entry of entries) {
    const raw = entry.coverPath?.trim()
    if (!raw) continue
    if (raw.startsWith("data:") || raw.startsWith("blob:") || raw.startsWith("/brand/")) {
      out.set(entry.projectId, raw)
      continue
    }
    const visit = visitRefFromCover(raw) ?? visitRefFromCover(visitCoverStorageRef(raw) ?? "")
    if (visit) {
      visitRefs.push({ projectId: entry.projectId, ...visit })
      continue
    }
    if (raw.startsWith("http") && raw.includes("/object/sign/")) {
      out.set(entry.projectId, raw)
      continue
    }
    const stored = storagePathFromUrl(raw) ?? (raw.startsWith("http") || raw.startsWith("/") ? null : raw)
    if (stored) {
      quoteImagePaths.push({ projectId: entry.projectId, path: stored })
      continue
    }
    out.set(entry.projectId, raw)
  }

  if (entries.length === 0) return out

  if (visitRefs.length > 0) {
    const supabase = getSupabaseBrowser()
    const photoIds = [...new Set(visitRefs.map((item) => item.photoId))]
    const { data: rows } = await supabase
      .from("quotation_visit_photos")
      .select("id, quotation_id, storage_path, thumb_path")
      .in("id", photoIds)
    const byId = new Map(
      ((rows ?? []) as { id: string; storage_path: string; thumb_path: string | null }[]).map((row) => [
        row.id,
        row,
      ]),
    )
    const storagePaths = [
      ...new Set(
        ((rows ?? []) as { storage_path: string; thumb_path: string | null }[]).flatMap((row) =>
          [row.thumb_path, row.storage_path].filter(Boolean),
        ),
      ),
    ] as string[]
    const signed =
      storagePaths.length > 0 ? await signStoragePaths("visit-photos", storagePaths) : new Map<string, string>()
    for (const ref of visitRefs) {
      const row = byId.get(ref.photoId)
      const url =
        (row?.thumb_path ? signed.get(row.thumb_path) : undefined) ||
        (row?.storage_path ? signed.get(row.storage_path) : undefined)
      if (url) out.set(ref.projectId, url)
    }
  }

  if (quoteImagePaths.length > 0) {
    const unique = [...new Set(quoteImagePaths.map((item) => item.path))]
    const signed = await signStoragePaths("quote-images", unique)
    for (const item of quoteImagePaths) {
      out.set(item.projectId, signed.get(item.path) || storagePublicUrl(item.path))
    }
  }

  return out
}
