"use client"

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  type Dispatch,
  type ElementType,
  type ReactNode,
  type SetStateAction,
} from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Truck,
  Building2,
  User,
  TrendingUp,
  X,
  MessageCircle,
  Mail,
  XCircle,
  ClipboardList,
  Plus,
  Trash2,
  ImagePlus,
  Lock,
  ChevronDown,
  Download,
  Share2,
} from "lucide-react"
import { publicQuoteTotals, quoteTotals, useTechnik } from "@/lib/technik/store"
import {
  currency,
  currencyMxn,
  currencyPrecise,
  internalEconomy,
  lineTotalMxn,
  quotationDepartments,
  suggestedPublicUnitPrice,
  type Client,
  type CatalogItem,
  type PublicQuoteItem,
  type Quotation,
  type QuoteLine,
  type QuotePipelineStatus,
  type Supplier,
} from "@/lib/technik/data"
import {
  DEFAULT_ISR_RETENTION_RATE,
  DEFAULT_QUOTE_TERMS,
  DEFAULT_TAX_RATE,
  formatPercentLabel,
} from "@/lib/technik/company"
import { DepartmentBadges, inputCls, SearchField, QuoteAuthor, QuotePipelineControls } from "../ui"
import { formatActivityAt } from "@/lib/technik/activity-history"
import { QuotePdfPreview, buildSupplierBomLines, type PdfDocKind } from "../quote-pdf-preview"
import { VisitPhotosSection } from "../visit-photos-section"
import type { View } from "../app-shell"
import {
  clientQuoteMail,
  clientQuoteSharePayload,
  clientWhatsAppNumber,
  copyTextToClipboard,
  dispatchQuoteEmail,
  downloadPdfBlob,
  downloadQuotePdf,
  getQuotePdfBlob,
  openMailto,
  openWhatsApp,
  quoteDispatchRecipients,
  quotePdfFile,
  quotePdfFilename,
  quotePdfProjectName,
  shareQuotePdf,
  supplierQuoteMail,
  supplierQuoteSharePayload,
  supplierWhatsAppNumber,
  supplierWhatsAppText,
} from "@/lib/technik/outbound"
import { captureLetterPdfBlob } from "@/lib/technik/capture-letter-pdf"
import { getSupabaseBrowser } from "@/lib/supabase/browser"
import { CcEmailField } from "../cc-emails"

