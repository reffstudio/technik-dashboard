"use client"

import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"

const EASE = [0.16, 1, 0.3, 1] as const

export function LoadingScreen() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--brand-navy)] px-6">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 50% at 50% 45%, #000 28%, transparent 100%)",
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-[var(--brand-cyan)]/15 blur-[140px] pointer-events-none" />

      <div
        role="status"
        aria-live="polite"
        className="relative flex flex-col items-center gap-8"
      >
        <span className="sr-only">Cargando</span>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="relative h-12 w-[148px] sm:h-14 sm:w-[172px]"
        >
          <Image
            src="/brand/technik-logo-dark.png"
            alt="Technik Solutions"
            fill
            priority
            className="object-contain object-center"
            sizes="172px"
          />
        </motion.div>

        <div className="h-[3px] w-40 sm:w-48 overflow-hidden rounded-full bg-white/20">
          {reduceMotion ? (
            <div className="h-full w-2/3 rounded-full bg-white" />
          ) : (
            <motion.div
              className="h-full origin-left rounded-full bg-white"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: [0, 1] }}
              transition={{
                duration: 1.45,
                ease: EASE,
                repeat: Infinity,
                repeatDelay: 0.28,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
