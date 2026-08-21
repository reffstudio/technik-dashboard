"use client"

import { useState, type FormEvent } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowRight, Lock, Mail, KeyRound, ChevronLeft } from "lucide-react"
import { useTechnik } from "@/lib/technik/store"
import { BrandLogo } from "./brand-logo"

const EASE = [0.16, 1, 0.3, 1] as const

export function LoginScreen() {
  const { login, requestPasswordReset } = useTechnik()
  const [mode, setMode] = useState<"login" | "recover">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [recoverSent, setRecoverSent] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const res = await login(email, password)
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
            Dashboard de Cotizaciones y Operaciones
          </p>
        </div>

        <div className="rounded-2xl surface-elevated p-7 glow-teal-sm">
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
              >
                <form onSubmit={(e) => void handleLogin(e)} className="flex flex-col gap-3.5">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Correo electrónico
                    </span>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 focus-within:border-primary/60 transition-colors">
                      <Mail className="size-4 text-muted-foreground shrink-0" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@technik.solutions"
                        required
                        autoComplete="email"
                        className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Contraseña
                    </span>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 focus-within:border-primary/60 transition-colors">
                      <Lock className="size-4 text-muted-foreground shrink-0" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
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
                    type="button"
                    onClick={() => {
                      setMode("recover")
                      setRecoverSent(false)
                      setError("")
                    }}
                    className="text-left text-xs text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-1 group flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {busy ? "Entrando…" : "Iniciar sesión"}
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="recover"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                  <ChevronLeft className="size-4" />
                  Volver
                </button>
                <div className="flex items-center gap-3 mb-5 rounded-xl bg-primary/[0.06] border border-primary/15 p-3.5">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
                    <KeyRound className="size-5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Recuperar acceso</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Te enviaremos un enlace de restablecimiento.
                    </p>
                  </div>
                </div>

                {recoverSent ? (
                  <div className="rounded-xl border border-fin-gain/25 bg-fin-gain/10 p-4 text-sm text-fin-gain">
                    Si el correo existe, enviamos instrucciones a{" "}
                    <span className="font-semibold">{email}</span>.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      setBusy(true)
                      setError("")
                      void requestPasswordReset(email).then((res) => {
                        setBusy(false)
                        if (!res.ok) setError(res.error)
                        else setRecoverSent(true)
                      })
                    }}
                    className="flex flex-col gap-3.5"
                  >
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Correo registrado
                      </span>
                      <div className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-input/60 border border-border px-3.5 focus-within:border-primary/60 transition-colors">
                        <Mail className="size-4 text-muted-foreground shrink-0" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="tu@technik.solutions"
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
                      disabled={busy}
                      className="rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {busy ? "Enviando…" : "Enviar enlace"}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
