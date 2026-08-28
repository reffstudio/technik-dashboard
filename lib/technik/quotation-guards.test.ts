import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isQuotationCreator,
  quotePipelineStatus,
  type Quotation,
} from "./data"
import {
  isDuplicateQuoteKey,
  persistClientResponse,
  persistSentAt,
  preferQuote,
  mergeVisitPhotos,
} from "./quotation-guards"

function quote(partial: Partial<Quotation>): Quotation {
  return {
    id: "TKS-Q-2026-0001",
    reference: "TKS-Q-2026-0001",
    clientId: "c1",
    title: "Obra",
    status: "draft",
    departments: [],
    lines: [],
    publicItems: [],
    createdBy: "Ana",
    createdById: "user-1",
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-01 10:00",
    history: [],
    ...partial,
  }
}

describe("quotePipelineStatus", () => {
  it("Borrador gana aunque tenga fecha de envío vieja", () => {
    assert.equal(quotePipelineStatus(quote({ status: "draft", clientSentAt: "2026-01-02" })), "draft")
  })
  it("Enviada al cliente = en revisión + clientSentAt", () => {
    assert.equal(
      quotePipelineStatus(quote({ status: "pending_review", clientSentAt: "2026-01-02" })),
      "sent_client",
    )
  })
  it("Aprobada no se lista como enviada", () => {
    assert.equal(
      quotePipelineStatus(quote({ status: "approved", clientSentAt: "2026-01-02" })),
      "approved",
    )
  })
})

describe("isQuotationCreator", () => {
  it("acepta id interno o authId", () => {
    const q = quote({ createdById: "auth-uuid" })
    assert.equal(isQuotationCreator({ id: "user-1", authId: "auth-uuid" }, q), true)
    assert.equal(isQuotationCreator({ id: "user-1", authId: "other" }, q), false)
    assert.equal(isQuotationCreator({ id: "user-1" }, quote({ createdById: "user-1" })), true)
  })
})

describe("preferQuote", () => {
  it("un pending_review no pierde contra un draft más nuevo", () => {
    const sent = quote({
      status: "pending_review",
      updatedAt: "2026-01-01 10:00",
      clientSentAt: "2026-01-01",
    })
    const draft = quote({
      status: "draft",
      updatedAt: "2026-01-02 12:00",
    })
    const merged = preferQuote(sent, draft)
    assert.equal(merged.status, "pending_review")
    assert.equal(merged.clientSentAt, "2026-01-01")
  })

  it("conserva clientSentAt del lado que lo tiene", () => {
    const withSend = quote({
      status: "pending_review",
      clientSentAt: "2026-03-01",
      updatedAt: "2026-03-01 09:00",
    })
    const newer = quote({ status: "pending_review", updatedAt: "2026-03-02 09:00" })
    assert.equal(preferQuote(newer, withSend).clientSentAt, "2026-03-01")
  })

  it("no baja aprobada a en_espera", () => {
    const approved = quote({
      status: "approved",
      clientResponse: "aprobada",
      updatedAt: "2026-01-01 10:00",
    })
    const waiting = quote({
      status: "approved",
      clientResponse: "en_espera",
      updatedAt: "2026-01-02 10:00",
    })
    assert.equal(preferQuote(waiting, approved).clientResponse, "aprobada")
  })
})

describe("isDuplicateQuoteKey", () => {
  it("detecta el error de Postgres de folio repetido", () => {
    assert.equal(
      isDuplicateQuoteKey({
        code: "23505",
        message: `duplicate key value violates unique constraint "quotations_pkey"`,
      }),
      true,
    )
    assert.equal(isDuplicateQuoteKey({ code: "42501", message: "rls" }), false)
  })
})

describe("persistSentAt / persistClientResponse", () => {
  it("en revisión no anula una fecha ya guardada", () => {
    assert.equal(persistSentAt(undefined, "2026-04-01", "pending_review"), "2026-04-01")
    assert.equal(persistSentAt("2026-04-02", "2026-04-01", "pending_review"), "2026-04-02")
  })
  it("en borrador sí puede limpiar el envío", () => {
    assert.equal(persistSentAt(undefined, "2026-04-01", "draft"), null)
  })
  it("no degrada la respuesta del cliente", () => {
    assert.equal(persistClientResponse("en_espera", "aprobada"), "aprobada")
    assert.equal(persistClientResponse("aprobada", "en_espera"), "aprobada")
  })
})

describe("mergeVisitPhotos", () => {
  it("no truena si hay huecos en el array", () => {
    assert.doesNotThrow(() => mergeVisitPhotos([undefined as never], [undefined as never]))
  })
})
