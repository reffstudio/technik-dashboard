"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ImagePlus, Trash2, X, Loader2, FileText } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import { visitPhotosOf, VISIT_PHOTO_MAX } from "@/lib/technik/visit-photos"
import { authHeaders } from "@/lib/supabase/session-token"
import type { VisitPhoto } from "@/lib/technik/data"

function photoIsOnQuote(photo: VisitPhoto, quotePhotoUrl?: string) {
  if (!quotePhotoUrl) return false
  return (
    quotePhotoUrl === photo.url ||
    quotePhotoUrl === photo.thumbUrl ||
    quotePhotoUrl.includes(photo.id)
  )
}

function mergePhotoLists(local: VisitPhoto[] | undefined, remote: VisitPhoto[]) {
  const map = new Map<string, VisitPhoto>()
  for (const p of local ?? []) map.set(p.id, p)
  for (const p of remote) map.set(p.id, p)
  return visitPhotosOf(Array.from(map.values()))
}

export function VisitPhotosSection({
  quotationId,
  photos,
  canEdit,
  compact = false,
  onNeedDraft,
  quotePhotoUrl,
  onToggleQuotePhoto,
  quotePhotoLocked = false,
}: {
  quotationId?: string
  photos: VisitPhoto[] | undefined
  canEdit: boolean
  compact?: boolean
  /** Si aún no hay folio, el builder crea el borrador y devuelve el id. */
  onNeedDraft?: () => string | Promise<string | null | undefined>
  /** URL de la foto que el admin eligió para el PDF. */
  quotePhotoUrl?: string
  onToggleQuotePhoto?: (photo: VisitPhoto | null) => void
  quotePhotoLocked?: boolean
}) {
  const { uploadVisitPhotos, removeVisitPhoto, hydrateVisitPhotos } = useTechnik()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<VisitPhoto | null>(null)
  const [remote, setRemote] = useState<VisitPhoto[]>([])

  useEffect(() => {
    if (!quotationId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/quotes/${encodeURIComponent(quotationId)}/photos`, {
          headers: await authHeaders(),
        })
        const data = (await res.json()) as { ok?: boolean; photos?: VisitPhoto[] }
        if (!cancelled && data.ok && Array.isArray(data.photos)) {
          setRemote(data.photos)
          hydrateVisitPhotos(quotationId, data.photos)
        }
      } catch {
        /* el poll del workspace puede traerlas después */
      }
    }
    void load()
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    const tick = window.setInterval(() => void load(), 4000)
    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
      window.clearInterval(tick)
    }
  }, [quotationId])

  const list = mergePhotoLists(photos, remote)
  const remaining = VISIT_PHOTO_MAX - list.length

  async function resolveId(): Promise<string | null> {
    if (quotationId) return quotationId
    if (!onNeedDraft) return null
    const id = await onNeedDraft()
    return id ?? null
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length || !canEdit || busy) return
    setError(null)
    const id = await resolveId()
    if (!id) {
      setError("Completa cliente y título para guardar las fotos en la cotización.")
      return
    }
    setBusy(true)
    const result = await uploadVisitPhotos(id, Array.from(fileList))
    setBusy(false)
    if (!result.ok) setError(result.error)
    if (cameraRef.current) cameraRef.current.value = ""
    if (galleryRef.current) galleryRef.current.value = ""
  }

  async function onRemove(photo: VisitPhoto) {
    if (!canEdit || busy) return
    setBusy(true)
    const result = await removeVisitPhoto(photo.quotationId, photo.id)
    setBusy(false)
    if (!result.ok) setError(result.error)
    else if (quotePhotoUrl && photoIsOnQuote(photo, quotePhotoUrl)) {
      onToggleQuotePhoto?.(null)
    }
    if (viewer?.id === photo.id) setViewer(null)
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-border/80 bg-muted/20 p-4"}>
      {canEdit && (
        <div className="flex items-start justify-between gap-3 mb-3">
          {!compact && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Camera className="size-3.5 text-primary" />
                Fotos de visita
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Contexto del sitio para administración. Se comprimen solas
                {list.length > 0 ? ` · ${list.length}/${VISIT_PHOTO_MAX}` : ` · hasta ${VISIT_PHOTO_MAX}`}.
              </p>
            </div>
          )}
          <div className={`flex shrink-0 gap-1.5 ${compact ? "w-full justify-end" : ""}`}>
            <button
              type="button"
              disabled={busy || remaining <= 0}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              Cámara
            </button>
            <button
              type="button"
              disabled={busy || remaining <= 0}
              onClick={() => galleryRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-accent disabled:opacity-40"
            >
              <ImagePlus className="size-3.5" />
              Galería
            </button>
          </div>
        </div>
      )}
      {!canEdit && !compact && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Camera className="size-3.5 text-primary" />
            Fotos de visita
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {list.length > 0
              ? `${list.length} foto${list.length === 1 ? "" : "s"} del colaborador`
              : "El colaborador aún no subió fotos"}
          </p>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />

      {error && <p className="text-[11px] text-destructive mb-2">{error}</p>}

      {onToggleQuotePhoto && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Elige si alguna foto va al PDF al cliente. Se muestra pequeña debajo de los ítems.
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "Toma o adjunta fotos del lugar, medidas o condiciones."
            : "El colaborador aún no subió fotos de la visita."}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {list.map((photo) => {
            const onQuote = photoIsOnQuote(photo, quotePhotoUrl)
            return (
            <div key={photo.id} className="relative group">
              <button
                type="button"
                onClick={() => setViewer(photo)}
                className={`block w-full aspect-square overflow-hidden rounded-xl border bg-neutral-200 ${
                  onQuote ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl}
                  alt={photo.caption || "Foto de visita"}
                  className="w-full h-full object-cover"
                />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void onRemove(photo)}
                  className="absolute top-1 right-1 rounded-full bg-neutral-950/70 p-1 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Eliminar foto"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
              {onToggleQuotePhoto && (
                <button
                  type="button"
                  disabled={quotePhotoLocked}
                  onClick={() => onToggleQuotePhoto(onQuote ? null : photo)}
                  className={`mt-1 w-full inline-flex items-center justify-center gap-1 rounded-lg border px-1 py-1 text-[10px] font-semibold leading-tight disabled:opacity-40 ${
                    onQuote
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  <FileText className="size-3 shrink-0" />
                  {onQuote ? "En la cotización" : "Agregar foto a cotización"}
                </button>
              )}
            </div>
            )
          })}
        </div>
      )}

      {viewer && (
        <div
          className="fixed inset-0 z-[80] bg-neutral-950/85 backdrop-blur-sm flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Foto de visita"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-xs text-white/80 truncate">
              {viewer.uploadedBy} · {viewer.takenAt.slice(0, 10)} · {Math.round(viewer.bytes / 1024)} KB
            </p>
            <button
              type="button"
              onClick={() => setViewer(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <X className="size-3.5" />
              Cerrar
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewer.url}
              alt={viewer.caption || "Foto de visita"}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
