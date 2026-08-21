import { isResendConfigured, sendTechnikMail } from "@/lib/mail/send"
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { generateAuthActionLink } from "@/lib/supabase/auth-link"
import { passwordSetupRedirect } from "@/lib/technik/password-setup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

void process.env.SUPABASE_SERVICE_ROLE_KEY
void process.env.SUPABASE_SECRET_KEY
void process.env.RESEND_API_KEY
void process.env.RESEND_FROM
void process.env.RESEND_REPLY_TO

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://dashboard.solutionstechnik.com"
  ).replace(/\/$/, "")
}

type Body = { email?: string }

export async function POST(req: Request) {
  if (!isSupabaseAdminConfigured()) {
    return Response.json(
      { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para generar el enlace." },
      { status: 503 },
    )
  }
  if (!isResendConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Falta RESEND_API_KEY en el servidor (re_…). Agrégala en .env.local y en Vercel → Production. No uses NEXT_PUBLIC_.",
      },
      { status: 503 },
    )
  }

  const body = (await req.json().catch(() => null)) as Body | null
  const email = body?.email?.trim().toLowerCase() ?? ""
  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, error: "Escribe un correo válido." }, { status: 400 })
  }

  const originHeader = req.headers.get("origin")
  const origin = (originHeader || siteUrl()).replace(/\/$/, "")
  const originWithScheme = origin.startsWith("http") ? origin : `https://${origin}`
  const redirectTo = passwordSetupRedirect(originWithScheme)

  try {
    const link = await generateAuthActionLink({
      type: "recovery",
      email,
      redirectTo,
    })
    if (link.actionLink) {
      const mail = await sendTechnikMail({
        kind: "recover",
        to: email,
        actionUrl: link.actionLink,
      })
      if (!mail.ok) {
        return Response.json({ ok: false, error: mail.error }, { status: 502 })
      }
    }
  } catch {
    /* No revelar si el correo existe. */
  }

  return Response.json({ ok: true })
}
