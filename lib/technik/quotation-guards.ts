import type { ClientResponse, Quotation, QuoteStatus } from "./data"
import { parseActivityMs } from "./notifications"
import { mergeActivityHistory } from "./activity-history"

export function quotePipelineRank(status: QuoteStatus) {
  if (status === "closed") return 4
  if (status === "approved") return 3
  if (status === "pending_review") return 2
  if (status === "draft") return 0
  return 1
}

export function keepStamp(a?: string, b?: string): string | undefined {
  if (a && b) return a >= b ? a : b
  return a || b || undefined
}

export function clientResponseRank(r?: ClientResponse | null) {
  if (r === "aprobada") return 3
  if (r === "rechazada") return 2
  if (r === "en_espera") return 1
  return 0
}

export function preferClientResponse(
  a: Quotation["clientResponse"],
  b: Quotation["clientResponse"],
): Quotation["clientResponse"] {
  return clientResponseRank(a) >= clientResponseRank(b) ? a : b
}

/** En borrador se puede limpiar el envío; en el resto no se pisa una fecha ya guardada. */
export function persistSentAt(
  incoming: string | undefined,
  stored: string | null | undefined,
  persistedStatus: QuoteStatus,
): string | null {
  if (persistedStatus === "draft") return incoming ?? null
  if (incoming && stored) return incoming >= stored ? incoming : stored
  return incoming || stored || null
}

export function persistClientResponse(
  incoming?: ClientResponse | null,
  existing?: ClientResponse | null,
): ClientResponse | null {
  return clientResponseRank(incoming) >= clientResponseRank(existing)
    ? (incoming ?? null)
    : (existing ?? null)
}

export function mergeVisitPhotos(
  left: Quotation["visitPhotos"],
  right: Quotation["visitPhotos"],
): Quotation["visitPhotos"] {
  const map = new Map<string, NonNullable<Quotation["visitPhotos"]>[number]>()
  for (const p of left ?? []) map.set(p.id, p)
  for (const p of right ?? []) map.set(p.id, p)
  if (map.size === 0) return left ?? right
  return Array.from(map.values()).sort((a, b) => a.takenAt.localeCompare(b.takenAt))
}

/**
 * Un envío a revisión no puede perder contra un borrador “más nuevo”.
 * Fechas de envío y respuesta del cliente son monotónicas.
 */
export function preferQuote(a: Quotation, b: Quotation): Quotation {
  const aRank = quotePipelineRank(a.status)
  const bRank = quotePipelineRank(b.status)
  let winner = a
  if (aRank !== bRank) {
    winner = aRank > bRank ? a : b
  } else {
    const aMs = parseActivityMs(a.updatedAt ?? a.createdAt)
    const bMs = parseActivityMs(b.updatedAt ?? b.createdAt)
    if (aMs !== bMs) winner = aMs >= bMs ? a : b
    else {
      const aHist = a.history?.length ?? 0
      const bHist = b.history?.length ?? 0
      winner = aHist >= bHist ? a : b
    }
  }
  const history = mergeActivityHistory(a.history, b.history)
  return {
    ...winner,
    history,
    visitPhotos: mergeVisitPhotos(a.visitPhotos, b.visitPhotos),
    clientSentAt: keepStamp(a.clientSentAt, b.clientSentAt),
    supplierSentAt: keepStamp(a.supplierSentAt, b.supplierSentAt),
    supplierId: winner.supplierId || a.supplierId || b.supplierId,
    clientResponse: preferClientResponse(a.clientResponse, b.clientResponse),
  }
}
