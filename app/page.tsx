import { readSupabasePublicEnv } from "@/lib/supabase/public-env"
import { TechnikApp } from "@/components/technik/technik-app"

export const dynamic = "force-dynamic"

export default function Home() {
  return <TechnikApp supabase={readSupabasePublicEnv()} />
}
