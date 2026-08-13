import { NextResponse } from "next/server"
import { readWorkspaceHub, writeWorkspaceHub } from "@/lib/technik/workspace-hub"
import {
  attachVisitPhotosToQuotations,
  deleteStoredVisitPhoto,
  getStoredVisitPhoto,
} from "@/lib/technik/visit-photos-hub"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CACHE = "private, max-age=31536000, immutable"

function patchQuoteHistory(quotationId: string, actor: string, action: string) {
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

/** GET — bytes de la foto o miniatura. No viaja en el snapshot del workspace. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await ctx.params
  const row = getStoredVisitPhoto(id, photoId)
  if (!row) {
    return NextResponse.json({ ok: false, error: "Foto no encontrada" }, { status: 404 })
  }
  const thumb = new URL(req.url).searchParams.get("thumb") === "1"
  const body = thumb ? row.thumbBytes : row.bytes
  const mime = thumb ? "image/jpeg" : row.meta.mime
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(body.length),
      "Cache-Control": CACHE,
    },
  })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await ctx.params
  const row = getStoredVisitPhoto(id, photoId)
  if (!row) {
    return NextResponse.json({ ok: false, error: "Foto no encontrada" }, { status: 404 })
  }
  deleteStoredVisitPhoto(id, photoId)
  patchQuoteHistory(id, row.meta.uploadedBy || "Usuario", "Eliminó foto de visita")
  return NextResponse.json({ ok: true })
}
