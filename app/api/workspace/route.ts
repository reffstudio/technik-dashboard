import { NextResponse } from "next/server"
import type { LiveEnvelope, WorkspaceSnapshot } from "@/lib/technik/live"
import {
  readWorkspaceHub,
  resetWorkspaceHub,
  writeWorkspaceHub,
} from "@/lib/technik/workspace-hub"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET — snapshot canónico compartido (simula backend multi-usuario). */
export async function GET() {
  const snapshot = readWorkspaceHub()
  return NextResponse.json({ ok: true, snapshot })
}

type PutBody = {
  snapshot: WorkspaceSnapshot
  originId: string
  actorName?: string
  message?: string
  audience?: LiveEnvelope["audience"]
  /** Si true, reinicia a seeds (solo demos). */
  reset?: boolean
}

/** PUT — push de cambios desde una pestaña/cliente. */
export async function PUT(req: Request) {
  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  if (body.reset) {
    const snapshot = resetWorkspaceHub()
    return NextResponse.json({ ok: true, snapshot })
  }

  if (!body.snapshot || !body.originId) {
    return NextResponse.json(
      { ok: false, error: "Faltan snapshot u originId" },
      { status: 400 },
    )
  }

  const { snapshot, envelope } = writeWorkspaceHub({
    snapshot: body.snapshot,
    originId: body.originId,
    actorName: body.actorName,
    message: body.message,
    audience: body.audience,
  })

  return NextResponse.json({ ok: true, snapshot, envelope })
}
