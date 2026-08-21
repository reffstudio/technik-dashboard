"use client"

import { CloudOff, Loader2 } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"

export function SaveStatusChip() {
  const { saveStatus, saveError, retrySave } = useTechnik()

  if (saveStatus === "idle") return null

  if (saveStatus === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
        <Loader2 className="size-3 animate-spin" />
        Guardando…
      </span>
    )
  }

  if (saveStatus === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
        Guardado
      </span>
    )
  }

  if (saveStatus === "offline") {
    return (
      <button
        type="button"
        onClick={retrySave}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 shrink-0 max-w-[42vw] sm:max-w-none text-left"
        title="Reintentar al volver la conexión"
      >
        <CloudOff className="size-3 shrink-0" />
        <span className="truncate">Sin conexión · se guardará al volver</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={retrySave}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-destructive shrink-0 max-w-[42vw] sm:max-w-none text-left"
      title={saveError || "Reintentar"}
    >
      <span className="truncate">
        No se pudo guardar{saveError ? ` · ${saveError}` : ""}
      </span>
    </button>
  )
}
