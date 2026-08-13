import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type Kind = "client" | "supplier"

/**
 * GET /api/quotes/:id/pdf?kind=client|supplier
 * Placeholder: el backend servirá application/pdf.
 * Mientras tanto el cliente captura la carta Letter 1:1 del preview.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const kind = (new URL(req.url).searchParams.get("kind") ?? "client") as Kind
  if (kind !== "client" && kind !== "supplier") {
    return NextResponse.json({ ok: false, error: "kind inválido" }, { status: 400 })
  }
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 })
  }

  return NextResponse.json(
    {
      ok: false,
      ready: false,
      quotationId: id,
      kind,
      error:
        "Generación de PDF en servidor pendiente. Configurar plantilla + storage y responder application/pdf.",
    },
    { status: 501 },
  )
}
