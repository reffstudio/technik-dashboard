"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Flag,
  Hourglass,
  PlayCircle,
} from "lucide-react"
import {
  PROJECT_STAGE_META,
  type ProjectStage,
} from "@/lib/technik/data"

const TRACK_STEPS: Exclude<ProjectStage, "atrasado">[] = [
  "procesando_solicitud",
  "listo_para_iniciar",
  "en_proceso",
  "completado",
]

const STEP_ICON = {
  procesando_solicitud: Hourglass,
  listo_para_iniciar: Flag,
  en_proceso: PlayCircle,
  completado: CheckCircle2,
} as const

const STEP_TONE: Record<(typeof TRACK_STEPS)[number], { fill: string; glow: string; text: string }> = {
  procesando_solicitud: {
    fill: "bg-chart-3",
    glow: "shadow-[0_0_0_4px_color-mix(in_oklab,var(--chart-3)_28%,transparent)]",
    text: "text-chart-3",
  },
  listo_para_iniciar: {
    fill: "bg-chart-2",
    glow: "shadow-[0_0_0_4px_color-mix(in_oklab,var(--chart-2)_28%,transparent)]",
    text: "text-chart-2",
  },
  en_proceso: {
    fill: "bg-primary",
    glow: "shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_32%,transparent)]",
    text: "text-primary",
  },
  completado: {
    fill: "bg-fin-gain",
    glow: "shadow-[0_0_0_4px_color-mix(in_oklab,var(--fin-gain)_32%,transparent)]",
    text: "text-fin-gain",
  },
}

const LATE_TONE = {
  fill: "bg-destructive",
  glow: "shadow-[0_0_0_4px_color-mix(in_oklab,var(--destructive)_30%,transparent)]",
  text: "text-destructive",
}

const SPRING = { type: "spring" as const, stiffness: 380, damping: 28 }

function visualStep(stage: ProjectStage): (typeof TRACK_STEPS)[number] {
  return stage === "atrasado" ? "en_proceso" : stage
}

export function WorkshopStageTrack({
  stage,
  disabled,
  onChange,
}: {
  stage: ProjectStage
  disabled?: boolean
  onChange: (stage: ProjectStage) => void
}) {
  const late = stage === "atrasado"
  const current = visualStep(stage)
  const currentIndex = TRACK_STEPS.indexOf(current)
  const complete = current === "completado"
  const currentMeta = late ? PROJECT_STAGE_META.atrasado : PROJECT_STAGE_META[current]
  const currentTone = late ? LATE_TONE : STEP_TONE[current]

  const [flash, setFlash] = useState(false)
  const prevStage = useRef(stage)

  useEffect(() => {
    const was = prevStage.current
    prevStage.current = stage
    if (stage === "completado" && was !== "completado") {
      setFlash(true)
      const t = window.setTimeout(() => setFlash(false), 900)
      return () => window.clearTimeout(t)
    }
  }, [stage])

  return (
    <div className="relative">
      <p className={`text-xs font-bold tracking-tight ${currentTone.text}`}>
        {late
          ? currentMeta.label
          : `Paso ${currentIndex + 1} de ${TRACK_STEPS.length} · ${currentMeta.label}`}
      </p>

      <ol className="relative mt-4">
        {TRACK_STEPS.map((step, index) => {
          const done = index < currentIndex || complete
          const active = index === currentIndex
          const selected = !late && stage === step
          const lateHere = late && step === "en_proceso"
          const tone = lateHere ? LATE_TONE : STEP_TONE[step]
          const Icon = lateHere ? AlertTriangle : STEP_ICON[step]
          const last = index === TRACK_STEPS.length - 1
          const segmentOn = index < currentIndex

          return (
            <li key={step} className="relative">
              <button
                type="button"
                disabled={disabled}
                aria-current={active ? "step" : undefined}
                onClick={() => {
                  if (disabled || selected) return
                  onChange(step)
                }}
                className={`flex w-full items-center gap-3 rounded-xl py-1.5 text-left transition-colors disabled:opacity-100 ${
                  disabled || selected
                    ? "cursor-default"
                    : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                <motion.span
                  key={`${step}-${active}-${lateHere}`}
                  initial={false}
                  animate={{
                    scale: active ? 1.08 : 1,
                  }}
                  transition={SPRING}
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    done || active
                      ? `${tone.fill} border-transparent ${lateHere ? "text-destructive-foreground" : "text-primary-foreground"} ${active ? tone.glow : ""}`
                      : "border-border bg-background text-muted-foreground"
                  } ${lateHere ? "animate-pulse" : ""}`}
                >
                  {done && !active ? (
                    <Check className="size-3.5" strokeWidth={2.6} />
                  ) : (
                    <Icon className="size-3.5" strokeWidth={2.2} />
                  )}
                </motion.span>

                <span className="min-w-0">
                  <span
                    className={`block text-[13px] font-semibold leading-tight ${
                      active
                        ? "text-foreground"
                        : done
                          ? "text-foreground/80"
                          : "text-muted-foreground"
                    }`}
                  >
                    {PROJECT_STAGE_META[step].label}
                  </span>
                  {lateHere && (
                    <span className="mt-0.5 block text-[11px] font-semibold text-destructive">
                      Entrega o avance fuera de tiempo
                    </span>
                  )}
                </span>
              </button>

              {!last && (
                <div
                  className="ml-[15px] h-7 w-0.5 overflow-hidden rounded-full bg-border"
                  aria-hidden
                >
                  <motion.div
                    className={`h-full w-full origin-top ${currentTone.fill}`}
                    initial={false}
                    animate={{ scaleY: segmentOn ? 1 : 0 }}
                    transition={SPRING}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {!disabled && !complete && (
        <button
          type="button"
          onClick={() => onChange(late ? "en_proceso" : "atrasado")}
          className={`mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold ${
            late
              ? "text-muted-foreground hover:text-foreground"
              : "text-destructive hover:text-destructive/80"
          }`}
        >
          <AlertTriangle className="size-3.5" />
          {late ? "Quitar retraso" : "Marcar retraso"}
        </button>
      )}

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl bg-fin-gain/20"
        initial={false}
        animate={{ opacity: flash ? 1 : 0 }}
        transition={{ duration: 0.35 }}
      />
    </div>
  )
}
