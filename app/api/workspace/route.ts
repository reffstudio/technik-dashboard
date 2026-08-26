import { NextResponse } from "next/server"
import type { LiveEnvelope, WorkspaceSnapshot } from "@/lib/technik/live"
import { isSupabaseConfigured } from "@/lib/supabase/public-env"
import { requireStaff } from "@/lib/api/require-staff"
import {
  noticeOnlySnapshot,
  readWorkspaceHub,
  resetWorkspaceHub,
  writeWorkspaceHub,
} from "@/lib/technik/workspace-hub"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET — hub local (mock) o solo avisos si Supabase es la fuente de verdad. */
export async function GET(req: Request) {
  const auth = await requireStaff(req)
  if (!auth.ok) return auth.response
  const snapshot = isSupabaseConfigured() ? noticeOnlySnapshot() : readWorkspaceHub()
  return NextResponse.json({ ok: true, snapshot })
}

type PutBody = {
  snapshot: WorkspaceSnapshot
  originId: string
  actorName?: string
  message?: string
  audience?: LiveEnvelope["audience"]
  reset?: boolean
}

/** PUT — push de avisos (Supabase) o workspace mock (sin DB). */
export async function PUT(req: Request) {
  const auth = await requireStaff(req)
  if (!auth.ok) return auth.response

  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  if (body.reset) {
    if (auth.actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Solo administración puede reiniciar." }, { status: 403 })
    }
    const snapshot = resetWorkspaceHub()
    return NextResponse.json({ ok: true, snapshot })
  }

  if (!body.originId) {
    return NextResponse.json({ ok: false, error: "Falta originId" }, { status: 400 })
  }

  if (isSupabaseConfigured()) {
    const current = noticeOnlySnapshot()
    const { envelope } = writeWorkspaceHub({
      snapshot: current,
      originId: body.originId,
      actorName: body.actorName ?? auth.actor.name,
      message: body.message,
      audience: body.audience,
    })
    const snapshot = noticeOnlySnapshot()
    return NextResponse.json({
      ok: true,
      snapshot,
      envelope: { ...envelope, snapshot },
    })
  }

  if (!body.snapshot) {
    return NextResponse.json({ ok: false, error: "Falta snapshot" }, { status: 400 })
  }

  const { snapshot, envelope } = writeWorkspaceHub({
    snapshot: body.snapshot,
    originId: body.originId,
    actorName: body.actorName ?? auth.actor.name,
    message: body.message,
    audience: body.audience,
  })

  return NextResponse.json({ ok: true, snapshot, envelope })
}
