"use client"

import { TechnikProvider, useTechnik } from "@/lib/technik/store"
import { LoginScreen } from "./login-screen"
import { AppShell } from "./app-shell"

function Gate() {
  const { authed, authReady } = useTechnik()
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    )
  }
  return authed ? <AppShell /> : <LoginScreen />
}

export function TechnikApp() {
  return (
    <TechnikProvider>
      <Gate />
    </TechnikProvider>
  )
}
