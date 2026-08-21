import { getSupabaseBrowser } from "@/lib/supabase/browser"

const BUCKET = "quote-images"

export async function persistStorageImage(
  path: string,
  imageUrl: string | undefined,
): Promise<string | null> {
  if (!imageUrl) return null
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
  const publicMarker = `/object/public/${BUCKET}/`
  const idx = imageUrl.indexOf(publicMarker)
  if (idx >= 0) return decodeURIComponent(imageUrl.slice(idx + publicMarker.length).split("?")[0])
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl
  return imageUrl
}

export function storagePublicUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("/")) return path
  const supabase = getSupabaseBrowser()
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
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
