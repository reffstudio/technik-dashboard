import { NextResponse } from "next/server"
import { requireStaff } from "@/lib/api/require-staff"
import { readQuotePdf } from "@/lib/technik/quote-pdf-storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Kind = "client" | "supplier"

/**
 * GET /api/quotes/:id/pdf?kind=client|supplier
 * Sirve el PDF guardado en Storage tras un envío. Si no hay archivo, el cliente captura la carta.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaff(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const kind = (new URL(req.url).searchParams.get("kind") ?? "client") as Kind
  if (kind !== "client" && kind !== "supplier") {
    return NextResponse.json({ ok: false, error: "kind inválido" }, { status: 400 })
  }
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 })
  }

  const stored = await readQuotePdf({ quotationId: id, kind })
  if (!stored) {
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        generateClientSide: true,
        quotationId: id,
        kind,
        error: "Aún no hay PDF guardado. Se genera en el navegador al enviar.",
      },
      { status: 404 },
    )
  }

  const filename = `${id}-${kind}.pdf`
  return new NextResponse(new Uint8Array(stored.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(stored.bytes.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=120",
    },
  })
}
