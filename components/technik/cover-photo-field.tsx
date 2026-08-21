"use client"

import React from "react"
import { ImagePlus, Trash2 } from "lucide-react"

export function CoverPhotoField({
  imageUrl,
  onChange,
  disabled,
  label = "Foto de portada",
  hint,
}: {
  imageUrl?: string
  onChange: (dataUrl: string | undefined) => void
  disabled?: boolean
  label?: string
  hint?: string
}) {
  function onFile(file: File | null) {
    if (!file) {
      onChange(undefined)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-36 w-full object-cover sm:h-44" />
          {!disabled && (
            <div className="flex gap-2 border-t border-border bg-card p-2">
              <label className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground cursor-pointer hover:bg-accent hover:border-primary/40 transition-colors">
                <ImagePlus className="size-3.5 text-primary" />
                Cambiar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/25 bg-background px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="size-3.5" />
                Quitar
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center ${
            disabled ? "opacity-50" : "cursor-pointer hover:border-primary/40 hover:bg-accent/30"
          }`}
        >
          <ImagePlus className="size-5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Agregar foto</span>
          <span className="text-[11px] text-muted-foreground">Se ve en el preview y en proyectos</span>
          {!disabled && (
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          )}
        </label>
      )}
    </div>
  )
}
