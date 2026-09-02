import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { Project, ProjectInstallment } from "./data"
import { adoptOpsProjects, preferProjectForPersist } from "./live"

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
