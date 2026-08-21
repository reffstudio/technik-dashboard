import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import type { VisitPhoto } from "@/lib/technik/data"
import { visitPhotoUrl } from "@/lib/technik/visit-photos"

function extOf(mime: VisitPhoto["mime"]) {
  return mime === "image/webp" ? "webp" : "jpg"
}

function paths(quotationId: string, photoId: string, mime: VisitPhoto["mime"]) {
  const ext = extOf(mime)
  return {
    storagePath: `${quotationId}/${photoId}.${ext}`,
    thumbPath: `${quotationId}/${photoId}.thumb.jpg`,
  }
}

async function resolveUploader(uploadedById: string): Promise<string | null> {
  if (!uploadedById || uploadedById === "system") return null
  if (/^[0-9a-f-]{36}$/i.test(uploadedById)) return uploadedById
  const admin = getSupabaseAdmin()
  const { data } = await admin.from("profiles").select("id").eq("username", uploadedById).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

export async function persistVisitPhotoToSupabase(input: {
  photo: VisitPhoto
  bytes: Buffer
  thumbBytes: Buffer
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseAdminConfigured()) return { ok: true }
  try {
    const admin = getSupabaseAdmin()
    const { storagePath, thumbPath } = paths(input.photo.quotationId, input.photo.id, input.photo.mime)
    const fullType = input.photo.mime
    const up1 = await admin.storage.from("visit-photos").upload(storagePath, input.bytes, {
      contentType: fullType,
      upsert: true,
    })
    if (up1.error) return { ok: false, error: up1.error.message }
    const up2 = await admin.storage.from("visit-photos").upload(thumbPath, input.thumbBytes, {
      contentType: "image/jpeg",
      upsert: true,
    })
    if (up2.error) return { ok: false, error: up2.error.message }
    const uploadedBy = await resolveUploader(input.photo.uploadedById)
    const { error } = await admin.from("quotation_visit_photos").upsert({
      id: input.photo.id,
      quotation_id: input.photo.quotationId,
      storage_path: storagePath,
      thumb_path: thumbPath,
      caption: input.photo.caption ?? null,
      mime: input.photo.mime,
      bytes: input.photo.bytes,
      thumb_bytes: input.photo.thumbBytes,
      width: input.photo.width,
      height: input.photo.height,
      taken_at: input.photo.takenAt,
      uploaded_by: uploadedBy,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la foto." }
  }
}

export async function readVisitPhotoFromSupabase(
  quotationId: string,
  photoId: string,
  thumb: boolean,
): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!isSupabaseAdminConfigured()) return null
  try {
    const admin = getSupabaseAdmin()
    const { data: row } = await admin
      .from("quotation_visit_photos")
      .select("storage_path, thumb_path, mime")
      .eq("quotation_id", quotationId)
      .eq("id", photoId)
      .maybeSingle()
    if (!row) return null
    const path = thumb
      ? (row as { thumb_path: string | null }).thumb_path || (row as { storage_path: string }).storage_path
      : (row as { storage_path: string }).storage_path
    const { data, error } = await admin.storage.from("visit-photos").download(path)
    if (error || !data) return null
    const buf = Buffer.from(await data.arrayBuffer())
    const mime = thumb ? "image/jpeg" : (row as { mime: string }).mime
    return { bytes: buf, mime }
  } catch {
    return null
  }
}

export async function deleteVisitPhotoFromSupabase(quotationId: string, photoId: string) {
  if (!isSupabaseAdminConfigured()) return
  try {
    const admin = getSupabaseAdmin()
    const { data: row } = await admin
      .from("quotation_visit_photos")
      .select("storage_path, thumb_path")
      .eq("quotation_id", quotationId)
      .eq("id", photoId)
      .maybeSingle()
    const pathsToRemove = [
      (row as { storage_path?: string } | null)?.storage_path,
      (row as { thumb_path?: string } | null)?.thumb_path,
    ].filter(Boolean) as string[]
    if (pathsToRemove.length) await admin.storage.from("visit-photos").remove(pathsToRemove)
    await admin.from("quotation_visit_photos").delete().eq("id", photoId).eq("quotation_id", quotationId)
  } catch {
    // best-effort
  }
}

export async function deleteAllVisitPhotosFromSupabase(quotationId: string) {
  if (!isSupabaseAdminConfigured()) return
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from("quotation_visit_photos")
      .select("id, storage_path, thumb_path")
      .eq("quotation_id", quotationId)
    const pathsToRemove: string[] = []
    for (const row of data ?? []) {
      const r = row as { storage_path?: string; thumb_path?: string }
      if (r.storage_path) pathsToRemove.push(r.storage_path)
      if (r.thumb_path) pathsToRemove.push(r.thumb_path)
    }
    if (pathsToRemove.length) await admin.storage.from("visit-photos").remove(pathsToRemove)
    await admin.from("quotation_visit_photos").delete().eq("quotation_id", quotationId)
  } catch {
    // best-effort
  }
}

export async function listVisitPhotosFromSupabase(quotationId: string): Promise<VisitPhoto[]> {
  if (!isSupabaseAdminConfigured()) return []
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from("quotation_visit_photos")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("taken_at")
    return ((data ?? []) as {
      id: string
      quotation_id: string
      caption: string | null
      mime: VisitPhoto["mime"]
      bytes: number
      thumb_bytes: number | null
      width: number
      height: number
      taken_at: string
      uploaded_by: string | null
    }[]).map((row) => ({
      id: row.id,
      quotationId: row.quotation_id,
      url: visitPhotoUrl(row.quotation_id, row.id),
      thumbUrl: visitPhotoUrl(row.quotation_id, row.id, true),
      caption: row.caption || undefined,
      takenAt: row.taken_at,
      uploadedById: row.uploaded_by ?? "",
      uploadedBy: "Colaborador",
      mime: row.mime,
      bytes: row.bytes,
      thumbBytes: row.thumb_bytes ?? 0,
      width: row.width,
      height: row.height,
    }))
  } catch {
    return []
  }
}
