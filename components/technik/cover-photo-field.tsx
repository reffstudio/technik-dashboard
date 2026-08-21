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
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-36 w-full object-cover sm:h-44" />
          {!disabled && (
            <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 bg-gradient-to-t from-black/55 to-transparent">
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-foreground cursor-pointer">
                <ImagePlus className="size-3.5" />
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-destructive"
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
