"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Maximize2, X } from "lucide-react"
import { publicQuoteTotals } from "@/lib/technik/store"
import {
  currencyMxn,
  lineTotalMxn,
  quotationCoverUrl,
  type CatalogItem,
  type Client,
  type PublicQuoteItem,
  type Quotation,
  type QuoteLine,
  type Supplier,
} from "@/lib/technik/data"
import {
  DEFAULT_ISR_RETENTION_RATE,
  DEFAULT_QUOTE_TERMS,
  DEFAULT_TAX_RATE,
  formatPercentLabel,
  formatQuoteDate,
  TECHNIK_COMPANY,
} from "@/lib/technik/company"

/** US Letter — listo para impresión */
export const LETTER_WIDTH_IN = 8.5
export const LETTER_HEIGHT_IN = 11
const LETTER_WIDTH_PX = LETTER_WIDTH_IN * 96
const LETTER_HEIGHT_PX = LETTER_HEIGHT_IN * 96

export type PdfDocKind = "client" | "supplier"

export type SupplierBomLine = {
  itemId: string
  name: string
  code: string
  unit: string
  quantity: number
}

/** Líneas de materiales (sin costos) para solicitud a proveedor. */
export function buildSupplierBomLines(
  lines: QuoteLine[],
  catalog: CatalogItem[],
): SupplierBomLine[] {
  const rows: SupplierBomLine[] = []
  for (const line of lines) {
    const item = catalog.find((c) => c.id === line.itemId)
    if (!item || item.kind !== "material") continue
    rows.push({
      itemId: item.id,
      name: item.name,
      code: item.id,
      unit: item.unit,
      quantity: line.quantity,
    })
  }
  return rows
}

type QuotePdfPreviewProps = {
  quotation: Quotation
  client?: Client
  publicItems: PublicQuoteItem[]
  terms?: string
  taxRate?: number
  isrRetentionRate?: number
  /** Líneas internas + catálogo → BOM proveedor (solo materiales). */
  lines?: QuoteLine[]
  catalog?: CatalogItem[]
  supplier?: Supplier
  doc?: PdfDocKind
  onDocChange?: (doc: PdfDocKind) => void
  /** Si false, no monta el host de captura (evita duplicados móvil/desktop). */
  enablePrint?: boolean
  className?: string
}

