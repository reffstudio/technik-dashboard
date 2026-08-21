/**
 * Salida de PDFs (cliente / proveedor).
 *
 * Correo: POST /api/quotes/:id/dispatch envía el PDF desde cotizaciones@solutionstechnik.com (To + CC).
 * Compartir: hoja nativa con el PDF adjunto. Fallback mailto / wa.me.
 * Backend: GET  /api/quotes/:id/pdf?kind=client|supplier  → application/pdf
 */

import { QUOTE_CC_EMAILS, TECHNIK_COMPANY } from "./company"
import type { Client, Supplier } from "./data"

export type QuotePdfKind = "client" | "supplier"
export type OutboundChannel = "email" | "whatsapp"

export type QuoteDispatchPayload = {
  quotationId: string
  kind: QuotePdfKind
  channel: OutboundChannel
  toEmail?: string
  cc?: string[]
  toPhone?: string
  subject: string
  body: string
  filename: string
}

function filenameSlug(value: string, max = 72): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
}

/** Nombre de proyecto en el PDF: título del primer ítem público. */
export function quotePdfProjectName(quotation: {
  title?: string
  publicItems?: Array<{ title?: string }>
}): string {
  const fromPublic = (quotation.publicItems ?? [])
    .map((item) => item.title?.trim() ?? "")
    .find(Boolean)
  return fromPublic || quotation.title?.trim() || ""
}

export function quotePdfFilename(
  reference: string,
  kind: QuotePdfKind,
  projectName?: string,
): string {
  const safeRef = filenameSlug(reference) || "cotizacion"
  const safeProject = projectName?.trim() ? filenameSlug(projectName.trim()) : ""
  const base = safeProject ? `${safeRef}-${safeProject}` : safeRef
  return kind === "client" ? `${base}-cliente.pdf` : `${base}-proveedor.pdf`
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

export function isEmailAddress(value: string): boolean {
  const v = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function normalizeEmails(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = (raw ?? "").trim().toLowerCase()
    if (!isEmailAddress(v) || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function quoteDispatchRecipients(opts: {
  to: string
  clientCc?: string[]
  extraCc?: string[]
}): { to: string; cc: string[] } {
  const to = opts.to.trim().toLowerCase()
  const cc = normalizeEmails([
    ...QUOTE_CC_EMAILS,
    ...(opts.clientCc ?? []),
    ...(opts.extraCc ?? []),
  ]).filter((email) => email !== to)
  return { to, cc }
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

export function clientWhatsAppNumber(client: Client): string {
  return whatsappDigits(client.phone)
}

function destinationBlock(email?: string, phoneLabel?: string): string {
  const lines = ["Destinatario en sistema:"]
  const mail = email?.trim()
  const phone = phoneLabel?.trim()
  if (mail) lines.push(`Correo: ${mail}`)
  if (phone) lines.push(`WhatsApp/tel: ${phone}`)
  if (!mail && !phone) lines.push("Sin correo ni teléfono registrados.")
  return lines.join("\n")
}

export function clientQuoteSharePayload(opts: {
  client: Client
  reference: string
  title: string
}): { title: string; text: string; contact: string } {
  const mail = clientQuoteMail(opts)
  const phoneLabel = opts.client.phone.trim()
  const text = [destinationBlock(mail.to, phoneLabel), "", mail.body].join("\n")
  const contact = mail.to || phoneLabel
  return { title: mail.subject, text, contact }
}

export function supplierQuoteSharePayload(opts: {
  supplier: Supplier
  reference: string
}): { title: string; text: string; contact: string } {
  const mail = supplierQuoteMail(opts)
  const phoneLabel = (opts.supplier.whatsapp || opts.supplier.phone).trim()
  const text = [destinationBlock(mail.to, phoneLabel), "", mail.body].join("\n")
  const contact = mail.to || phoneLabel
  return { title: mail.subject, text, contact }
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

export function downloadPdfBlob(blob: Blob, filename: string) {
  triggerBlobDownload(blob, filename)
}

export function quotePdfFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: "application/pdf", lastModified: Date.now() })
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

export async function getQuotePdfBlob(opts: {
  quotationId: string
  kind: QuotePdfKind
  capture: () => Promise<Blob>
}): Promise<{ blob: Blob; source: "file" | "capture" }> {
  const blob = await fetchQuotePdfBlob(opts.quotationId, opts.kind)
  if (blob && blob.size > 0) return { blob, source: "file" }
  const captured = await opts.capture()
  if (!captured || captured.size === 0) {
    throw new Error("El PDF generado está vacío.")
  }
  return { blob: captured, source: "capture" }
}

export async function downloadQuotePdf(opts: {
  quotationId: string
  kind: QuotePdfKind
  filename: string
  capture: () => Promise<Blob>
}): Promise<"file" | "capture"> {
  const { blob, source } = await getQuotePdfBlob(opts)
  triggerBlobDownload(blob, opts.filename)
  return source
}

export function canSharePdfFile(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false
  }
  if (typeof navigator.canShare !== "function") return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim()
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export type ShareQuoteResult = "shared" | "cancelled" | "unsupported"

export async function shareQuotePdf(opts: {
  file: File
  title: string
  text: string
}): Promise<ShareQuoteResult> {
  if (!canSharePdfFile(opts.file)) return "unsupported"
  try {
    await navigator.share({
      files: [opts.file],
      title: opts.title,
      text: opts.text,
    })
    return "shared"
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    if (name === "AbortError") return "cancelled"
    return "unsupported"
  }
}

/**
 * Envía el PDF por Resend (To + CC). WhatsApp Cloud no está activo.
 */
export async function dispatchQuoteEmail(opts: {
  quotationId: string
  kind: QuotePdfKind
  toEmail: string
  cc: string[]
  subject: string
  body: string
  filename: string
  pdf: Blob
  accessToken: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData()
  form.set("kind", opts.kind)
  form.set("channel", "email")
  form.set("toEmail", opts.toEmail)
  form.set("cc", JSON.stringify(opts.cc))
  form.set("subject", opts.subject)
  form.set("body", opts.body)
  form.set("filename", opts.filename)
  form.set(
    "pdf",
    new File([opts.pdf], opts.filename, { type: "application/pdf" }),
  )
  try {
    const res = await fetch(
      `/api/quotes/${encodeURIComponent(opts.quotationId)}/dispatch`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.accessToken}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    )
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || "No se pudo enviar el correo.",
      }
    }
    return { ok: true }
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
    return {
      ok: false,
      error: timedOut
        ? "El envío tardó demasiado. Inténtalo de nuevo."
        : "No se pudo contactar al servidor de correo.",
    }
  }
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
