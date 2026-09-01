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
