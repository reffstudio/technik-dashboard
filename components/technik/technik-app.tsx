"use client"

import { useEffect, useState } from "react"
import type { SupabasePublicConfig } from "@/lib/supabase/public-env"
import { TechnikProvider, useTechnik } from "@/lib/technik/store"
import { LoginScreen } from "./login-screen"
import { SetPasswordScreen } from "./set-password-screen"
import { AppShell } from "./app-shell"
import { LoadingScreen } from "./loading-screen"

function Gate({ forcePasswordSetup = false }: { forcePasswordSetup?: boolean }) {
  const { authed, authReady, mustSetPassword } = useTechnik()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  if (mustSetPassword) return <SetPasswordScreen />
  if (forcePasswordSetup && !authed && !authReady) return <SetPasswordScreen />
  if (!hydrated) return forcePasswordSetup ? <SetPasswordScreen /> : <LoadingScreen />
  if (!authReady) return <LoadingScreen />
  return authed ? <AppShell /> : <LoginScreen />
}

export function TechnikApp({
  supabase,
  forcePasswordSetup = false,
}: {
  supabase?: SupabasePublicConfig
  forcePasswordSetup?: boolean
}) {
  return (
    <TechnikProvider supabase={supabase}>
      <Gate forcePasswordSetup={forcePasswordSetup} />
    </TechnikProvider>
  )
}