export function QuotePdfPreview({
  quotation,
  client,
  publicItems,
  terms = DEFAULT_QUOTE_TERMS,
  taxRate = DEFAULT_TAX_RATE,
  isrRetentionRate = DEFAULT_ISR_RETENTION_RATE,
  lines = [],
  catalog = [],
  supplier,
  doc: docControlled,
  onDocChange,
  enablePrint = true,
  className = "",
}: QuotePdfPreviewProps) {
  const [docInternal, setDocInternal] = useState<PdfDocKind>("client")
  const doc = docControlled ?? docInternal
  function setDoc(next: PdfDocKind) {
    onDocChange?.(next)
    if (docControlled === undefined) setDocInternal(next)
  }

  const totals = useMemo(
    () => publicQuoteTotals(publicItems, taxRate, isrRetentionRate),
    [publicItems, taxRate, isrRetentionRate],
  )

  const bomLines = useMemo(
    () => buildSupplierBomLines(lines, catalog),
    [lines, catalog],
  )

  const quoteDate = formatQuoteDate(
    quotation.clientSentAt ?? quotation.updatedAt?.slice(0, 10) ?? quotation.createdAt.slice(0, 10),
  )
  const quoteNo = quotation.reference || quotation.id
  const coverUrl = quotationCoverUrl(quotation)

  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      if (w <= 0) return
      setScale(Math.min(1, w / LETTER_WIDTH_PX))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  const stageHeight = LETTER_HEIGHT_PX * scale
  const clientLetterProps = {
    client,
    publicItems,
    terms,
    taxRate,
    isrRetentionRate,
    totals,
    quoteDate,
    quoteNo,
    coverUrl,
  }
  const supplierLetterProps = {
    supplier,
    bomLines,
    quoteDate,
    quoteNo,
    projectTitle: quotation.title,
  }

  return (
    <div className={`rounded-2xl border border-border overflow-hidden bg-neutral-200/80 ${className}`}>
      <div className="flex items-center justify-between gap-4 px-4 pt-3 border-b border-border bg-card">
        <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setDoc("client")}
            className={`shrink-0 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              doc === "client"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Cotización Cliente
          </button>
          <button
            type="button"
            onClick={() => setDoc("supplier")}
            className={`shrink-0 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              doc === "supplier"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Solicitud Proveedor
          </button>
        </div>
        <span className="pb-2.5 text-[10px] font-mono text-muted-foreground shrink-0">
          Letter 8.5×11″
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div
          ref={stageRef}
          className="relative w-full mx-auto group"
          style={{ height: stageHeight }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: `${LETTER_WIDTH_IN}in`,
              height: `${LETTER_HEIGHT_IN}in`,
              transform: `scale(${scale})`,
            }}
          >
            {doc === "client" ? (
              <ClientLetterDocument {...clientLetterProps} />
            ) : (
              <SupplierLetterDocument {...supplierLetterProps} />
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-neutral-950/75 px-4 py-2.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-neutral-950/90 hover:scale-[1.02] opacity-90 group-hover:opacity-100"
            >
              <Maximize2 className="size-3.5" />
              Ver pantalla completa
            </button>
          </div>
        </div>
      </div>

      {mounted &&
        enablePrint &&
        createPortal(
          <div
            data-print-host
            aria-hidden
            className="pointer-events-none"
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              opacity: 0,
              zIndex: -1,
            }}
          >
            <div
              style={{
                width: `${LETTER_WIDTH_IN}in`,
                height: `${LETTER_HEIGHT_IN}in`,
              }}
            >
              <ClientLetterDocument {...clientLetterProps} printKind="client" />
            </div>
            <div
              style={{
                width: `${LETTER_WIDTH_IN}in`,
                height: `${LETTER_HEIGHT_IN}in`,
              }}
            >
              <SupplierLetterDocument {...supplierLetterProps} printKind="supplier" />
            </div>
          </div>,
          document.body,
        )}

      {mounted &&
        fullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-neutral-950/90 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={
              doc === "client"
                ? "Cotización cliente a pantalla completa"
                : "Solicitud proveedor a pantalla completa"
            }
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {doc === "client" ? "Cotización Cliente" : "Solicitud Proveedor"} ·{" "}
                  {quotation.title}
                </p>
                <p className="text-xs text-white/60 font-mono">{quoteNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
              >
                <X className="size-3.5" />
                Cerrar
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex items-start justify-center">
              {doc === "client" ? (
                <FullscreenLetter>
                  <ClientLetterDocument {...clientLetterProps} />
                </FullscreenLetter>
              ) : (
                <FullscreenLetter>
                  <SupplierLetterDocument {...supplierLetterProps} />
                </FullscreenLetter>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function FullscreenLetter({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.85)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return

    const update = () => {
      const pad = 32
      const availW = el.clientWidth - pad
      const availH = el.clientHeight - pad
      if (availW <= 0 || availH <= 0) return
      setScale(Math.min(1, availW / LETTER_WIDTH_PX, availH / LETTER_HEIGHT_PX))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <div ref={boxRef} className="w-full h-full flex items-center justify-center">
      <div
        style={{
          width: LETTER_WIDTH_PX * scale,
          height: LETTER_HEIGHT_PX * scale,
        }}
      >
        <div
          className="origin-top-left"
          style={{
            width: `${LETTER_WIDTH_IN}in`,
            height: `${LETTER_HEIGHT_IN}in`,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function LetterChrome({
  quoteDate,
  quoteNo,
  rightTitle,
  children,
  printKind,
  className = "",
}: {
  quoteDate: string
  quoteNo: string
  rightTitle?: string
  children: React.ReactNode
  printKind?: PdfDocKind
  className?: string
}) {
  return (
    <article
      {...(printKind
        ? { "data-print-letter": true, "data-print-kind": printKind }
        : {})}
      className={`bg-white text-neutral-900 shadow-md overflow-hidden flex flex-col box-border w-full h-full ${className}`}
      style={{
        padding: "0.45in 0.55in 0.4in",
        backgroundColor: "#ffffff",
        color: "#171717",
        colorScheme: "light",
      }}
    >
      <header className="grid grid-cols-[1.1fr_auto_1.1fr] gap-2 items-start shrink-0 mb-3">
        <div className="text-[8.5px] leading-snug text-neutral-600 space-y-px pt-0.5">
          {TECHNIK_COMPANY.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {TECHNIK_COMPANY.phones.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p>{TECHNIK_COMPANY.email}</p>
          <p>{TECHNIK_COMPANY.website}</p>
        </div>

        <div className="flex flex-col items-center pt-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/technik-logo-light.png"
            alt="Technik Solutions"
            width={108}
            height={36}
            decoding="sync"
            className="h-9 w-[108px] object-contain"
          />
        </div>

        <div className="text-right text-[9.5px] leading-snug pt-0.5 space-y-1">
          {rightTitle && (
            <p className="font-bold uppercase tracking-wide text-[9px] text-neutral-900">
              {rightTitle}
            </p>
          )}
          <p>
            <span className="text-neutral-500">Fecha: </span>
            <span className="font-semibold underline decoration-neutral-300 underline-offset-2">
              {quoteDate}
            </span>
          </p>
          <p>
            <span className="text-neutral-500">N° de Cotización: </span>
            <span className="font-semibold underline decoration-neutral-300 underline-offset-2 font-mono">
              {quoteNo}
            </span>
          </p>
        </div>
      </header>
      {children}
      <footer className="flex flex-col items-center gap-1 pt-2 border-t border-neutral-200 shrink-0 mt-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/technik-logo-light.png"
          alt=""
          width={24}
          height={24}
          decoding="sync"
          className="h-6 w-6 object-contain"
        />
        <p className="text-[8px] text-neutral-500 italic">{TECHNIK_COMPANY.slogan}</p>
      </footer>
    </article>
  )
}

type ClientLetterDocumentProps = {
  client?: Client
  publicItems: PublicQuoteItem[]
  terms: string
  taxRate: number
  isrRetentionRate: number
  totals: ReturnType<typeof publicQuoteTotals>
  quoteDate: string
  quoteNo: string
  coverUrl?: string
  printKind?: PdfDocKind
  className?: string
}

function ClientLetterDocument({
  client,
  publicItems,
  terms,
  taxRate,
  isrRetentionRate,
  totals,
  quoteDate,
  quoteNo,
  coverUrl,
  printKind,
  className = "",
}: ClientLetterDocumentProps) {
  return (
    <LetterChrome
      quoteDate={quoteDate}
      quoteNo={quoteNo}
      printKind={printKind}
      className={className}
    >
      <section className="grid grid-cols-2 gap-3 shrink-0 mb-3 border-y border-neutral-200 py-2.5">
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
            Con atención
          </p>
          <p className="text-[11px] font-semibold text-neutral-900 truncate">
            {client?.contact || "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
            Empresa
          </p>
          <p className="text-[11px] font-semibold text-neutral-900 truncate">
            {client?.company || "—"}
          </p>
          {client?.rfc && (
            <p className="text-[8.5px] font-mono text-neutral-600 truncate">
              RFC {client.rfc}
            </p>
          )}
          {client?.location && (
            <p className="text-[8.5px] text-neutral-600 truncate">{client.location}</p>
          )}
          {client?.phone && (
            <p className="text-[8.5px] text-neutral-600 truncate">{client.phone}</p>
          )}
          {client?.email && (
            <p className="text-[8.5px] text-neutral-600 truncate">{client.email}</p>
          )}
        </div>
      </section>

      {coverUrl && (
        <div className="shrink-0 mb-3 overflow-hidden border border-neutral-200" style={{ height: "1.55in" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ width: "100%", height: "1.55in", objectFit: "cover" }}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col mb-2">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr
              className="text-white text-[8px] uppercase tracking-wider"
              style={{ backgroundColor: "#171717", color: "#ffffff" }}
            >
              <th className="px-1.5 py-1.5 text-left font-semibold w-[72%]">Concepto</th>
              <th className="px-1.5 py-1.5 text-right font-semibold w-[28%]">Total MXN</th>
            </tr>
          </thead>
          <tbody>
            {publicItems.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-2 py-6 text-center text-neutral-400 border border-neutral-200 text-[9px]"
                >
                  Agrega ítems al cliente para verlos en la cotización.
                </td>
              </tr>
            ) : (
              publicItems.map((item) => {
                const lineTotal = lineTotalMxn(item.quantity, item.unitPrice)
                return (
                  <tr key={item.id} className="border border-neutral-200 align-top">
                    <td className="px-1.5 py-1.5">
                      <p className="font-bold text-[9.5px] uppercase tracking-tight text-neutral-900 leading-tight">
                        {item.title || "Sin título"}
                      </p>
                      {item.description && (
                        <p className="mt-1 whitespace-pre-wrap text-neutral-700 text-[8px] leading-snug line-clamp-8">
                          {item.description}
                        </p>
                      )}
                      {item.imageUrl && (
                        <div className="mt-1">
                          <p className="text-[7px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
                            Imagen de referencia
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-[0.85in] max-w-[1.6in] object-contain border border-neutral-200"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono font-semibold tabular-nums text-[8.5px]">
                      {currencyMxn(lineTotal)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="grid grid-cols-[1.25fr_0.85fr] gap-3 shrink-0 mb-2">
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Condiciones
          </p>
          <p className="whitespace-pre-wrap text-neutral-700 text-[7.5px] leading-snug line-clamp-7">
            {terms || DEFAULT_QUOTE_TERMS}
          </p>
        </div>
        <div className="text-[8.5px] space-y-1">
          <TotalsRow label="Total parcial" value={currencyMxn(totals.partial)} />
          <TotalsRow label="Subtotal" value={currencyMxn(totals.subtotal)} />
          <TotalsRow
            label={`Impuestos (IVA ${formatPercentLabel(taxRate)}%)`}
            value={currencyMxn(totals.tax)}
          />
          <TotalsRow
            label={`Retención ISR ${formatPercentLabel(isrRetentionRate)}%`}
            value={
              totals.isrRetention > 0
                ? `− ${currencyMxn(totals.isrRetention)}`
                : currencyMxn(0)
            }
          />
          <div
            className="flex items-center justify-between mt-1 px-1.5 py-1 rounded-sm"
            style={{ backgroundColor: "#fef2f2", border: "1px solid #fee2e2" }}
          >
            <span className="font-bold text-neutral-900 text-[9px]">TOTAL MXN</span>
            <span className="font-mono font-bold text-[10px] tabular-nums text-neutral-900">
              {currencyMxn(totals.total)}
            </span>
          </div>
        </div>
      </section>
    </LetterChrome>
  )
}

type SupplierLetterDocumentProps = {
  supplier?: Supplier
  bomLines: SupplierBomLine[]
  quoteDate: string
  quoteNo: string
  projectTitle: string
  printKind?: PdfDocKind
  className?: string
}

function SupplierLetterDocument({
  supplier,
  bomLines,
  quoteDate,
  quoteNo,
  projectTitle,
  printKind,
  className = "",
}: SupplierLetterDocumentProps) {
  return (
    <LetterChrome
      quoteDate={quoteDate}
      quoteNo={quoteNo}
      rightTitle="Solicitud a proveedor"
      printKind={printKind}
      className={className}
    >
      <section className="grid grid-cols-2 gap-3 shrink-0 mb-3 border-y border-neutral-200 py-2.5">
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
            Proveedor
          </p>
          <p className="text-[11px] font-semibold text-neutral-900 truncate">
            {supplier?.name || "—"}
          </p>
          <p className="text-[9px] text-neutral-600 truncate">
            {supplier?.contact || "Sin contacto"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
            Proyecto / folio
          </p>
          <p className="text-[10px] font-semibold text-neutral-900 leading-snug line-clamp-2">
            {projectTitle}
          </p>
          <p className="text-[8.5px] font-mono text-neutral-600 mt-0.5">{quoteNo}</p>
        </div>
      </section>

      <p className="text-[8px] text-neutral-500 mb-2 shrink-0">
        Lista de materiales (nombres y cantidades). Sin costos ni precios.
      </p>

      <div className="flex-1 min-h-0 flex flex-col mb-2">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr
              className="text-white text-[8px] uppercase tracking-wider"
              style={{ backgroundColor: "#171717", color: "#ffffff" }}
            >
              <th className="px-1.5 py-1.5 text-left font-semibold w-[14%]">Código</th>
              <th className="px-1.5 py-1.5 text-left font-semibold w-[52%]">Material</th>
              <th className="px-1.5 py-1.5 text-right font-semibold w-[17%]">Cant.</th>
              <th className="px-1.5 py-1.5 text-left font-semibold w-[17%]">Unidad</th>
            </tr>
          </thead>
          <tbody>
            {bomLines.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-2 py-6 text-center text-neutral-400 border border-neutral-200 text-[9px]"
                >
                  No hay materiales en esta cotización.
                </td>
              </tr>
            ) : (
              bomLines.map((row) => (
                <tr key={row.itemId} className="border border-neutral-200 align-top">
                  <td className="px-1.5 py-1.5 font-mono text-[8px] text-neutral-700">
                    {row.code}
                  </td>
                  <td className="px-1.5 py-1.5 text-[9px] font-medium text-neutral-900 leading-snug">
                    {row.name}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono font-semibold text-[9px] tabular-nums">
                    {row.quantity}
                  </td>
                  <td className="px-1.5 py-1.5 text-[8.5px] text-neutral-600">{row.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(supplier?.email || supplier?.phone || supplier?.whatsapp) && (
        <section className="shrink-0 mb-2 text-[8px] text-neutral-600 space-y-0.5">
          {supplier.email && <p>Correo: {supplier.email}</p>}
          {supplier.phone && <p>Tel: {supplier.phone}</p>}
          {supplier.whatsapp && <p>WhatsApp: {supplier.whatsapp}</p>}
        </section>
      )}
    </LetterChrome>
  )
}

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-neutral-700 gap-2">
      <span className="truncate">{label}</span>
      <span className="font-mono tabular-nums shrink-0">{value}</span>
    </div>
  )
}