export function QuotationReview({ id, navigate }: { id: string; navigate: (v: View) => void }) {
  const {
    quotations,
    clients,
    catalog,
    suppliers,
    departments,
    updateQuotation,
    setStatus,
    user,
    markSaving,
  } = useTechnik()
  const isAdmin = user?.role === "admin"
  const q = quotations.find((x) => x.id === id)
  const sentLocked = q?.status === "approved" || q?.status === "closed"

  const [prices, setPrices] = useState<Record<string, number>>({})
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [draftLines, setDraftLines] = useState<QuoteLine[]>([])
  const skipLinesAutoSave = useRef(true)
  const skipCommentsAutoSave = useRef(true)
  const [toast, setToast] = useState<{
    icon: ElementType
    title: string
    msg: string
    action?: { label: string; onClick: () => void }
  } | null>(null)
  const [supplierId, setSupplierId] = useState("")
  const [comments, setComments] = useState("")
  const [publicItems, setPublicItems] = useState<PublicQuoteItem[]>([])
  const [terms, setTerms] = useState(DEFAULT_QUOTE_TERMS)
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE)
  const [isrRetentionRate, setIsrRetentionRate] = useState(DEFAULT_ISR_RETENTION_RATE)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    publicItems: true,
  })
  const [pdfDoc, setPdfDoc] = useState<PdfDocKind>("client")
  const [pdfBusy, setPdfBusy] = useState(false)
  const [clientExtraCc, setClientExtraCc] = useState<string[]>([])
  const [supplierExtraCc, setSupplierExtraCc] = useState<string[]>([])

  useEffect(() => {
    setClientExtraCc([])
    setSupplierExtraCc([])
  }, [id])

  useEffect(() => {
    setOpenSections({
      publicItems: true,
      materials: user?.role !== "admin",
      photos: true,
    })
  }, [id, user?.role])

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (!q) return
    const seed: Record<string, number> = {}
    const qtySeed: Record<string, number> = {}
    for (const line of q.lines) {
      const item = catalog.find((c) => c.id === line.itemId)
      if (!item) continue
      seed[line.itemId] = line.unitPrice ?? suggestedPublicUnitPrice(item)
      qtySeed[line.itemId] = line.quantity
    }
    setPrices(seed)
    setQuantities(qtySeed)
    setDraftLines(q.lines.map((l) => ({ ...l })))
    skipLinesAutoSave.current = true
    skipCommentsAutoSave.current = true
    setComments(q.comments ?? "")
    setPublicItems(q.publicItems ?? [])
    setTerms(q.terms ?? DEFAULT_QUOTE_TERMS)
    setTaxRate(q.taxRate ?? DEFAULT_TAX_RATE)
    setIsrRetentionRate(q.isrRetentionRate ?? DEFAULT_ISR_RETENTION_RATE)
    const firstMat = q.lines
      .map((l) => catalog.find((c) => c.id === l.itemId))
      .find((i) => i?.kind === "material" && i.supplierId)
    setSupplierId(q.supplierId ?? firstMat?.supplierId ?? suppliers[0]?.id ?? "")
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pricedLines = useMemo(() => {
    return draftLines.map((l) => ({
      ...l,
      quantity: quantities[l.itemId] ?? l.quantity,
      unitPrice: prices[l.itemId],
    }))
  }, [draftLines, quantities, prices])

  const totals = useMemo(() => {
    if (!q) return null
    const priced: typeof q = { ...q, lines: pricedLines }
    return quoteTotals(priced, catalog)
  }, [q, pricedLines, catalog])

  const clientTotals = useMemo(
    () => publicQuoteTotals(publicItems, taxRate, isrRetentionRate),
    [publicItems, taxRate, isrRetentionRate],
  )

  const economy = useMemo(() => {
    if (!q) return null
    const priced: typeof q = { ...q, lines: pricedLines }
    return internalEconomy(priced, catalog)
  }, [q, pricedLines, catalog])

  /** Guarda materiales / MO al cambiar (sin botón Guardar). */
  useEffect(() => {
    if (!q || !isAdmin || sentLocked) return
    if (skipLinesAutoSave.current) {
      skipLinesAutoSave.current = false
      return
    }
    const lines: QuoteLine[] = draftLines.map((l) => ({
      ...l,
      quantity: quantities[l.itemId] ?? l.quantity,
      unitPrice: prices[l.itemId],
    }))
    const stored = new Map(q.lines.map((l) => [l.itemId, l]))
    const same =
      lines.length === q.lines.length &&
      lines.every((l) => {
        const cur = stored.get(l.itemId)
        if (!cur) return false
        return (
          cur.quantity === l.quantity &&
          Number(cur.unitPrice ?? 0) === Number(l.unitPrice ?? 0)
        )
      })
    if (same) return

    markSaving()
    const t = window.setTimeout(() => {
      const result = updateQuotation(q.id, { lines })
      if (!result.ok) {
        setToast({ icon: Lock, title: "No permitido", msg: result.error })
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [draftLines, quantities, prices, q, isAdmin, sentLocked, updateQuotation, markSaving])

  useEffect(() => {
    if (!q) return
    if (skipCommentsAutoSave.current) {
      skipCommentsAutoSave.current = false
      return
    }
    if ((comments ?? "") === (q.comments ?? "")) return
    markSaving()
    const t = window.setTimeout(() => {
      updateQuotation(q.id, { comments })
    }, 700)
    return () => window.clearTimeout(t)
  }, [comments, q, updateQuotation, markSaving])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? 7000 : 3200)
    return () => clearTimeout(t)
  }, [toast])

  const stickyRef = useRef<HTMLDivElement>(null)
  const [stickyH, setStickyH] = useState(0)

  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const update = () => setStickyH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isAdmin, q?.id, q?.clientSentAt])

  if (!q || !totals) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Cotización no encontrada.
        <button onClick={() => navigate({ name: "quotations" })} className="block mx-auto mt-4 text-primary">
          Volver
        </button>
      </div>
    )
  }

  if (!isAdmin && q.status !== "draft" && q.status !== "pending_review") {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Esta cotización ya no está en tu bandeja.
        <button onClick={() => navigate({ name: "quotations" })} className="block mx-auto mt-4 text-primary">
          Volver a mis cotizaciones
        </button>
      </div>
    )
  }

  const client = clients.find((c) => c.id === q.clientId)
  const supplier = suppliers.find((s) => s.id === supplierId)
  /** Cantidades/horas y precios públicos: admin puede ajustar hasta enviar al cliente. */
  const qtyEditable = isAdmin && !sentLocked
  /** Precios públicos editables (sobrecargo por cliente) hasta envío. */
  const priceEditable = qtyEditable
  const canDispatch =
    isAdmin &&
    (q.status === "pending_review" ||
      q.status === "approved" ||
      !!q.clientSentAt ||
      !!q.supplierSentAt)
  const materialLines = pricedLines.filter(
    (l) => catalog.find((c) => c.id === l.itemId)?.kind === "material",
  )
  const laborLines = pricedLines.filter(
    (l) => catalog.find((c) => c.id === l.itemId)?.kind === "labor",
  )
  const extraLines = pricedLines.filter(
    (l) => catalog.find((c) => c.id === l.itemId)?.kind === "extra",
  )

  function persistDocument(historyAction?: string) {
    if (sentLocked) {
      setToast({
        icon: Lock,
        title: "Cotización aprobada",
        msg: "Pásala a En revisión para actualizar totales y vuelve a aprobar.",
      })
      return false
    }
    const lines: QuoteLine[] = draftLines.map((l) => ({
      ...l,
      quantity: quantities[l.itemId] ?? l.quantity,
      unitPrice: prices[l.itemId],
    }))
    const result = updateQuotation(
      q!.id,
      {
        lines,
        publicItems,
        terms,
        taxRate,
        isrRetentionRate,
      },
      historyAction,
    )
    if (!result.ok) {
      setToast({ icon: Lock, title: "No permitido", msg: result.error })
      return false
    }
    setDraftLines(lines.map((l) => ({ ...l })))
    skipLinesAutoSave.current = true
    return true
  }

  function removeInternalLine(itemId: string) {
    if (sentLocked) {
      setToast({
        icon: Lock,
        title: "Cotización aprobada",
        msg: "Pásala a En revisión para actualizar materiales o mano de obra.",
      })
      return
    }
    setDraftLines((prev) => prev.filter((l) => l.itemId !== itemId))
    setPrices((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setQuantities((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  function addInternalCatalogItem(item: CatalogItem) {
    if (sentLocked) {
      setToast({
        icon: Lock,
        title: "Cotización aprobada",
        msg: "Pásala a En revisión para actualizar materiales o mano de obra.",
      })
      return
    }
    if (draftLines.some((l) => l.itemId === item.id)) {
      setToast({
        icon: ClipboardList,
        title: "Ya está en la lista",
        msg: `“${item.name}” ya forma parte de esta cotización.`,
      })
      return
    }
    const qty = item.kind === "labor" ? 1 : 1
    const unitPrice = suggestedPublicUnitPrice(item)
    setDraftLines((prev) => [...prev, { itemId: item.id, quantity: qty, unitPrice }])
    setQuantities((prev) => ({ ...prev, [item.id]: qty }))
    setPrices((prev) => ({ ...prev, [item.id]: unitPrice }))
    setOpenSections((prev) => ({
      ...prev,
      [item.kind === "labor" ? "labor" : item.kind === "extra" ? "extras" : "materials"]: true,
    }))
    setToast({
      icon: CheckCircle2,
      title: "Agregado",
      msg: `“${item.name}” se añadió a ${
        item.kind === "labor"
          ? "mano de obra"
          : item.kind === "extra"
            ? "extras"
            : "materiales"
      }.`,
    })
  }

  function addLineToPublicItems(line: QuoteLine) {
    if (sentLocked) {
      setToast({
        icon: Lock,
        title: "Cotización aprobada",
        msg: "Pásala a En revisión para actualizar ítems al cliente.",
      })
      return
    }
    const item = catalog.find((c) => c.id === line.itemId)
    if (!item) return
    const qty = quantities[line.itemId] ?? line.quantity
    const next: PublicQuoteItem = {
      id: `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      quantity: qty,
      title: item.name,
      description: "",
      unitPrice: prices[line.itemId] ?? suggestedPublicUnitPrice(item),
    }
    setPublicItems((prev) => [...prev, next])
    setOpenSections((prev) => ({ ...prev, publicItems: true }))
    setToast({
      icon: CheckCircle2,
      title: "Agregado a ítems",
      msg: `“${item.name}” se copió a Ítems al cliente (solo nombre y totales en el PDF).`,
    })
  }

  function applyTotalToClientItem1() {
    if (sentLocked) {
      setToast({
        icon: Lock,
        title: "Cotización aprobada",
        msg: "Pásala a En revisión para actualizar ítems al cliente.",
      })
      return
    }
    if (!economy || !q) return
    const total = economy.loadedCostTotal
    const title = q.title.trim() || "Proyecto"
    setPublicItems((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            quantity: 1,
            title,
            description: "",
            unitPrice: total,
          },
        ]
      }
      const [first, ...rest] = prev
      return [{ ...first, title, quantity: 1, unitPrice: total }, ...rest]
    })
    setOpenSections((prev) => ({ ...prev, publicItems: true }))
    setToast({
      icon: CheckCircle2,
      title: "Ítem 1 actualizado",
      msg: `“${title}” · ${currencyPrecise(total)} listo para el PDF al cliente.`,
    })
  }

  function lockPricesIfNeeded() {
    // Ya enviada al cliente: montos bloqueados; solo asegurar status approved
    if (sentLocked) {
      if (q!.status === "pending_review") {
        setStatus(q!.id, "approved", "Aprobó y bloqueó precios")
      }
      return true
    }
    if (q!.status !== "pending_review") {
      return persistDocument()
    }
    const ok = persistDocument("Actualizó precios e ítems al cliente")
    if (ok) setStatus(q!.id, "approved", "Aprobó y bloqueó precios")
    return ok
  }

  async function downloadPdf(doc: PdfDocKind, quiet = false) {
    if (pdfBusy) return "busy" as const
    if (doc === "client" && publicItems.length === 0) {
      setToast({
        icon: FileText,
        title: "Faltan ítems al cliente",
        msg: "Agrega al menos un ítem público antes de descargar el PDF.",
      })
      return "blocked" as const
    }
    if (doc === "supplier") {
      const bom = buildSupplierBomLines(pricedLines, catalog)
      if (bom.length === 0) {
        setToast({
          icon: Truck,
          title: "Sin materiales",
          msg: "Agrega materiales a la cotización antes de descargar la solicitud al proveedor.",
        })
        return "blocked" as const
      }
    }
    const filename = quotePdfFilename(
      q!.reference || q!.id,
      doc,
      quotePdfProjectName(q!),
    )
    setPdfBusy(true)
    if (!quiet) {
      setToast({
        icon: Download,
        title: "Generando PDF",
        msg: "Una hoja Letter, igual que la vista previa.",
      })
    }
    try {
      const mode = await downloadQuotePdf({
        quotationId: q!.id,
        kind: doc,
        filename,
        capture: () => captureLetterPdfBlob(doc),
      })
      if (!quiet) {
        setToast({
          icon: Download,
          title: "PDF descargado",
          msg: filename,
        })
      }
      return mode
    } catch {
      setToast({
        icon: XCircle,
        title: "No se pudo generar el PDF",
        msg: "Revisa la vista previa e inténtalo de nuevo.",
      })
      return "error" as const
    } finally {
      setPdfBusy(false)
    }
  }

  async function shareOutbound(kind: PdfDocKind) {
    if (pdfBusy) return
    const reference = q!.reference || q!.id

    if (kind === "client") {
      if (publicItems.length === 0) {
        setToast({
          icon: FileText,
          title: "Faltan ítems al cliente",
          msg: "Agrega al menos un ítem público antes de enviar el PDF.",
        })
        return
      }
      if (!client) {
        setToast({
          icon: Mail,
          title: "Sin cliente",
          msg: "Asigna un cliente a la cotización para compartir el PDF.",
        })
        return
      }
      if (!client.email.trim() && !client.phone.trim()) {
        setToast({
          icon: Mail,
          title: "Sin contacto del cliente",
          msg: "Registra el correo o el teléfono del cliente para enviarle la cotización.",
        })
        return
      }
    } else {
      if (!supplier) return
      const bom = buildSupplierBomLines(pricedLines, catalog)
      if (bom.length === 0) {
        setToast({
          icon: Truck,
          title: "Sin materiales",
          msg: "Agrega materiales a la cotización antes de generar la solicitud al proveedor.",
        })
        return
      }
      const waDigits = supplierWhatsAppNumber(supplier)
      if (!supplier.email.trim() && !waDigits) {
        setToast({
          icon: Mail,
          title: "Sin contacto del proveedor",
          msg: `Registra el correo o el WhatsApp de ${supplier.name}.`,
        })
        return
      }
    }

    if (!lockPricesIfNeeded()) return

    const filename = quotePdfFilename(reference, kind, quotePdfProjectName(q!))
    setPdfBusy(true)
    setToast({
      icon: Share2,
      title: "Generando PDF",
      msg: "Se abrirá Compartir con el archivo listo.",
    })

    try {
      const { blob } = await getQuotePdfBlob({
        quotationId: q!.id,
        kind,
        capture: () => captureLetterPdfBlob(kind),
      })
      const file = quotePdfFile(blob, filename)
      const payload =
        kind === "client"
          ? clientQuoteSharePayload({
              client: client!,
              reference,
              title: q!.title,
            })
          : supplierQuoteSharePayload({
              supplier: supplier!,
              reference,
            })

      if (payload.contact) await copyTextToClipboard(payload.contact)

      const shared = await shareQuotePdf({
        file,
        title: payload.title,
        text: payload.text,
      })

      if (shared === "cancelled") {
        setToast({
          icon: XCircle,
          title: "Envío cancelado",
          msg: "No se marcó como enviada.",
        })
        return
      }

      let fallbackChannel: "email" | "whatsapp" | null = null
      if (shared === "unsupported") {
        downloadPdfBlob(blob, filename)
        if (kind === "client") {
          const mail = clientQuoteMail({
            client: client!,
            reference,
            title: q!.title,
          })
          const waDigits = clientWhatsAppNumber(client!)
          if (mail.to) {
            fallbackChannel = "email"
            window.setTimeout(() => openMailto(mail.to, mail.subject, mail.body), 400)
          } else if (waDigits) {
            fallbackChannel = "whatsapp"
            window.setTimeout(() => openWhatsApp(waDigits, payload.text), 400)
          }
        } else {
          const mail = supplierQuoteMail({
            supplier: supplier!,
            reference,
          })
          const waDigits = supplierWhatsAppNumber(supplier!)
          if (mail.to) {
            fallbackChannel = "email"
            window.setTimeout(() => openMailto(mail.to, mail.subject, mail.body), 400)
          } else if (waDigits) {
            fallbackChannel = "whatsapp"
            const text = supplierWhatsAppText({ supplier: supplier!, reference })
            window.setTimeout(() => openWhatsApp(waDigits, text), 400)
          }
        }
      }

      const d = new Date().toISOString().slice(0, 10)
      if (kind === "client") {
        const result = updateQuotation(
          q!.id,
          {
            clientSentAt: d,
            clientResponse: q!.clientResponse ?? "en_espera",
            publicItems,
            terms,
            taxRate,
            isrRetentionRate,
          },
          `PDF compartido con el cliente (${payload.contact})`,
        )
        if (!result.ok) {
          setToast({ icon: Lock, title: "No permitido", msg: result.error })
          return
        }
        if (shared === "shared") {
          setToast({
            icon: Share2,
            title: "PDF compartido",
            msg: "El contacto quedó en el mensaje y en el portapapeles.",
          })
        } else if (fallbackChannel === "email") {
          setToast({
            icon: Mail,
            title: "Correo listo",
            msg: `Se abrió un correo a ${client!.email}. Adjunta el PDF descargado.`,
          })
        } else if (fallbackChannel === "whatsapp") {
          setToast({
            icon: MessageCircle,
            title: "WhatsApp listo",
            msg: `Se abrió el chat con ${client!.phone}. Adjunta el PDF descargado.`,
          })
        } else {
          setToast({
            icon: Download,
            title: "PDF descargado",
            msg: "Copia el contacto del cliente y adjunta el archivo.",
          })
        }
        return
      }

      updateQuotation(
        q!.id,
        { supplierSentAt: d, supplierId: supplier!.id },
        `Lista de materiales compartida con ${supplier!.name} (${payload.contact})`,
      )
      if (shared === "shared") {
        setToast({
          icon: Share2,
          title: "PDF compartido",
          msg: "El contacto quedó en el mensaje y en el portapapeles.",
        })
      } else if (fallbackChannel === "email") {
        setToast({
          icon: Mail,
          title: "Correo listo",
          msg: `Se abrió un correo a ${supplier!.email}. Adjunta el PDF descargado.`,
        })
      } else if (fallbackChannel === "whatsapp") {
        setToast({
          icon: MessageCircle,
          title: "WhatsApp listo",
          msg: `Se abrió el chat con ${supplier!.whatsapp || supplier!.phone}. Adjunta el PDF descargado.`,
        })
      } else {
        setToast({
          icon: Download,
          title: "PDF descargado",
          msg: "Copia el contacto del proveedor y adjunta el archivo.",
        })
      }
    } catch {
      setToast({
        icon: XCircle,
        title: "No se pudo generar el PDF",
        msg: "Revisa la vista previa e inténtalo de nuevo.",
      })
    } finally {
      setPdfBusy(false)
    }
  }

  async function sendEmailOutbound(kind: PdfDocKind) {
    if (pdfBusy) return
    const reference = q!.reference || q!.id

    if (kind === "client") {
      if (publicItems.length === 0) {
        setToast({
          icon: FileText,
          title: "Faltan ítems al cliente",
          msg: "Agrega al menos un ítem público antes de enviar el PDF.",
        })
        return
      }
      if (!client?.email.trim()) {
        setToast({
          icon: Mail,
          title: "Sin correo del cliente",
          msg: "Registra el email del cliente para enviarle la cotización.",
        })
        return
      }
    } else {
      if (!supplier) return
      const bom = buildSupplierBomLines(pricedLines, catalog)
      if (bom.length === 0) {
        setToast({
          icon: Truck,
          title: "Sin materiales",
          msg: "Agrega materiales a la cotización antes de generar la solicitud al proveedor.",
        })
        return
      }
      if (!supplier.email.trim()) {
        setToast({
          icon: Mail,
          title: "Sin correo del proveedor",
          msg: `Registra el email de ${supplier.name} para enviarle la solicitud.`,
        })
        return
      }
    }

    if (!lockPricesIfNeeded()) return

    const mail =
      kind === "client"
        ? clientQuoteMail({
            client: client!,
            reference,
            title: q!.title,
          })
        : supplierQuoteMail({
            supplier: supplier!,
            reference,
          })
    const recipients = quoteDispatchRecipients({
      to: mail.to,
      clientCc: kind === "client" ? client?.ccEmails : undefined,
      extraCc: kind === "client" ? clientExtraCc : supplierExtraCc,
    })
    const filename = quotePdfFilename(reference, kind, quotePdfProjectName(q!))
    setPdfBusy(true)
    setToast({
      icon: Mail,
      title: "Enviando correo",
      msg: `Sale de cotizaciones@solutionstechnik.com a ${recipients.to}.`,
    })

    try {
      const { blob } = await getQuotePdfBlob({
        quotationId: q!.id,
        kind,
        capture: () => captureLetterPdfBlob(kind),
      })
      const supabase = getSupabaseBrowser()
      let token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) {
        token = (await supabase.auth.refreshSession()).data.session?.access_token
      }
      if (!token) {
        setToast({
          icon: Lock,
          title: "Sesión inválida",
          msg: "Cierra sesión y vuelve a entrar para enviar el correo.",
        })
        return
      }

      const sent = await dispatchQuoteEmail({
        quotationId: q!.id,
        kind,
        toEmail: recipients.to,
        cc: recipients.cc,
        subject: mail.subject,
        body: mail.body,
        filename,
        pdf: blob,
        accessToken: token,
      })
      if (!sent.ok) {
        setToast({ icon: XCircle, title: "No se pudo enviar", msg: sent.error })
        return
      }

      const d = new Date().toISOString().slice(0, 10)
      const ccNote = recipients.cc.length > 0 ? ` · CC ${recipients.cc.join(", ")}` : ""
      if (kind === "client") {
        const result = updateQuotation(
          q!.id,
          {
            clientSentAt: d,
            clientResponse: q!.clientResponse ?? "en_espera",
            publicItems,
            terms,
            taxRate,
            isrRetentionRate,
          },
          `PDF enviado al cliente (${recipients.to}${ccNote})`,
        )
        if (!result.ok) {
          setToast({ icon: Lock, title: "No permitido", msg: result.error })
          return
        }
      } else {
        updateQuotation(
          q!.id,
          { supplierSentAt: d, supplierId: supplier!.id },
          `Lista de materiales enviada a ${supplier!.name} (${recipients.to}${ccNote})`,
        )
      }
      setToast({
        icon: CheckCircle2,
        title: "Correo enviado",
        msg: recipients.cc.length
          ? `Enviado a ${recipients.to}. Copias: ${recipients.cc.join(", ")}.`
          : `Enviado a ${recipients.to}.`,
      })
    } catch {
      setToast({
        icon: XCircle,
        title: "No se pudo generar el PDF",
        msg: "Revisa la vista previa e inténtalo de nuevo.",
      })
    } finally {
      setPdfBusy(false)
    }
  }

  function onPipelineApplied(
    status: QuotePipelineStatus,
    extra?: { projectId?: string; error?: string; projectCreated?: boolean },
  ) {
    if (extra?.error) {
      setToast({ icon: XCircle, title: "No permitido", msg: extra.error })
      return
    }
    if (status === "sent_client") {
      setToast({
        icon: CheckCircle2,
        title: "Enviada al cliente",
        msg: "La cotización quedó marcada como enviada.",
      })
      return
    }
    if (status === "approved") {
      const projectId = extra?.projectId
      if (projectId && extra?.projectCreated) {
        setToast({
          icon: CheckCircle2,
          title: "Proyecto creado",
          msg: `${projectId} listo para seguimiento operativo.`,
          action: {
            label: "Abrir proyecto",
            onClick: () => navigate({ name: "project", id: projectId }),
          },
        })
        return
      }
      if (projectId) {
        setToast({
          icon: CheckCircle2,
          title: "Aprobada",
          msg: `Ya existe el proyecto ${projectId}.`,
          action: {
            label: "Ver proyecto",
            onClick: () => navigate({ name: "project", id: projectId }),
          },
        })
        return
      }
    }
    if (status === "closed") {
      setToast({
        icon: XCircle,
        title: "Rechazada",
        msg: "La cotización pasó a archivo.",
      })
    }
  }

  const pinnedTop = "var(--app-header-h, 4rem)"
  const sideStickyTop = `calc(var(--app-header-h, 4rem) + ${stickyH}px + 8px)`

  return (
    <div>
      {/* Reserva espacio para la barra fija */}
      <div aria-hidden className="mb-5" style={{ height: stickyH || (isAdmin ? 188 : 132) }} />

      <div
        ref={stickyRef}
        className="fixed inset-x-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-xl shadow-[0_10px_28px_-18px_rgba(0,0,0,0.55)]"
        style={{ top: pinnedTop }}
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-5 lg:px-8 py-3">
          <button
            onClick={() => navigate({ name: "quotations" })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2.5 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Volver
          </button>
          <div className="rounded-2xl border border-border/70 bg-card/90 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg lg:text-xl font-bold text-foreground tracking-tight font-display truncate">
                  {q.title}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono text-[11px] font-semibold text-primary">{q.reference}</span>
                  {client?.company && (
                    <>
                      <span className="text-border">·</span>
                      <span className="truncate text-foreground/75">{client.company}</span>
                    </>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DepartmentBadges quotation={q} />
                  <QuoteAuthor quotation={q} layout="inline" />
                </div>
              </div>
              <QuotePipelineControls
                quotation={q}
                align="end"
                className="shrink-0 lg:max-w-[26rem]"
                beforeApply={() => {
                  if (q.status === "approved" || q.status === "closed") return true
                  persistDocument()
                  return true
                }}
                onApplied={onPipelineApplied}
              />
            </div>
            {isAdmin && (
              <label className="mt-3 block min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notas internas
                </span>
                <input
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Acuerdos, llamadas, motivo de rechazo…"
                  className="mt-1 w-full rounded-lg bg-input/60 border border-border px-3 py-1.5 text-xs outline-none focus:border-primary/60"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/[0.06] p-3.5 text-sm text-muted-foreground">
          Vista colaborador: ves cantidades y estado. Los costos y envíos los gestiona administración.
        </div>
      )}

      <div
        className={`grid gap-6 items-start ${
          isAdmin
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
            : "lg:grid-cols-[1fr_340px]"
        }`}
      >
        <div className="flex flex-col gap-3 min-w-0">
          {isAdmin && (
            <CollapsibleSection
              title="Ítems al cliente"
              badge="Visible en PDF"
              open={!!openSections.publicItems}
              onToggle={() => toggleSection("publicItems")}
              variant="client"
              summary={`${publicItems.length} ítem${publicItems.length === 1 ? "" : "s"} · ${currencyMxn(clientTotals.total)}`}
            >
              <PublicItemsEditor
                items={publicItems}
                setItems={setPublicItems}
                terms={terms}
                setTerms={setTerms}
                taxRate={taxRate}
                setTaxRate={setTaxRate}
                isrRetentionRate={isrRetentionRate}
                setIsrRetentionRate={setIsrRetentionRate}
                clientTotals={clientTotals}
                locked={sentLocked}
                onSave={() => {
                  if (!persistDocument("Actualizó ítems al cliente")) return
                  setToast({
                    icon: CheckCircle2,
                    title: "Ítems guardados",
                    msg: "La cotización al cliente quedó actualizada.",
                  })
                }}
              />
            </CollapsibleSection>
          )}

          {isAdmin && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              Las secciones siguientes son de uso interno — no aparecen en el PDF al cliente.
            </div>
          )}

          {(materialLines.length > 0 || (isAdmin && !sentLocked)) && (
            <CollapsibleSection
              title="Materiales"
              badge={isAdmin ? "Uso interno" : undefined}
              open={!!openSections.materials}
              onToggle={() => toggleSection("materials")}
              summary={`${materialLines.length} línea${materialLines.length === 1 ? "" : "s"}`}
            >
              <LinesTable
                title="Materiales"
                lines={materialLines}
                catalog={catalog}
                kind="material"
                prices={prices}
                setPrices={setPrices}
                quantities={quantities}
                setQuantities={setQuantities}
                editable={priceEditable}
                qtyEditable={qtyEditable}
                showCosts={isAdmin}
                onAddToClient={isAdmin && !sentLocked ? addLineToPublicItems : undefined}
                onRemoveLine={qtyEditable ? removeInternalLine : undefined}
                onAddCatalogItem={qtyEditable ? addInternalCatalogItem : undefined}
                embedded
              />
            </CollapsibleSection>
          )}

          {(laborLines.length > 0 || (isAdmin && !sentLocked)) && (
            <CollapsibleSection
              title="Mano de obra"
              badge={isAdmin ? "Uso interno" : undefined}
              open={!!openSections.labor}
              onToggle={() => toggleSection("labor")}
              summary={`${laborLines.length} línea${laborLines.length === 1 ? "" : "s"}`}
            >
              <LinesTable
                title="Mano de obra"
                lines={laborLines}
                catalog={catalog}
                kind="labor"
                prices={prices}
                setPrices={setPrices}
                quantities={quantities}
                setQuantities={setQuantities}
                editable={priceEditable}
                qtyEditable={qtyEditable}
                showCosts={isAdmin}
                onAddToClient={isAdmin && !sentLocked ? addLineToPublicItems : undefined}
                onRemoveLine={qtyEditable ? removeInternalLine : undefined}
                onAddCatalogItem={qtyEditable ? addInternalCatalogItem : undefined}
                labor
                embedded
              />
            </CollapsibleSection>
          )}

          {(extraLines.length > 0 || (isAdmin && !sentLocked)) && (
            <CollapsibleSection
              title="Extras"
              badge={isAdmin ? "Uso interno" : undefined}
              open={!!openSections.extras}
              onToggle={() => toggleSection("extras")}
              summary={`${extraLines.length} línea${extraLines.length === 1 ? "" : "s"}`}
            >
              <LinesTable
                title="Extras"
                lines={extraLines}
                catalog={catalog}
                kind="extra"
                prices={prices}
                setPrices={setPrices}
                quantities={quantities}
                setQuantities={setQuantities}
                editable={priceEditable}
                qtyEditable={qtyEditable}
                showCosts={isAdmin}
                onAddToClient={isAdmin && !sentLocked ? addLineToPublicItems : undefined}
                onRemoveLine={qtyEditable ? removeInternalLine : undefined}
                onAddCatalogItem={qtyEditable ? addInternalCatalogItem : undefined}
                embedded
              />
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title="Fotos de visita"
            open={!!openSections.photos}
            onToggle={() => toggleSection("photos")}
            summary={
              (q.visitPhotos?.length ?? 0) > 0
                ? `${q.visitPhotos!.length} foto${q.visitPhotos!.length === 1 ? "" : "s"}`
                : "Sin fotos"
            }
          >
            <div className="pt-3">
              <VisitPhotosSection
                quotationId={q.id}
                photos={q.visitPhotos}
                quotePhotoUrl={q.coverImageUrl}
                quotePhotoLocked={sentLocked}
                onToggleQuotePhoto={
                  isAdmin
                    ? (photo) => {
                        if (sentLocked) return
                        updateQuotation(q.id, { coverImageUrl: photo?.url })
                      }
                    : undefined
                }
                canEdit={
                  !isAdmin &&
                  user?.role === "empleado" &&
                  q.createdById === user.id &&
                  (q.status === "draft" || q.status === "pending_review")
                }
                compact
              />
            </div>
          </CollapsibleSection>

          {q.notes && (
            <CollapsibleSection
              title="Nota del solicitante"
              open={!!openSections.notes}
              onToggle={() => toggleSection("notes")}
              summary="Ver nota"
            >
              <p className="text-sm text-foreground whitespace-pre-wrap">{q.notes}</p>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title="Cliente"
            open={!!openSections.client}
            onToggle={() => toggleSection("client")}
            summary={client?.company ?? "Sin cliente"}
          >
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Detail icon={Building2} label="Empresa" value={client?.company ?? "—"} />
              <Detail icon={User} label="Contacto" value={client?.contact ?? "—"} />
              <Detail icon={Mail} label="Correo" value={client?.email ?? "—"} />
              <Detail icon={FileText} label="ID" value={client?.id ?? "—"} mono />
              <Detail
                icon={TrendingUp}
                label="Departamento"
                value={
                  quotationDepartments(q)
                    .map((id) => departments.find((d) => d.id === id)?.label ?? id)
                    .join(" · ") || "—"
                }
              />
              <Detail
                icon={FileText}
                label="Fecha de envío"
                value={q.clientSentAt ?? "Sin enviar"}
                mono
              />
            </div>
          </CollapsibleSection>

          {isAdmin && economy && (
            <CollapsibleSection
              title="Economía interna"
              badge="Uso interno"
              open={!!openSections.economy}
              onToggle={() => toggleSection("economy")}
              summary={`Total ${currencyPrecise(economy.loadedCostTotal)}`}
            >
              <p className="text-xs text-muted-foreground mb-4">
                Cada fila muestra el total ya aplicado y la fórmula en el detalle. Usa el precio
                público de cada línea (editable arriba); si no se ajustó, materiales = costo +10%.
                Centavos visibles. No va al PDF.
              </p>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
                      <th className="px-3 py-2 font-semibold">Descripción</th>
                      <th className="px-3 py-2 font-semibold text-right">Fórmula</th>
                      <th className="px-3 py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {economy.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2.5 text-foreground font-medium">{row.label}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-muted-foreground leading-snug">
                          {row.basisLabel}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                          {currencyPrecise(row.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/10">
                      <td className="px-3 py-2.5 font-bold text-foreground" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary tabular-nums">
                        {currencyPrecise(economy.loadedCostTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 text-sm mt-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="size-3.5" />
                    Margen (ganancia)
                  </span>
                  {(() => {
                    const profit = economy.profit
                    const marginPct =
                      economy.loadedCostTotal > 0
                        ? (profit / economy.loadedCostTotal) * 100
                        : 0
                    // Verde real (no fin-gain = cyan de marca). Amarillo empate. Rojo pérdida.
                    const tone =
                      profit > 0
                        ? "text-emerald-500"
                        : profit === 0
                          ? "text-amber-500"
                          : "text-destructive"
                    return (
                      <span className={`font-mono font-bold tabular-nums ${tone}`}>
                        {currencyPrecise(profit)} · {marginPct.toFixed(2)}%
                      </span>
                    )
                  })()}
                </div>
                <div className="flex flex-col gap-2 border-t border-border pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-foreground font-semibold uppercase tracking-wide text-sm">
                    Total a enviar a cliente
                  </span>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {!sentLocked && (
                      <button
                        type="button"
                        onClick={applyTotalToClientItem1}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
                      >
                        <Plus className="size-3.5" />
                        Al ítem 1 del cliente
                      </button>
                    )}
                    <span className="text-xl font-mono font-bold text-primary tabular-nums">
                      {currencyPrecise(economy.loadedCostTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {isAdmin && (
            <div className="lg:hidden flex flex-col gap-3">
              <CollapsibleSection
                title="Vista previa PDF"
                open={!!openSections.preview}
                onToggle={() => toggleSection("preview")}
                summary={
                  pdfDoc === "client" ? "Cotización Cliente" : "Solicitud Proveedor"
                }
              >
                <QuotePdfPreview
                  quotation={q}
                  client={client}
                  publicItems={publicItems}
                  terms={terms}
                  taxRate={taxRate}
                  isrRetentionRate={isrRetentionRate}
                  lines={pricedLines}
                  catalog={catalog}
                  supplier={supplier}
                  doc={pdfDoc}
                  onDocChange={setPdfDoc}
                  enablePrint={false}
                />
              </CollapsibleSection>
              <CollapsibleSection
                title="Acciones"
                open={!!openSections.actions}
                onToggle={() => toggleSection("actions")}
                summary="Cliente y proveedores"
              >
                <ActionsPanel
                  canDispatch={canDispatch}
                  client={client}
                  q={q}
                  supplier={supplier}
                  suppliers={suppliers}
                  supplierId={supplierId}
                  setSupplierId={setSupplierId}
                  clientExtraCc={clientExtraCc}
                  setClientExtraCc={setClientExtraCc}
                  supplierExtraCc={supplierExtraCc}
                  setSupplierExtraCc={setSupplierExtraCc}
                  pdfBusy={pdfBusy}
                  onSendEmailClient={() => void sendEmailOutbound("client")}
                  onShareClient={() => void shareOutbound("client")}
                  onDownloadClient={() => void downloadPdf("client")}
                  onSendEmailSupplier={() => void sendEmailOutbound("supplier")}
                  onShareSupplier={() => void shareOutbound("supplier")}
                  onDownloadSupplier={() => void downloadPdf("supplier")}
                  embedded
                />
              </CollapsibleSection>
            </div>
          )}
        </div>

        {isAdmin ? (
          <div
            className="hidden lg:flex lg:sticky self-start flex-col gap-4"
            style={{ top: sideStickyTop }}
          >
            <QuotePdfPreview
              quotation={q}
              client={client}
              publicItems={publicItems}
              terms={terms}
              taxRate={taxRate}
              isrRetentionRate={isrRetentionRate}
              lines={pricedLines}
              catalog={catalog}
              supplier={supplier}
              doc={pdfDoc}
              onDocChange={setPdfDoc}
            />
            <ActionsPanel
              canDispatch={canDispatch}
              client={client}
              q={q}
              supplier={supplier}
              suppliers={suppliers}
              supplierId={supplierId}
              setSupplierId={setSupplierId}
              clientExtraCc={clientExtraCc}
              setClientExtraCc={setClientExtraCc}
              supplierExtraCc={supplierExtraCc}
              setSupplierExtraCc={setSupplierExtraCc}
              pdfBusy={pdfBusy}
              onSendEmailClient={() => void sendEmailOutbound("client")}
              onShareClient={() => void shareOutbound("client")}
              onDownloadClient={() => void downloadPdf("client")}
              onSendEmailSupplier={() => void sendEmailOutbound("supplier")}
              onShareSupplier={() => void shareOutbound("supplier")}
              onDownloadSupplier={() => void downloadPdf("supplier")}
            />
          </div>
        ) : (
          <div
            className="lg:sticky flex flex-col gap-4"
            style={{ top: sideStickyTop }}
          >
            <div className="rounded-2xl surface-elevated p-5">
              <h2 className="text-sm font-bold font-display mb-3">Resumen</h2>
              <p className="text-sm text-muted-foreground">
                {materialLines.length} materiales · {totals.laborHours} h · {extraLines.length}{" "}
                extras
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Los totales económicos no son visibles en tu rol.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-2">
        <button
          type="button"
          onClick={() => toggleSection("history")}
          aria-expanded={!!openSections.history}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Historial de acciones
          <span className="opacity-70">({q.history.length})</span>
          <ChevronDown
            className={`size-3.5 transition-transform ${openSections.history ? "rotate-180" : ""}`}
          />
        </button>
        {!!openSections.history && (
          <ul className="mt-3 flex flex-col gap-2.5">
            {[...q.history].reverse().map((h, i) => {
              const when = formatActivityAt(h.at)
              return (
                <li key={`${h.at}-${h.action}-${i}`} className="flex gap-3 text-sm">
                  <div className="shrink-0 w-[7.5rem] pt-0.5">
                    <p className="font-mono text-[11px] text-muted-foreground">{when.date}</p>
                    {when.time && (
                      <p className="font-mono text-[11px] text-muted-foreground">{when.time}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-foreground">{h.action}</p>
                    <p className="text-[11px] text-muted-foreground">{h.by}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex items-start gap-3 rounded-2xl surface-elevated p-4 pr-10 max-w-sm glow-teal-sm"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
              <toast.icon className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{toast.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{toast.msg}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick()
                    setToast(null)
                  }}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CollapsibleSection({
  title,
  badge,
  summary,
  open,
  onToggle,
  variant = "default",
  children,
}: {
  title: string
  badge?: string
  summary?: string
  open: boolean
  onToggle: () => void
  variant?: "default" | "client"
  children: ReactNode
}) {
  const shell =
    variant === "client"
      ? "border-2 border-primary/45 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(0,217,234,0.12)]"
      : "border border-border surface-card"

  return (
    <div className={`rounded-2xl overflow-hidden ${shell}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground font-display">{title}</span>
            {badge && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  variant === "client"
                    ? "border-primary/35 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {badge}
              </span>
            )}
          </div>
          {!open && summary && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
          )}
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="px-4 pb-4 pt-0 border-t border-border/60">{children}</div>}
    </div>
  )
}

function ActionsPanel({
  canDispatch,
  client,
  q,
  supplier,
  suppliers,
  supplierId,
  setSupplierId,
  clientExtraCc,
  setClientExtraCc,
  supplierExtraCc,
  setSupplierExtraCc,
  pdfBusy,
  onSendEmailClient,
  onShareClient,
  onDownloadClient,
  onSendEmailSupplier,
  onShareSupplier,
  onDownloadSupplier,
  embedded,
}: {
  canDispatch: boolean
  client?: Client
  q: Quotation
  supplier?: Supplier
  suppliers: Supplier[]
  supplierId: string
  setSupplierId: (id: string) => void
  clientExtraCc: string[]
  setClientExtraCc: (emails: string[]) => void
  supplierExtraCc: string[]
  setSupplierExtraCc: (emails: string[]) => void
  pdfBusy?: boolean
  onSendEmailClient: () => void
  onShareClient: () => void
  onDownloadClient: () => void
  onSendEmailSupplier: () => void
  onShareSupplier: () => void
  onDownloadSupplier: () => void
  embedded?: boolean
}) {
  const waNumber = supplier ? supplier.whatsapp || supplier.phone : ""
  const hint =
    "El correo sale de cotizaciones@solutionstechnik.com con el PDF. Compartir es para WhatsApp u otra app."
  const clientLockedCc = client?.email
    ? quoteDispatchRecipients({
        to: client.email,
        clientCc: client.ccEmails,
      }).cc
    : []
  const supplierLockedCc = supplier?.email
    ? quoteDispatchRecipients({
        to: supplier.email,
      }).cc
    : []

  return (
    <div className={embedded ? "pt-3" : "rounded-2xl surface-card p-5"}>
      {!embedded && (
        <>
          <h2 className="text-sm font-bold text-foreground font-display mb-1">Acciones</h2>
          <p className="text-xs text-muted-foreground mb-4">{hint}</p>
        </>
      )}
      {embedded && <p className="text-xs text-muted-foreground mb-3">{hint}</p>}

      {canDispatch ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-background/40 p-3.5 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Cliente</p>
              <p className="text-[11px] text-muted-foreground">Cotización oficial en PDF</p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Para
              </p>
              {client ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {client.contact}
                  </p>
                  <p className="text-xs text-muted-foreground">{client.company}</p>
                  <p className="flex items-center gap-1.5 text-xs text-primary font-medium mt-1">
                    <Mail className="size-3 shrink-0" />
                    {client.email || "Sin correo"}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                    <MessageCircle className="size-3 shrink-0" />
                    {client.phone || "Sin teléfono"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Cliente no encontrado</p>
              )}
            </div>

            {clientLockedCc.length > 0 ? (
              <LockedCcList emails={clientLockedCc} />
            ) : null}

            <CcEmailField
              label="Agregar copia en este envío"
              emails={clientExtraCc}
              onChange={setClientExtraCc}
              placeholder="Supervisor u otro correo…"
            />

            {q.clientSentAt && (
              <div className="flex items-center gap-2 rounded-lg border border-fin-gain/25 bg-fin-gain/10 px-3 py-2 text-xs font-semibold text-fin-gain">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Enviado el {q.clientSentAt}
              </div>
            )}

            <button
              type="button"
              onClick={onSendEmailClient}
              disabled={pdfBusy || !client?.email}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mail className="size-4" />
              {pdfBusy ? "Enviando…" : "Enviar por correo"}
            </button>
            <button
              type="button"
              onClick={onShareClient}
              disabled={pdfBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="size-4" />
              {pdfBusy ? "Generando PDF…" : "Compartir PDF"}
            </button>
            <button
              type="button"
              onClick={onDownloadClient}
              disabled={pdfBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="size-4" />
              {pdfBusy ? "Generando PDF…" : "Descargar PDF"}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-3.5 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Proveedores</p>
              <p className="text-[11px] text-muted-foreground">
                Solicitud de materiales (sin costos)
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Proveedor
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={inputCls}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {supplier && (
              <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Para
                </p>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {supplier.contact}
                </p>
                <p className="text-xs text-muted-foreground mb-1.5">{supplier.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Mail className="size-3 shrink-0" />
                  {supplier.email || "Sin correo"}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                  <MessageCircle className="size-3 shrink-0" />
                  {waNumber || "Sin WhatsApp"}
                </p>
              </div>
            )}

            {supplierLockedCc.length > 0 ? (
              <LockedCcList emails={supplierLockedCc} />
            ) : null}

            <CcEmailField
              label="Agregar copia en este envío"
              emails={supplierExtraCc}
              onChange={setSupplierExtraCc}
              placeholder="Otro correo…"
            />

            {q.supplierSentAt && (
              <div className="flex items-center gap-2 rounded-lg border border-fin-gain/25 bg-fin-gain/10 px-3 py-2 text-xs font-semibold text-fin-gain">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Enviado el {q.supplierSentAt}
              </div>
            )}

            <button
              type="button"
              onClick={onSendEmailSupplier}
              disabled={!supplierId || pdfBusy || !supplier?.email}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mail className="size-4" />
              {pdfBusy ? "Enviando…" : "Enviar por correo"}
            </button>
            <button
              type="button"
              onClick={onShareSupplier}
              disabled={!supplierId || pdfBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Share2 className="size-4" />
              {pdfBusy ? "Generando PDF…" : "Compartir PDF"}
            </button>
            <button
              type="button"
              onClick={onDownloadSupplier}
              disabled={!supplierId || pdfBusy}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="size-4" />
              {pdfBusy ? "Generando PDF…" : "Descargar PDF"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta cotización aún no está lista para despacho.
        </p>
      )}
    </div>
  )
}

function LockedCcList({ emails }: { emails: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        CC automático
      </p>
      <div className="flex flex-wrap gap-1.5">
        {emails.map((email) => (
          <span
            key={email}
            className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {email}
          </span>
        ))}
      </div>
    </div>
  )
}

function PercentField({
  label,
  rate,
  onRateChange,
  step,
  hint,
}: {
  label: string
  rate: number
  onRateChange: (rate: number) => void
  step: number
  hint?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? formatPercentLabel(rate)

  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative mt-1">
        <input
          type="number"
          min={0}
          step={step}
          inputMode="decimal"
          value={display}
          onFocus={() => setDraft(formatPercentLabel(rate))}
          onChange={(e) => {
            const raw = e.target.value
            setDraft(raw)
            if (raw === "" || raw === "." || raw === ",") return
            const n = Number(raw.replace(",", "."))
            if (!Number.isNaN(n) && n >= 0) onRateChange(n / 100)
          }}
          onBlur={() => {
            if (draft === "" || draft === "." || draft === ",") {
              onRateChange(0)
            } else {
              const n = Number(String(draft).replace(",", "."))
              if (!Number.isNaN(n) && n >= 0) onRateChange(n / 100)
            }
            setDraft(null)
          }}
          className={`${inputCls} font-mono pr-9`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
          %
        </span>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </label>
  )
}

function PublicItemsEditor({
  items,
  setItems,
  terms,
  setTerms,
  taxRate,
  setTaxRate,
  isrRetentionRate,
  setIsrRetentionRate,
  clientTotals,
  locked,
  onSave,
}: {
  items: PublicQuoteItem[]
  setItems: Dispatch<SetStateAction<PublicQuoteItem[]>>
  terms: string
  setTerms: (v: string) => void
  taxRate: number
  setTaxRate: (v: number) => void
  isrRetentionRate: number
  setIsrRetentionRate: (v: number) => void
  clientTotals: ReturnType<typeof publicQuoteTotals>
  locked?: boolean
  onSave: () => void
}) {
  const [openDesc, setOpenDesc] = useState<Record<string, boolean>>({})

  function updateItem(id: string, patch: Partial<PublicQuoteItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    setOpenDesc((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function onImage(id: string, file: File | null) {
    if (!file) {
      updateItem(id, { imageUrl: undefined })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") updateItem(id, { imageUrl: reader.result })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="pt-3">
      {locked && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" />
          Cotización aprobada: ítems bloqueados. Pásala a En revisión para actualizar.
        </div>
      )}
      <div className="mb-1">
        <p className="text-xs text-muted-foreground max-w-md">
          En el PDF solo se ven nombre y totales. Los costos y fórmulas quedan solo para uso interno.
          Usa “Al ítem 1 del cliente” desde economía interna o “Agregar a ítems de cliente” en cada
          línea.
        </p>
      </div>

      <div className="flex flex-col gap-3 mt-4">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay ítems públicos. Usa economía interna o las líneas internas para agregarlos.
          </div>
        )}

        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-background/40 p-3.5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ítem {index + 1}
              </p>
              {!locked && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Quitar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-[88px_1fr_140px] gap-2">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cant.
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={item.quantity || ""}
                  disabled={locked}
                  onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                  className={`${inputCls} mt-1 font-mono disabled:opacity-60`}
                />
              </label>
              <label className="block col-span-2 sm:col-span-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Título
                </span>
                <input
                  value={item.title}
                  disabled={locked}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  placeholder="FABRICACIÓN DE…"
                  className={`${inputCls} mt-1 disabled:opacity-60`}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  P. unitario
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitPrice || ""}
                  disabled={locked}
                  onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                  className={`${inputCls} mt-1 font-mono disabled:opacity-60`}
                />
              </label>
            </div>

            {openDesc[item.id] || !!item.description.trim() ? (
              <label className="block">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Descripción
                  </span>
                  {!item.description.trim() && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDesc((prev) => ({ ...prev, [item.id]: false }))
                      }
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                <textarea
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  rows={4}
                  autoFocus={!!openDesc[item.id] && !item.description.trim()}
                  className={`${inputCls} resize-y`}
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setOpenDesc((prev) => ({ ...prev, [item.id]: true }))}
                className="self-start text-xs font-semibold text-primary hover:underline"
              >
                Agregar descripción
              </button>
            )}

            {item.imageUrl ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary cursor-pointer hover:underline">
                    <ImagePlus className="size-3.5" />
                    Cambiar imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onImage(item.id, e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { imageUrl: undefined })}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Quitar imagen
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-12 w-16 object-cover rounded-md border border-border"
                />
              </div>
            ) : (
              <label className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-primary cursor-pointer hover:underline">
                <ImagePlus className="size-3.5" />
                Agregar imagen de referencia
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onImage(item.id, e.target.files?.[0] ?? null)}
                />
              </label>
            )}

            <p className="text-xs font-mono text-muted-foreground text-right">
              Total: {currencyMxn(lineTotalMxn(item.quantity, item.unitPrice))}
            </p>
          </div>
        ))}
      </div>

      {!locked && (
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <PercentField
            label="IVA"
            rate={taxRate}
            onRateChange={setTaxRate}
            step={1}
            hint="Default 8% (frontera). Interior del país: cambiar a 16%."
          />
          <PercentField
            label="Retención ISR"
            rate={isrRetentionRate}
            onRateChange={setIsrRetentionRate}
            step={0.25}
            hint="Default 1.25%. Se resta del total (retención)."
          />
        </div>
      )}

      <label className="block mt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Condiciones
        </span>
        <textarea
          value={terms}
          disabled={locked}
          onChange={(e) => setTerms(e.target.value)}
          rows={4}
          className={`${inputCls} mt-1 resize-y disabled:opacity-60`}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            Subtotal: <span className="font-mono text-foreground">{currencyMxn(clientTotals.subtotal)}</span>
          </p>
          <p>
            TOTAL MXN:{" "}
            <span className="font-mono font-bold text-primary">{currencyMxn(clientTotals.total)}</span>
          </p>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
          >
            Guardar ítems
          </button>
        )}
      </div>
    </div>
  )
}

