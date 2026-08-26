import { NextResponse } from "next/server"
import { sendQuoteDispatchMail } from "@/lib/mail/send"
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { normalizeEmails } from "@/lib/technik/outbound"
import { storeQuotePdf } from "@/lib/technik/quote-pdf-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

void process.env.RESEND_API_KEY
void process.env.RESEND_FROM
void process.env.RESEND_QUOTES_FROM
void process.env.RESEND_REPLY_TO

const PDF_MAX_BYTES = 8 * 1024 * 1024

type Channel = "email" | "whatsapp"
type Kind = "client" | "supplier"

/**
 * POST /api/quotes/:id/dispatch
 * Correo: PDF adjunto desde cotizaciones@solutionstechnik.com (To + CC).
 * WhatsApp es Compartir en el cliente; no hay Cloud API.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 })
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 503 },
    )
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!token) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 })
  }

  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("role, active, email")
    .eq("id", authData.user.id)
    .maybeSingle()
  if (actorError || !actor || !actor.active) {
    return NextResponse.json({ ok: false, error: "No se encontró tu perfil." }, { status: 403 })
  }
  if (actor.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Solo administración puede enviar cotizaciones por correo." },
      { status: 403 },
    )
  }

  const contentType = req.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Envía el PDF como formulario (multipart)." },
      { status: 400 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "Formulario inválido." }, { status: 400 })
  }

  const kind = String(form.get("kind") ?? "") as Kind
  const channel = String(form.get("channel") ?? "") as Channel
  if (kind !== "client" && kind !== "supplier") {
    return NextResponse.json({ ok: false, error: "kind inválido" }, { status: 400 })
  }
  if (channel !== "email" && channel !== "whatsapp") {
    return NextResponse.json({ ok: false, error: "channel inválido" }, { status: 400 })
  }

  if (channel === "whatsapp") {
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        quotationId: id,
        kind,
        channel,
        error: "Usa Compartir para WhatsApp. No hay envío automático por Cloud API.",
      },
      { status: 501 },
    )
  }

  const toEmail = String(form.get("toEmail") ?? "").trim().toLowerCase()
  if (!toEmail || !toEmail.includes("@")) {
    return NextResponse.json({ ok: false, error: "Falta el correo del destinatario." }, { status: 400 })
  }

  let extraCc: string[] = []
  const ccRaw = String(form.get("cc") ?? "").trim()
  if (ccRaw) {
    try {
      const parsed = JSON.parse(ccRaw) as unknown
      extraCc = Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
    } catch {
      extraCc = ccRaw.split(/[,;\s]+/)
    }
  }
  const cc = normalizeEmails(extraCc).filter((email) => email !== toEmail)

  const subject = String(form.get("subject") ?? "").trim() || `Cotización ${id}`
  const body = String(form.get("body") ?? "").trim()
  const filename = String(form.get("filename") ?? "").trim() || `${id}.pdf`
  const pdfEntry = form.get("pdf")
  if (!(pdfEntry instanceof File) || pdfEntry.size === 0) {
    return NextResponse.json({ ok: false, error: "Falta el PDF adjunto." }, { status: 400 })
  }
  if (pdfEntry.size > PDF_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "El PDF es demasiado grande." }, { status: 413 })
  }

  const pdf = Buffer.from(await pdfEntry.arrayBuffer())
  const replyTo = typeof actor.email === "string" ? actor.email.trim() : authData.user.email

  const sent = await sendQuoteDispatchMail({
    to: toEmail,
    cc,
    replyTo,
    subject,
    body,
    filename,
    pdf,
  })
  if (!sent.ok) {
    return NextResponse.json({ ok: false, error: sent.error }, { status: 502 })
  }

  const stored = await storeQuotePdf({ quotationId: id, kind, pdf })

  return NextResponse.json({
    ok: true,
    ready: true,
    quotationId: id,
    kind,
    channel: "email",
    to: toEmail,
    cc,
    stored: stored.ok,
  })
}
