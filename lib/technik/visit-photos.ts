import type { VisitPhoto } from "./data"
import { authHeaders } from "@/lib/supabase/session-token"

/** Tope por cotización — evita inflar storage y el poll del workspace. */
export const VISIT_PHOTO_MAX = 16
/** Foto completa ya comprimida (cliente). El API rechaza más de esto. */
export const VISIT_PHOTO_MAX_BYTES = 220_000
export const VISIT_THUMB_MAX_BYTES = 48_000

export function visitPhotoUrl(quotationId: string, photoId: string, thumb = false): string {
  const q = encodeURIComponent(quotationId)
  const p = encodeURIComponent(photoId)
  return thumb ? `/api/quotes/${q}/photos/${p}?thumb=1` : `/api/quotes/${q}/photos/${p}`
}

export function visitPhotosOf(photos: VisitPhoto[] | undefined): VisitPhoto[] {
  return [...(photos ?? [])].sort((a, b) => a.takenAt.localeCompare(b.takenAt))
}

export type VisitPhotoUploadResult =
  | { ok: true; photo: VisitPhoto }
  | { ok: false; error: string }

export async function postVisitPhoto(opts: {
  quotationId: string
  full: Blob
  thumb: Blob
  width: number
  height: number
  caption?: string
  uploadedById: string
  uploadedBy: string
}): Promise<VisitPhotoUploadResult> {
  const fd = new FormData()
  const ext = opts.full.type === "image/webp" ? "webp" : "jpg"
  fd.append("file", opts.full, `photo.${ext}`)
  fd.append("thumb", opts.thumb, `thumb.${ext}`)
  fd.append("width", String(opts.width))
  fd.append("height", String(opts.height))
  fd.append("caption", opts.caption ?? "")
  fd.append("uploadedById", opts.uploadedById)
  fd.append("uploadedBy", opts.uploadedBy)

  try {
    const res = await fetch(`/api/quotes/${encodeURIComponent(opts.quotationId)}/photos`, {
      method: "POST",
      body: fd,
      headers: await authHeaders(),
    })
    const data = (await res.json()) as { ok?: boolean; photo?: VisitPhoto; error?: string }
    if (!res.ok || !data.ok || !data.photo) {
      return { ok: false, error: data.error || "No se pudo guardar la foto." }
    }
    return { ok: true, photo: data.photo }
  } catch {
    return { ok: false, error: "Sin conexión al guardar la foto." }
  }
}

export async function deleteVisitPhotoRequest(
  quotationId: string,
  photoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(quotationId)}/photos/${encodeURIComponent(photoId)}`,
      { method: "DELETE", headers: await authHeaders() },
    )
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "No se pudo borrar la foto." }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "Sin conexión al borrar la foto." }
  }
}

export async function deleteAllVisitPhotosRequest(quotationId: string): Promise<void> {
  try {
    await fetch(`/api/quotes/${encodeURIComponent(quotationId)}/photos`, {
      method: "DELETE",
      headers: await authHeaders(),
    })
  } catch {
    /* purge best-effort */
  }
}
