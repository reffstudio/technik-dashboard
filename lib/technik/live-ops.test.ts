import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { Project, ProjectInstallment, VisitPhoto } from "./data"
import { adoptOpsProjects, preferProjectForPersist, applyProjectIntent, projectIntentSettled, resolveProjectStageForPersist } from "./live"
import { resolvedCoverUrl } from "./data"

function inst(partial: Partial<ProjectInstallment> & Pick<ProjectInstallment, "id">): ProjectInstallment {
  return {
    amount: 1000,
    dueDate: "2026-09-15",
    ...partial,
  }
}

function project(partial: Partial<Project> & Pick<Project, "id" | "stage" | "updatedAt">): Project {
  return {
    createdAt: "2026-08-01",
    installments: [],
    history: [],
    ...partial,
  }
}

describe("adoptOpsProjects", () => {
  it("no revierte Completado local (fecha) contra un remoto del mismo día con hora", () => {
    const local = project({
      id: "P-1",
      stage: "completado",
      updatedAt: "2026-09-02",
    })
    const remote = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 08:14",
    })
    const [merged] = adoptOpsProjects([local], [remote])
    assert.equal(merged.stage, "completado")
  })

  it("conserva un cobro local aunque el remoto venga sin paidAt y con updatedAt más nuevo", () => {
    const local = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 15:00",
      installments: [inst({ id: "inst-1", paidAt: "2026-09-02", method: "transferencia" })],
    })
    const remote = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 15:30",
      installments: [inst({ id: "inst-1" })],
    })
    const [merged] = adoptOpsProjects([local], [remote])
    assert.equal(merged.installments[0]?.paidAt, "2026-09-02")
    assert.equal(merged.installments[0]?.method, "transferencia")
  })
})

describe("preferProjectForPersist", () => {
  it("no escribe la etapa vieja si el store aún no re-renderizó", () => {
    const captured = project({
      id: "P-1",
      stage: "completado",
      updatedAt: "2026-09-02 16:01",
    })
    const staleStore = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-01 10:00",
    })
    const toSave = preferProjectForPersist(captured, staleStore)
    assert.equal(toSave.stage, "completado")
  })

  it("no desmarca un cobro capturado aunque el store traiga la cuota sin pagar", () => {
    const captured = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 16:01",
      installments: [inst({ id: "inst-1", paidAt: "2026-09-02", method: "efectivo" })],
    })
    const staleStore = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 08:00",
      installments: [inst({ id: "inst-1" })],
    })
    const toSave = preferProjectForPersist(captured, staleStore)
    assert.equal(toSave.installments[0]?.paidAt, "2026-09-02")
    assert.equal(toSave.installments[0]?.method, "efectivo")
  })

  it("no pierde un cobro ya en el store si el persist solo cambió la etapa", () => {
    const captured = project({
      id: "P-1",
      stage: "completado",
      updatedAt: "2026-09-02 16:02",
      installments: [inst({ id: "inst-1" })],
    })
    const storeWithPaid = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 16:00",
      installments: [inst({ id: "inst-1", paidAt: "2026-09-01", method: "transferencia" })],
    })
    const toSave = preferProjectForPersist(captured, storeWithPaid)
    assert.equal(toSave.stage, "completado")
    assert.equal(toSave.installments[0]?.paidAt, "2026-09-01")
  })
})

describe("project intent + stage persist", () => {
  it("el overlay vuelve a Completado y al cobro si el remoto llega viejo", () => {
    const remote = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 16:10",
      installments: [inst({ id: "inst-1" })],
    })
    const pinned = applyProjectIntent(remote, {
      stage: "completado",
      deliveredAt: "2026-09-02",
      paidByInst: { "inst-1": { paidAt: "2026-09-02", method: "transferencia" } },
    })
    assert.equal(pinned.stage, "completado")
    assert.equal(pinned.installments[0]?.paidAt, "2026-09-02")
    assert.equal(projectIntentSettled(remote, {
      stage: "completado",
      paidByInst: { "inst-1": { paidAt: "2026-09-02" } },
    }), false)
    assert.equal(projectIntentSettled(pinned, {
      stage: "completado",
      paidByInst: { "inst-1": { paidAt: "2026-09-02" } },
    }), true)
  })

  it("un persist viejo no baja Completado ya guardado", () => {
    const incoming = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 10:00",
      history: [{ at: "2026-09-01T10:00:00.000Z", by: "Ana", action: "Etapa → En proceso" }],
    })
    assert.equal(
      resolveProjectStageForPersist(incoming, {
        stage: "completado",
        updatedAt: "2026-09-02 16:00",
      }),
      "completado",
    )
  })

  it("sí deja bajar Completado si el usuario acaba de cambiar la etapa", () => {
    const incoming = project({
      id: "P-1",
      stage: "en_proceso",
      updatedAt: "2026-09-02 16:05",
      history: [{ at: "2026-09-02T16:05:00.000Z", by: "Ana", action: "Etapa → En proceso" }],
    })
    assert.equal(
      resolveProjectStageForPersist(incoming, {
        stage: "completado",
        updatedAt: "2026-09-02 16:00",
      }),
      "en_proceso",
    )
  })
})

describe("resolvedCoverUrl", () => {
  it("conserva la URL firmada si no hay fotos de visita (colaborador)", () => {
    const signed =
      "https://example.supabase.co/storage/v1/object/sign/visit-photos/Q-1/p1.jpg?token=abc"
    assert.equal(resolvedCoverUrl(signed, undefined), signed)
    assert.equal(resolvedCoverUrl("/api/quotes/Q-1/photos/p1", []), "/api/quotes/Q-1/photos/p1")
  })

  it("usa la foto vigente de la cotización si coincide", () => {
    const photo = {
      id: "p1",
      quotationId: "Q-1",
      url: "https://cdn.example/live.jpg",
      thumbUrl: "https://cdn.example/thumb.jpg",
      takenAt: "2026-09-01T00:00:00.000Z",
      uploadedById: "u1",
      uploadedBy: "Ana",
      mime: "image/jpeg",
      bytes: 10,
      thumbBytes: 4,
      width: 10,
      height: 10,
    } as VisitPhoto
    assert.equal(
      resolvedCoverUrl("/api/quotes/Q-1/photos/p1", [photo]),
      "https://cdn.example/live.jpg",
    )
  })
})
