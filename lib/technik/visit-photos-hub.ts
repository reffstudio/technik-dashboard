/**
 * Almacén de bytes de fotos de visita (prototipo).
 * En Supabase: bucket `visit-photos` + tabla `quotation_visit_photos`.
 * El workspace solo lleva metadatos (sin data URLs) para no inflar cache/poll.
 */

import type { Quotation, VisitPhoto } from "./data"
import { visitPhotoUrl, VISIT_PHOTO_MAX, VISIT_PHOTO_MAX_BYTES } from "./visit-photos"

export type StoredVisitPhoto = {
  meta: VisitPhoto
  bytes: Buffer
  thumbBytes: Buffer
}

type HubState = {
  byId: Map<string, StoredVisitPhoto>
}

const globalKey = "__technik_visit_photos_hub_v1__"

function getHub(): HubState {
  const g = globalThis as typeof globalThis & { [globalKey]?: HubState }
  if (!g[globalKey]) g[globalKey] = { byId: new Map() }
  return g[globalKey]
}

function photoKey(quotationId: string, photoId: string) {
  return `${quotationId}::${photoId}`
}

export function listVisitPhotoMeta(quotationId: string): VisitPhoto[] {
  const out: VisitPhoto[] = []
  for (const row of getHub().byId.values()) {
    if (row.meta.quotationId === quotationId) out.push(row.meta)
  }
  return out.sort((a, b) => a.takenAt.localeCompare(b.takenAt))
}

export function getStoredVisitPhoto(
  quotationId: string,
  photoId: string,
): StoredVisitPhoto | undefined {
  return getHub().byId.get(photoKey(quotationId, photoId))
}

export function attachVisitPhotosToQuotations(quotations: Quotation[]): Quotation[] {
  return quotations.map((q) => ({
    ...q,
    visitPhotos: listVisitPhotoMeta(q.id),
  }))
}

export function putVisitPhoto(input: {
  quotationId: string
  bytes: Buffer
  thumbBytes: Buffer
  mime: VisitPhoto["mime"]
  width: number
  height: number
  caption?: string
  uploadedById: string
  uploadedBy: string
}): { ok: true; photo: VisitPhoto } | { ok: false; error: string; status: number } {
  const existing = listVisitPhotoMeta(input.quotationId)
  if (existing.length >= VISIT_PHOTO_MAX) {
    return {
      ok: false,
      status: 400,
      error: `Máximo ${VISIT_PHOTO_MAX} fotos por cotización.`,
    }
  }
  if (input.bytes.length === 0 || input.bytes.length > VISIT_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      status: 400,
      error: "La foto comprimida excede el tamaño permitido.",
    }
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const takenAt = new Date().toISOString()
  const meta: VisitPhoto = {
    id,
    quotationId: input.quotationId,
    url: visitPhotoUrl(input.quotationId, id),
    thumbUrl: visitPhotoUrl(input.quotationId, id, true),
    caption: input.caption?.trim() || undefined,
    takenAt,
    uploadedById: input.uploadedById,
    uploadedBy: input.uploadedBy,
    mime: input.mime,
    bytes: input.bytes.length,
    thumbBytes: input.thumbBytes.length,
    width: input.width,
    height: input.height,
  }
  getHub().byId.set(photoKey(input.quotationId, id), {
    meta,
    bytes: input.bytes,
    thumbBytes: input.thumbBytes,
  })
  return { ok: true, photo: meta }
}

export function deleteStoredVisitPhoto(quotationId: string, photoId: string): boolean {
  return getHub().byId.delete(photoKey(quotationId, photoId))
}

export function deleteStoredVisitPhotosForQuote(quotationId: string): number {
  const hub = getHub()
  let n = 0
  for (const [key, row] of hub.byId) {
    if (row.meta.quotationId === quotationId) {
      hub.byId.delete(key)
      n += 1
    }
  }
  return n
}
