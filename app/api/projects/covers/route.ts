import { NextResponse } from "next/server"
import { requireStaff } from "@/lib/api/require-staff"
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { signedProjectCoverMap } from "@/lib/technik/project-covers-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

void process.env.SUPABASE_SERVICE_ROLE_KEY
void process.env.SUPABASE_SECRET_KEY

export async function GET(req: Request) {
  const auth = await requireStaff(req)
  if (!auth.ok) return auth.response
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Servidor sin service role." }, { status: 503 })
  }
  const covers = await signedProjectCoverMap()
  return NextResponse.json({ ok: true, covers: Object.fromEntries(covers) })
}
