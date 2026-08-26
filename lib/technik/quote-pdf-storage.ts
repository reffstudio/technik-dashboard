import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export const QUOTE_PDF_BUCKET = "quote-pdfs"
const PDF_MAX_BYTES = 8 * 1024 * 1024

export type QuotePdfKind = "client" | "supplier"

export function quotePdfStoragePath(quotationId: string, kind: QuotePdfKind) {
  return `${quotationId}/${kind}.pdf`
}

async function ensureBucket() {
  const admin = getSupabaseAdmin()
  const { data } = await admin.storage.getBucket(QUOTE_PDF_BUCKET)
  if (data) return
  await admin.storage.createBucket(QUOTE_PDF_BUCKET, {
    public: false,
    fileSizeLimit: PDF_MAX_BYTES,
    allowedMimeTypes: ["application/pdf"],
  })
}

export async function storeQuotePdf(opts: {
  quotationId: string
  kind: QuotePdfKind
  pdf: Buffer
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Storage no configurado." }
  }
  try {
    await ensureBucket()
    const admin = getSupabaseAdmin()
    const path = quotePdfStoragePath(opts.quotationId, opts.kind)
    const { error } = await admin.storage.from(QUOTE_PDF_BUCKET).upload(path, opts.pdf, {
      contentType: "application/pdf",
      upsert: true,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, path }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar el PDF." }
  }
}

export async function readQuotePdf(opts: {
  quotationId: string
  kind: QuotePdfKind
}): Promise<{ bytes: Buffer } | null> {
  if (!isSupabaseAdminConfigured()) return null
  try {
    const admin = getSupabaseAdmin()
    const path = quotePdfStoragePath(opts.quotationId, opts.kind)
    const { data, error } = await admin.storage.from(QUOTE_PDF_BUCKET).download(path)
    if (error || !data) return null
    return { bytes: Buffer.from(await data.arrayBuffer()) }
  } catch {
    return null
  }
}