function LinesTable({
  title,
  badge,
  lines,
  catalog,
  kind,
  prices,
  setPrices,
  quantities,
  setQuantities,
  editable,
  qtyEditable,
  showCosts,
  labor,
  embedded,
  onAddToClient,
  onRemoveLine,
  onAddCatalogItem,
}: {
  title: string
  badge?: string
  lines: QuoteLine[]
  catalog: ReturnType<typeof useTechnik>["catalog"]
  kind: "material" | "labor" | "extra"
  prices: Record<string, number>
  setPrices: Dispatch<SetStateAction<Record<string, number>>>
  quantities: Record<string, number>
  setQuantities: Dispatch<SetStateAction<Record<string, number>>>
  editable: boolean
  qtyEditable: boolean
  showCosts: boolean
  labor?: boolean
  embedded?: boolean
  onAddToClient?: (line: QuoteLine) => void
  onRemoveLine?: (itemId: string) => void
  onAddCatalogItem?: (item: CatalogItem) => void
}) {
  const [pickId, setPickId] = useState("")
  const [catalogQuery, setCatalogQuery] = useState("")
  const [lineQuery, setLineQuery] = useState("")
  const available = catalog.filter(
    (c) => c.kind === kind && !lines.some((l) => l.itemId === c.id),
  )
  const availableFiltered = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    if (!q) return available
    return available.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.sku ?? "").toLowerCase().includes(q),
    )
  }, [available, catalogQuery])

  const visibleLines = useMemo(() => {
    const q = lineQuery.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((line) => {
      const item = catalog.find((c) => c.id === line.itemId)
      if (!item) return false
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.sku ?? "").toLowerCase().includes(q)
      )
    })
  }, [lines, lineQuery, catalog])

  const table = (
    <div className="overflow-x-auto -mx-1">
      {!embedded && (
        <div className="flex items-center justify-between mb-4 gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-foreground font-display">{title}</h2>
            {badge && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          {(editable || qtyEditable) && showCosts && (
            <span className="text-[11px] text-primary font-semibold shrink-0">Editable</span>
          )}
        </div>
      )}

      {lines.length > 0 && (
        <SearchField
          value={lineQuery}
          onChange={setLineQuery}
          placeholder={
              labor
                ? "Buscar en mano de obra…"
                : kind === "extra"
                  ? "Buscar en extras…"
                  : "Buscar en materiales…"
            }
          className="mb-3 py-1.5 mx-1"
        />
      )}

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground mb-3">
          Sin {labor ? "mano de obra" : kind === "extra" ? "extras" : "materiales"} en esta
          cotización.
        </div>
      ) : visibleLines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground mb-3">
          Ningún artículo coincide con la búsqueda.
        </div>
      ) : (
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-1 py-2.5 font-semibold">Artículo</th>
              <th className="px-2 py-2.5 font-semibold text-right">{labor ? "Horas" : "Cant."}</th>
              {showCosts && (
                <>
                  <th className="px-2 py-2.5 font-semibold text-right">Costo</th>
                  <th className="px-2 py-2.5 font-semibold text-right">Precio público</th>
                  <th className="px-1 py-2.5 font-semibold text-right">Total</th>
                </>
              )}
              {onRemoveLine && <th className="px-1 py-2.5 font-semibold text-right w-10" />}
            </tr>
          </thead>
          <tbody>
            {visibleLines.map((line) => {
              const item = catalog.find((c) => c.id === line.itemId)
              if (!item) return null
              const price = prices[line.itemId] ?? 0
              const qty = quantities[line.itemId] ?? line.quantity
              return (
                <tr key={line.itemId} className="border-b border-border/60">
                  <td className="px-1 py-3">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {item.id}
                      {item.sku ? ` · ${item.sku}` : ""}
                    </p>
                    {onAddToClient && (
                      <button
                        type="button"
                        onClick={() => onAddToClient({ ...line, quantity: qty })}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <Plus className="size-3" />
                        Agregar a ítems de cliente
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {qtyEditable ? (
                      <input
                        type="number"
                        min={0}
                        step={labor ? 0.5 : 1}
                        value={qty || ""}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [line.itemId]: Number(e.target.value),
                          }))
                        }
                        className="w-20 rounded-lg bg-input/60 border border-border py-1.5 px-2 text-right text-sm font-mono outline-none focus:border-primary/60"
                      />
                    ) : (
                      <span className="font-mono text-foreground">{qty}</span>
                    )}
                  </td>
                  {showCosts && (
                    <>
                      <td className="px-2 py-3 text-right font-mono text-muted-foreground">
                        {currencyPrecise(item.unitCost)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={price || ""}
                            onChange={(e) =>
                              setPrices((p) => ({ ...p, [line.itemId]: Number(e.target.value) }))
                            }
                            className="w-24 rounded-lg bg-input/60 border border-border py-1.5 px-2 text-right text-sm font-mono outline-none focus:border-primary/60"
                          />
                        ) : (
                          <span className="font-mono">{currencyPrecise(price)}</span>
                        )}
                      </td>
                      <td className="px-1 py-3 text-right font-mono font-semibold">
                        {currency(price * qty)}
                      </td>
                    </>
                  )}
                  {onRemoveLine && (
                    <td className="px-1 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onRemoveLine(line.itemId)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Quitar ${item.name}`}
                        title="Quitar de la lista"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {onAddCatalogItem && (
        <div className="mt-3 flex flex-col gap-2 px-1">
          <SearchField
            value={catalogQuery}
            onChange={setCatalogQuery}
            placeholder={
              labor
                ? "Buscar trabajo o código…"
                : kind === "extra"
                  ? "Buscar extra, flete o viático…"
                  : "Buscar material, SKU o código…"
            }
            className="py-1.5"
          />
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Agregar del catálogo
              </span>
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                className={`${inputCls} mt-1 py-1.5 text-xs`}
                disabled={availableFiltered.length === 0}
              >
                <option value="">
                  {available.length === 0
                    ? labor
                      ? "No hay más trabajos en catálogo"
                      : kind === "extra"
                        ? "No hay más extras en catálogo"
                        : "No hay más materiales en catálogo"
                    : availableFiltered.length === 0
                      ? "Sin coincidencias"
                      : labor
                        ? "Elegir mano de obra…"
                        : kind === "extra"
                          ? "Elegir extra…"
                          : "Elegir material…"}
                </option>
                {availableFiltered.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!pickId}
              onClick={() => {
                const item = catalog.find((c) => c.id === pickId)
                if (!item) return
                onAddCatalogItem(item)
                setPickId("")
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Plus className="size-3.5" />
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (embedded) return <div className="pt-3">{table}</div>
  return <div className="rounded-2xl surface-card p-5 lg:p-6">{table}</div>
}


function Detail({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: ElementType
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className={`text-foreground font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  )
}
