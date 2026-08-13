import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type Channel = "email" | "whatsapp"
type Kind = "client" | "supplier"

type Body = {
  kind?: Kind
  channel?: Channel
  toEmail?: string
  toPhone?: string
  subject?: string
  body?: string
  filename?: string
}

/**
 * POST /api/quotes/:id/dispatch
 * Placeholder: SMTP (adjunto PDF) o WhatsApp Cloud API (documento).
 * Mientras ready=false el cliente abre mailto / wa.me y pide adjuntar el PDF.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  let payload: Body
  try {
    payload = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  const kind = payload.kind
  const channel = payload.channel
  if (kind !== "client" && kind !== "supplier") {
    return NextResponse.json({ ok: false, error: "kind inválido" }, { status: 400 })
  }
  if (channel !== "email" && channel !== "whatsapp") {
    return NextResponse.json({ ok: false, error: "channel inválido" }, { status: 400 })
  }
  if (channel === "email" && !payload.toEmail?.trim()) {
    return NextResponse.json({ ok: false, error: "Falta toEmail" }, { status: 400 })
  }
  if (channel === "whatsapp" && !payload.toPhone?.trim()) {
    return NextResponse.json({ ok: false, error: "Falta toPhone" }, { status: 400 })
  }

  return NextResponse.json(
    {
      ok: false,
      ready: false,
      quotationId: id,
      kind,
      channel,
      error:
        "Envío con adjunto pendiente. Configurar SMTP (cliente/proveedor) y WhatsApp Cloud API.",
    },
    { status: 501 },
  )
}
