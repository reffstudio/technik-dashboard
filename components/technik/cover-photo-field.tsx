"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronUp, ImagePlus, Trash2 } from "lucide-react"

export function CoverPhotoField({
  imageUrl,
  onChange,
  disabled,
  canRemove = true,
  children,
}: {
  imageUrl?: string
  onChange: (dataUrl: string | undefined) => void
  disabled?: boolean
  canRemove?: boolean
  children?: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(ev: MouseEvent) {
      if (!menuRef.current?.contains(ev.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [menuOpen])

  function onFile(file: File | null) {
    setMenuOpen(false)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[1.75rem] min-h-[240px] sm:min-h-[280px]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/25"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[240px] sm:min-h-[280px] flex-col p-5 sm:p-6">
        {children}
      </div>

      {!disabled && (
        <div ref={menuRef} className="absolute bottom-4 right-4 z-20 sm:bottom-5 sm:right-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60"
          >
            Editar imagen
            <ChevronUp className={`size-3.5 transition-transform ${menuOpen ? "" : "rotate-180"}`} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full right-0 mb-2 min-w-[11.5rem] overflow-hidden rounded-xl border border-white/15 bg-zinc-950/95 py-1 shadow-xl backdrop-blur-md"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-white/10"
              >
                <ImagePlus className="size-3.5 text-white/80" />
                Cambiar foto
              </button>
              {canRemove && imageUrl && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onChange(undefined)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-white/90 hover:bg-white/10"
                >
                  <Trash2 className="size-3.5 text-white/70" />
                  Quitar foto
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
