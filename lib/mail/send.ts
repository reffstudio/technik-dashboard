import { Resend } from "resend"
import { isResendConfigured, resendEnv } from "./env"
import { inviteEmail, quoteDispatchEmail, recoverEmail } from "./templates"

export { isResendConfigured }

export type MailKind = "invite" | "recover"

export async function sendTechnikMail(input: {
  kind: MailKind
  to: string
  actionUrl: string
  name?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error:
        "Falta RESEND_API_KEY en el servidor (re_…). Agrégala en .env.local y en Vercel → Production. No uses NEXT_PUBLIC_.",
    }
  }

  const { apiKey, from, replyTo } = resendEnv()
  const template =
    input.kind === "invite"
      ? inviteEmail({ name: input.name?.trim() || "equipo", actionUrl: input.actionUrl })
      : recoverEmail({ actionUrl: input.actionUrl })

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      ...(replyTo ? { replyTo } : {}),
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
    if (error) {
      return { ok: false, error: explainResendError(error.message) }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo enviar el correo."
    return { ok: false, error: explainResendError(msg) }
  }
}

export async function sendQuoteDispatchMail(input: {
  to: string
  cc: string[]
  replyTo?: string
  subject: string
  body: string
  html?: string
  filename: string
  pdf: Buffer
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error:
        "Falta RESEND_API_KEY en el servidor (re_…). Agrégala en .env.local y en Vercel → Production. No uses NEXT_PUBLIC_.",
    }
  }

  const { apiKey, quotesFrom, replyTo: envReplyTo } = resendEnv()
  const template = quoteDispatchEmail({
    greeting: input.html ? undefined : input.subject,
    intro: input.html ? undefined : "Adjuntamos el PDF de la cotización.",
    body: input.body,
    html: input.html,
  })
  const replyTo = input.replyTo?.trim() || envReplyTo || undefined

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: quotesFrom,
      to: input.to,
      ...(input.cc.length > 0 ? { cc: input.cc } : {}),
      ...(replyTo ? { replyTo } : {}),
      subject: input.subject,
      html: template.html,
      text: template.text,
      attachments: [
        {
          filename: input.filename,
          content: input.pdf,
        },
      ],
    })
    if (error) {
      return { ok: false, error: explainResendError(error.message) }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo enviar el correo."
    return { ok: false, error: explainResendError(msg) }
  }
}

function explainResendError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes("domain") || m.includes("not verified") || m.includes("from")) {
    return "Resend no acepta el remitente. Verifica cotizaciones@solutionstechnik.com (o el dominio solutionstechnik.com) en Resend."
  }
  if (m.includes("api key") || m.includes("unauthorized") || m.includes("forbidden")) {
    return "RESEND_API_KEY no es válida. Crea una en resend.com/api-keys (solo servidor, sin NEXT_PUBLIC_)."
  }
  if (m.includes("only send testing emails") || m.includes("own email")) {
    return "Mientras el dominio no esté verificado, Resend solo entrega al correo de tu cuenta. Verifica solutionstechnik.com en Resend."
  }
  return msg.trim() || "Resend no pudo enviar el correo."
}
