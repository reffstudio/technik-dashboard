import { NextResponse } from "next/server"
import { readWorkspaceHub, writeWorkspaceHub } from "@/lib/technik/workspace-hub"
import {
  attachVisitPhotosToQuotations,
  deleteStoredVisitPhotosForQuote,
  listVisitPhotoMeta,
  putVisitPhoto,
} from "@/lib/technik/visit-photos-hub"
import { VISIT_PHOTO_MAX, VISIT_PHOTO_MAX_BYTES } from "@/lib/technik/visit-photos"
import type { VisitPhoto } from "@/lib/technik/data"
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import {
  deleteAllVisitPhotosFromSupabase,
  listVisitPhotosFromSupabase,
  persistVisitPhotoToSupabase,
} from "@/lib/technik/visit-photos-supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function quoteExists(id: string) {
  if (readWorkspaceHub().quotations.some((q) => q.id === id)) return true
  if (!isSupabaseAdminConfigured()) return false
  try {
    const { data } = await getSupabaseAdmin()
      .from("quotations")
      .select("id")
      .eq("id", id)
      .maybeSingle()
    return Boolean(data)
  } catch {
    return false
  }
}

function patchQuoteHistory(
  quotationId: string,
  actor: string,
  action: string,
) {
  const snap = readWorkspaceHub()
  const stamp = (() => {
    const d = new Date()
    const date = d.toISOString().slice(0, 10)
    const time = d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    return `${date} ${time}`
  })()
  const quotations = snap.quotations.map((q) => {
    if (q.id !== quotationId) return q
    return {
      ...q,
      updatedAt: stamp,
      history: [...q.history, { at: stamp, by: actor, action }],
    }
  })
  writeWorkspaceHub({
    snapshot: { ...snap, quotations: attachVisitPhotosToQuotations(quotations) },
    originId: "visit-photos-api",
    actorName: actor,
  })
}

/** GET /api/quotes/:id/photos — metadatos (sin bytes). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!(await quoteExists(id))) {
    return NextResponse.json({ ok: false, error: "Cotización no encontrada" }, { status: 404 })
  }
  const mem = listVisitPhotoMeta(id)
  const db = await listVisitPhotosFromSupabase(id)
  const byId = new Map<string, VisitPhoto>()
  for (const p of [...db, ...mem]) byId.set(p.id, p)
  return NextResponse.json({
    ok: true,
    photos: Array.from(byId.values()).sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
  })
}

/** POST /api/quotes/:id/photos — recibe JPEG/WebP ya comprimido + miniatura. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!(await quoteExists(id))) {
    return NextResponse.json({ ok: false, error: "Cotización no encontrada" }, { status: 404 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "FormData inválido" }, { status: 400 })
  }

  const file = form.get("file")
  const thumb = form.get("thumb")
  if (!(file instanceof File) || !(thumb instanceof File)) {
    return NextResponse.json({ ok: false, error: "Faltan file y thumb" }, { status: 400 })
  }
  if (file.size > VISIT_PHOTO_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "La foto supera el tope comprimido." },
      { status: 400 },
    )
  }

  const mime = file.type === "image/webp" ? "image/webp" : "image/jpeg"
  if (file.type !== "image/jpeg" && file.type !== "image/webp") {
    return NextResponse.json({ ok: false, error: "Solo JPEG o WebP comprimido." }, { status: 400 })
  }

  const width = Math.max(1, Number(form.get("width")) || 1)
  const height = Math.max(1, Number(form.get("height")) || 1)
  const caption = String(form.get("caption") ?? "").trim()
  const uploadedById = String(form.get("uploadedById") ?? "system")
  const uploadedBy = String(form.get("uploadedBy") ?? "Usuario")

  const bytes = Buffer.from(await file.arrayBuffer())
  const thumbBytes = Buffer.from(await thumb.arrayBuffer())
  const stored = putVisitPhoto({
    quotationId: id,
    bytes,
    thumbBytes,
    mime,
    width,
    height,
    caption,
    uploadedById,
    uploadedBy,
  })
  if (!stored.ok) {
    return NextResponse.json({ ok: false, error: stored.error }, { status: stored.status })
  }

  const persisted = await persistVisitPhotoToSupabase({
    photo: stored.photo,
    bytes,
    thumbBytes,
  })
  if (!persisted.ok) {
    return NextResponse.json({ ok: false, error: persisted.error }, { status: 500 })
  }

  patchQuoteHistory(id, uploadedBy, "Agregó foto de visita")
  return NextResponse.json({ ok: true, photo: stored.photo, max: VISIT_PHOTO_MAX })
}

/** DELETE /api/quotes/:id/photos — borra todas (purga de borrador). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const n = deleteStoredVisitPhotosForQuote(id)
  await deleteAllVisitPhotosFromSupabase(id)
  return NextResponse.json({ ok: true, deleted: n })
}
