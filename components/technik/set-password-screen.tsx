"use client"

import React, { useEffect, useState } from "react"
import { motion } from "motion/react"
import { ArrowRight, Lock } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase/browser"
import { useTechnik } from "@/lib/technik/store"
import { BrandLogo } from "./brand-logo"

const EASE = [0.16, 1, 0.3, 1] as const

export function SetPasswordScreen() {
  const { completePasswordSetup } = useTechnik()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setSessionReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSessionReady(true)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setBusy(true)
    setError("")
    const res = await completePasswordSetup(password)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 100%)",
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <BrandLogo height={44} priority className="mb-4" />
          <p className="text-xs tracking-[0.35em] uppercase text-muted-foreground font-mono">
            Crear contraseña
          </p>
        </div>

        <div className="rounded-2xl surface-elevated p-7 glow-teal-sm">
          <p className="text-sm text-muted-foreground mb-5">
            {sessionReady
              ? "Antes de entrar al dashboard, elige una contraseña para tu cuenta."
              : "Confirmando la invitación…"}
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3.5">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nueva contraseña
              </span>
              <div className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 focus-within:border-primary/60 transition-colors">
                <Lock className="size-4 text-muted-foreground shrink-0" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Confirmar contraseña
              </span>
              <div className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 focus-within:border-primary/60 transition-colors">
                <Lock className="size-4 text-muted-foreground shrink-0" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
            </label>
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !sessionReady}
              className="mt-1 group flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar y entrar"}
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
