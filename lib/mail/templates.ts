import { TECHNIK_COMPANY } from "@/lib/technik/company"

const NAVY = "#141c28"
const CYAN = "#00d9ea"
const MUTED = "#8b95a7"
const CARD = "#1c2736"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function layout(opts: { preheader: string; heading: string; bodyHtml: string; ctaLabel: string; actionUrl: string }) {
  const url = escapeHtml(opts.actionUrl)
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" style="background:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Technik Solutions</title>
    <style>
      :root { color-scheme: dark; }
      html, body { margin: 0 !important; padding: 0 !important; background-color: ${NAVY} !important; }
    </style>
  </head>
  <body bgcolor="${NAVY}" style="margin:0;padding:0;background-color:${NAVY};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="background-color:${NAVY};padding:32px 16px;">
      <tr>
        <td align="center" bgcolor="${NAVY}" style="background-color:${NAVY};">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="max-width:560px;width:100%;background-color:${NAVY};">
            <tr>
              <td style="padding:0 8px 20px;">
                <p style="margin:0;color:${CYAN};font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Technik Solutions</p>
                <p style="margin:6px 0 0;color:${MUTED};font-size:12px;">${escapeHtml(TECHNIK_COMPANY.slogan)}</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="${CARD}" style="background-color:${CARD};border-radius:16px;padding:32px 28px;">
                <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;line-height:1.3;">${escapeHtml(opts.heading)}</h1>
                ${opts.bodyHtml}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                  <tr>
                    <td bgcolor="${CYAN}" style="background-color:${CYAN};border-radius:10px;">
                      <a href="${url}" style="display:inline-block;padding:12px 22px;color:${NAVY};font-size:14px;font-weight:700;text-decoration:none;">
                        ${escapeHtml(opts.ctaLabel)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;color:${MUTED};font-size:12px;line-height:1.6;word-break:break-all;">
                  Si el botón no funciona, copia este enlace:<br />
                  <a href="${url}" style="color:${CYAN};">${url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;color:${MUTED};font-size:11px;line-height:1.6;">
                ${escapeHtml(TECHNIK_COMPANY.name)} · ${escapeHtml(TECHNIK_COMPANY.addressLines.join(", "))}<br />
                ${escapeHtml(TECHNIK_COMPANY.phones.join(" · "))} · ${escapeHtml(TECHNIK_COMPANY.email)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function inviteEmail(opts: { name: string; actionUrl: string }) {
  const first = opts.name.trim().split(/\s+/)[0] || "equipo"
  const subject = "Invitación al dashboard de Technik Solutions"
  const html = layout({
    preheader: "Crea tu contraseña para entrar al dashboard.",
    heading: `Hola, ${first}`,
    bodyHtml: `<p style="margin:0;color:#d5dbe6;font-size:15px;line-height:1.6;">
      Te invitaron al dashboard interno de Technik Solutions. Abre el enlace, crea tu contraseña y entra con tu correo.
    </p>
    <p style="margin:14px 0 0;color:${MUTED};font-size:13px;line-height:1.6;">
      El enlace caduca. Si no pediste esta invitación, ignora este correo.
    </p>`,
    ctaLabel: "Crear contraseña",
    actionUrl: opts.actionUrl,
  })
  const text = `Hola, ${first}\n\nTe invitaron al dashboard de Technik Solutions.\nCrea tu contraseña aquí:\n${opts.actionUrl}\n\nSi no pediste esta invitación, ignora este correo.`
  return { subject, html, text }
}

export function recoverEmail(opts: { actionUrl: string }) {
  const subject = "Restablece tu acceso a Technik Solutions"
  const html = layout({
    preheader: "Usa este enlace para crear una nueva contraseña.",
    heading: "Restablecer contraseña",
    bodyHtml: `<p style="margin:0;color:#d5dbe6;font-size:15px;line-height:1.6;">
      Recibimos una solicitud para restablecer el acceso al dashboard de Technik Solutions.
    </p>
    <p style="margin:14px 0 0;color:${MUTED};font-size:13px;line-height:1.6;">
      Si no fuiste tú, puedes ignorar este correo. Tu contraseña actual no cambia.
    </p>`,
    ctaLabel: "Crear nueva contraseña",
    actionUrl: opts.actionUrl,
  })
  const text = `Recibimos una solicitud para restablecer tu acceso al dashboard de Technik Solutions.\n\nCrea una nueva contraseña aquí:\n${opts.actionUrl}\n\nSi no fuiste tú, ignora este correo.`
  return { subject, html, text }
}

export function quoteDispatchEmail(opts: {
  greeting?: string
  intro?: string
  body: string
  html?: string
}): { html: string; text: string } {
  const letterHtml = opts.html?.trim()
  const paragraphs = letterHtml
    ? letterHtml
    : opts.body
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map(
          (block) =>
            `<p style="margin:0 0 12px;color:#d5dbe6;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(block)}</p>`,
        )
        .join("")
  const heading = !letterHtml && opts.greeting?.trim()
    ? `<h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;line-height:1.3;">${escapeHtml(opts.greeting)}</h1>`
    : ""
  const intro = !letterHtml && opts.intro?.trim()
    ? `<p style="margin:0 0 16px;color:${MUTED};font-size:13px;line-height:1.6;">${escapeHtml(opts.intro)}</p>`
    : ""
  const html = `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" style="background:${NAVY};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Technik Solutions</title>
  </head>
  <body bgcolor="${NAVY}" style="margin:0;padding:0;background-color:${NAVY};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="background-color:${NAVY};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 8px 20px;">
                <p style="margin:0;color:${CYAN};font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Technik Solutions</p>
                <p style="margin:6px 0 0;color:${MUTED};font-size:12px;">${escapeHtml(TECHNIK_COMPANY.slogan)}</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="${CARD}" style="background-color:${CARD};border-radius:16px;padding:32px 28px;">
                ${heading}
                ${intro}
                ${paragraphs}
                ${letterHtml ? "" : `<p style="margin:16px 0 0;color:${MUTED};font-size:13px;line-height:1.6;">El PDF va adjunto a este correo.</p>`}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;color:${MUTED};font-size:11px;line-height:1.6;">
                ${escapeHtml(TECHNIK_COMPANY.name)} · ${escapeHtml(TECHNIK_COMPANY.addressLines.join(", "))}<br />
                ${escapeHtml(TECHNIK_COMPANY.phones.join(" · "))} · ${escapeHtml(TECHNIK_COMPANY.email)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  return { html, text: opts.body }
}
