/**
 * Salida de PDFs (cliente / proveedor).
 *
 * Hoy: mailto / wa.me + descarga del PDF Letter (captura 1:1 del preview).
 * Backend: GET  /api/quotes/:id/pdf?kind=client|supplier  → application/pdf
 *          POST /api/quotes/:id/dispatch                  → SMTP / WhatsApp Cloud
 */

import { TECHNIK_COMPANY } from "./company"
import type { Client, Supplier } from "./data"

export type QuotePdfKind = "client" | "supplier"
export type OutboundChannel = "email" | "whatsapp"

export type QuoteDispatchPayload = {
  quotationId: string
  kind: QuotePdfKind
  channel: OutboundChannel
  toEmail?: string
  toPhone?: string
  subject: string
  body: string
  filename: string
}

export function quotePdfFilename(reference: string, kind: QuotePdfKind): string {
  const safe = reference.replace(/[^\w.-]+/g, "-")
  return kind === "client" ? `${safe}-cliente.pdf` : `${safe}-proveedor.pdf`
}

/** Dígitos para wa.me. 10 dígitos MX → prefijo 52. */
export function whatsappDigits(raw: string | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "")
  if (!d) return ""
  if (d.length === 10) return `52${d}`
  if (d.startsWith("00")) return d.replace(/^00+/, "")
  return d
}

export function supplierWhatsAppNumber(supplier: Supplier): string {
  return whatsappDigits(supplier.whatsapp || supplier.phone)
}

export function mailtoHref(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({ subject, body })
  return `mailto:${encodeURIComponent(to)}?${q.toString()}`
}

export function whatsappHref(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function clientQuoteMail(opts: {
  client: Client
  reference: string
  title: string
}): { to: string; subject: string; body: string } {
  const to = opts.client.email.trim()
  const subject = `Cotización ${opts.reference} · ${opts.client.company}`
  const body = [
    `Hola ${opts.client.contact || opts.client.company},`,
    "",
    `Adjuntamos la cotización ${opts.reference}`,
    opts.title ? `(${opts.title}).` : ".",
    "",
    "El PDF va adjunto (o descárgalo desde Technik si no aparece en este correo).",
    "",
    TECHNIK_COMPANY.name,
    TECHNIK_COMPANY.email,
    TECHNIK_COMPANY.phones.join(" · "),
  ].join("\n")
  return { to, subject, body }
}

export function supplierQuoteMail(opts: {
  supplier: Supplier
  reference: string
}): { to: string; subject: string; body: string } {
  const to = opts.supplier.email.trim()
  const subject = `Solicitud de materiales ${opts.reference} · ${TECHNIK_COMPANY.name}`
  const body = [
    `Hola ${opts.supplier.contact || opts.supplier.name},`,
    "",
    `Te enviamos la solicitud de materiales de la cotización ${opts.reference}.`,
    "El PDF (sin costos) va adjunto.",
    "",
    TECHNIK_COMPANY.name,
    TECHNIK_COMPANY.email,
  ].join("\n")
  return { to, subject, body }
}

export function supplierWhatsAppText(opts: {
  supplier: Supplier
  reference: string
}): string {
  const name = opts.supplier.contact || opts.supplier.name
  return `Hola ${name}, te envío la solicitud de materiales ${opts.reference} de ${TECHNIK_COMPANY.name}. Adjunto el PDF.`
}

export function openMailto(to: string, subject: string, body: string) {
  window.location.href = mailtoHref(to, subject, body)
}

export function openWhatsApp(digits: string, text: string) {
  window.open(whatsappHref(digits, text), "_blank", "noopener,noreferrer")
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Si el backend ya sirve PDF, descarga el archivo. Si no, `null`. */
export async function fetchQuotePdfBlob(
  quotationId: string,
  kind: QuotePdfKind,
): Promise<Blob | null> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(quotationId)}/pdf?kind=${kind}`,
    )
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !type.includes("application/pdf")) return null
    return await res.blob()
  } catch {
    return null
  }
}

export async function downloadQuotePdf(opts: {
  quotationId: string
  kind: QuotePdfKind
  filename: string
  capture: () => Promise<Blob>
}): Promise<"file" | "capture"> {
  const blob = await fetchQuotePdfBlob(opts.quotationId, opts.kind)
  if (blob && blob.size > 0) {
    triggerBlobDownload(blob, opts.filename)
    return "file"
  }
  const captured = await opts.capture()
  if (!captured || captured.size === 0) {
    throw new Error("El PDF generado está vacío.")
  }
  triggerBlobDownload(captured, opts.filename)
  return "capture"
}

/**
 * Intenta SMTP / WhatsApp Cloud. Si el API responde 501, el caller abre mailto/wa.me.
 */
export async function dispatchQuoteOutbound(
  payload: QuoteDispatchPayload,
): Promise<"api" | "fallback"> {
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(payload.quotationId)}/dispatch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    )
    if (!res.ok) return "fallback"
    const data = (await res.json()) as { ok?: boolean; ready?: boolean }
    if (data.ok && data.ready !== false) return "api"
    return "fallback"
  } catch {
    return "fallback"
  }
}
