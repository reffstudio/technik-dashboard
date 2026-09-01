"use client"

import { useMemo, useState, type FormEvent } from "react"
import { motion } from "motion/react"
import {
  ArrowDownUp,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react"
import {
  CASH_CHANNEL_LABEL,
  currencyMxn,
  projectIsHidden,
  type ApartadoMovementKind,
  type CashChannel,
  type SeparadoKind,
} from "@/lib/technik/data"
import { formatDisplayDate } from "@/lib/technik/dates"
import {
  buildApartadoHistory,
  cajaConFondos,
  disponibleTrasApartados,
  formatYearMonthLabel,
  monthCashSummary,
  monthIncomeTotalsMap,
  monthLedger,
  resolveMonthSeparados,
  sumOpeningOpen,
  sumReservedOpen,
  yearMonthFromIso,
} from "@/lib/technik/treasury"
import { useIsAdmin, useTechnik } from "@/lib/technik/store"
import { DecimalInput, inputCls } from "../ui"
import type { View } from "../app-shell"

const EASE = [0.16, 1, 0.3, 1] as const

function moneyCell(n: number | undefined) {
  if (n === undefined || n === 0) return "—"
  return currencyMxn(n)
}

type Props = {
  navigate: (v: View) => void
  yearMonth: string
}

export function BillingTreasury({ navigate, yearMonth }: Props) {
  const isAdmin = useIsAdmin()
  const {
    projects,
    quotations,
    clients,
    expenses,
    treasuryMonths,
    treasurySeparados,
    apartadoMovements,
    addExpense,
    updateExpense,
    removeExpense,
    setTreasuryMonth,
    addTreasurySeparado,
    updateTreasurySeparado,
    removeTreasurySeparado,
    addApartadoMovement,
    removeApartadoMovement,
  } = useTechnik()

  const liveProjects = useMemo(
    () => projects.filter((p) => !projectIsHidden(p, quotations)),
    [projects, quotations],
  )

  const todayIso = new Date().toISOString().slice(0, 10)
  const [openEdit, setOpenEdit] = useState(false)
  const [draftBank, setDraftBank] = useState("")
  const [draftCash, setDraftCash] = useState("")

  const [expDesc, setExpDesc] = useState("")
  const [expAmount, setExpAmount] = useState("")
  const [expDate, setExpDate] = useState(todayIso)
  const [expChannel, setExpChannel] = useState<CashChannel>("banco")
  const [expToast, setExpToast] = useState<string | null>(null)
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [expFormOpen, setExpFormOpen] = useState(false)

  const [sepName, setSepName] = useState("")
  const [sepKind, setSepKind] = useState<SeparadoKind>("percent")
  const [sepValue, setSepValue] = useState("")
  const [sepOpening, setSepOpening] = useState(0)
  /** `null` = cerrado; `"new"` = crear reserva en lista */
  const [apartadoDraft, setApartadoDraft] = useState<null | "new">(null)
  const [sepToast, setSepToast] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [movKind, setMovKind] = useState<ApartadoMovementKind>("out")
  const [movAmount, setMovAmount] = useState("")
  const [movDate, setMovDate] = useState(todayIso)
  const [movNote, setMovNote] = useState("")
  const [movCreateExpense, setMovCreateExpense] = useState(true)
  const [movFormOpen, setMovFormOpen] = useState(false)

  const summary = useMemo(
    () =>
      monthCashSummary(
        liveProjects,
        quotations,
        clients,
        expenses,
        treasuryMonths,
        yearMonth,
      ),
    [liveProjects, quotations, clients, expenses, treasuryMonths, yearMonth],
  )

  const ledger = useMemo(
    () => monthLedger(liveProjects, quotations, clients, expenses, yearMonth),
    [liveProjects, quotations, clients, expenses, yearMonth],
  )

  const monthIncomeTotal = summary.incomeBank + summary.incomeCash

  const incomeByMonth = useMemo(() => {
    const fromCandidates = treasurySeparados
      .filter((s) => s.category === "custom")
      .map((s) => yearMonthFromIso(s.createdAt.slice(0, 10)))
    const fromYm =
      fromCandidates.length > 0
        ? fromCandidates.reduce((a, b) => (a < b ? a : b))
        : yearMonth
    return monthIncomeTotalsMap(
      liveProjects,
      quotations,
      clients,
      expenses,
      treasuryMonths,
      fromYm,
      yearMonth,
    )
  }, [
    treasurySeparados,
    liveProjects,
    quotations,
    clients,
    expenses,
    treasuryMonths,
    yearMonth,
  ])

  const resolvedSeparados = useMemo(
    () =>
      resolveMonthSeparados(
        treasurySeparados,
        yearMonth,
        monthIncomeTotal,
        apartadoMovements,
        incomeByMonth,
      ),
    [treasurySeparados, yearMonth, monthIncomeTotal, apartadoMovements, incomeByMonth],
  )
  const reservedOpen = useMemo(() => sumReservedOpen(resolvedSeparados), [resolvedSeparados])
  const openingOpen = useMemo(() => sumOpeningOpen(resolvedSeparados), [resolvedSeparados])
  const cajaTotal = useMemo(
    () => cajaConFondos(summary.availableTotal, openingOpen),
    [summary.availableTotal, openingOpen],
  )
  const afterApartados = useMemo(
    () => disponibleTrasApartados(cajaTotal, reservedOpen),
    [cajaTotal, reservedOpen],
  )

  const detailSeparado = useMemo(
    () => resolvedSeparados.find((s) => s.id === detailId) ?? null,
    [resolvedSeparados, detailId],
  )

  const detailHistory = useMemo(() => {
    if (!detailSeparado) return []
    return buildApartadoHistory(
      detailSeparado,
      yearMonth,
      incomeByMonth,
      apartadoMovements,
    )
  }, [detailSeparado, yearMonth, incomeByMonth, apartadoMovements])

  const monthLabel = formatYearMonthLabel(yearMonth)

  function flashSep(msg: string) {
    setSepToast(msg)
    window.setTimeout(() => setSepToast(null), 2200)
  }

  function resetApartadoForm() {
    setSepName("")
    setSepKind("percent")
    setSepValue("")
    setSepOpening(0)
    setApartadoDraft(null)
  }

  function openNewApartado() {
    setDetailId(null)
    setSepName("")
    setSepKind("percent")
    setSepValue("")
    setSepOpening(0)
    setApartadoDraft("new")
  }

  function submitNewApartado(e: FormEvent) {
    e.preventDefault()
    const name = sepName.trim()
    const value = Number(sepValue)
    if (!name || !Number.isFinite(value) || value < 0) return
    if (sepKind === "percent" && value > 100) return
    addTreasurySeparado({
      name,
      kind: sepKind,
      value,
      openingBalance: sepOpening,
      category: "custom",
      status: "open",
    })
    flashSep("Reserva creada")
    resetApartadoForm()
  }

  function openDetail(id: string) {
    const s = treasurySeparados.find((x) => x.id === id)
    if (!s) return
    setApartadoDraft(null)
    setDetailId(id)
    setSepName(s.name)
    setSepKind(s.kind)
    setSepValue(String(s.value))
    setSepOpening(s.openingBalance ?? 0)
    setMovKind("out")
    setMovAmount("")
    setMovDate(todayIso)
    setMovNote("")
    setMovCreateExpense(true)
    setMovFormOpen(false)
  }

  function submitDetailEdit(e: FormEvent) {
    e.preventDefault()
    if (!detailId || !isAdmin) return
    const s = treasurySeparados.find((x) => x.id === detailId)
    if (!s) return
    const value = Number(sepValue)
    if (!Number.isFinite(value) || value < 0) return

    const name = sepName.trim()
    if (!name) return
    if (sepKind === "percent" && value > 100) return
    updateTreasurySeparado(s.id, { name, kind: sepKind, value, openingBalance: sepOpening })
    flashSep("Apartado actualizado")
  }

  function submitMovement(e: FormEvent) {
    e.preventDefault()
    if (!detailId || !isAdmin) return
    const amount = Number(movAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    addApartadoMovement({
      apartadoId: detailId,
      kind: movKind,
      amount,
      date: movDate || todayIso,
      note: movNote.trim() || undefined,
      createExpense: movKind === "out" ? movCreateExpense : false,
      channel: "banco",
    })
    setMovAmount("")
    setMovNote("")
    setMovFormOpen(false)
    flashSep(movKind === "out" ? "Salida registrada" : "Entrada registrada")
  }

  function apartadoReserveFormFields() {
    return (
      <>
        <label className="block text-xs min-w-0 sm:col-span-2">
          <span className="text-muted-foreground">Nombre</span>
          <input
            value={sepName}
            onChange={(e) => setSepName(e.target.value)}
            placeholder="IVA, ISR, bono anual…"
            className={`${inputCls} mt-1`}
            required
            autoFocus
          />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Tipo</legend>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setSepKind("percent")}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                sepKind === "percent"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => setSepKind("amount")}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                sepKind === "amount"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border"
              }`}
            >
              MXN
            </button>
          </div>
        </fieldset>
        <label className="block text-xs">
          <span className="text-muted-foreground">
            {sepKind === "percent" ? "Porcentaje" : "Monto"}
          </span>
          <input
            type="number"
            step={sepKind === "percent" ? "0.1" : "0.01"}
            min="0"
            max={sepKind === "percent" ? "100" : undefined}
            value={sepValue}
            onChange={(e) => setSepValue(e.target.value)}
            placeholder={sepKind === "percent" ? "10" : "5000"}
            className={`${inputCls} mt-1`}
            required
          />
        </label>
        <label className="block text-xs min-w-0 sm:col-span-2">
          <span className="text-muted-foreground">Saldo inicial (MXN)</span>
          <DecimalInput
            value={sepOpening}
            min={0}
            ariaLabel="Saldo inicial"
            onChange={setSepOpening}
            className={`${inputCls} mt-1 font-mono`}
          />
          <span className="mt-1 block text-[10px] text-muted-foreground leading-snug">
            Lo que ya tenían en esa reserva al empezar. Entra a En caja; no se resta de Para usar.
          </span>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            Crear reserva
          </button>
          <button
            type="button"
            onClick={resetApartadoForm}
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
        </div>
      </>
    )
  }

  function openOpeningsEditor() {
    setDraftBank(String(summary.openingBank || ""))
    setDraftCash(String(summary.openingCash || ""))
    setOpenEdit(true)
  }

  function saveOpenings() {
    const openingBank = Number(draftBank)
    const openingCash = Number(draftCash)
    setTreasuryMonth(yearMonth, {
      openingBank: Number.isFinite(openingBank) ? openingBank : 0,
      openingCash: Number.isFinite(openingCash) ? openingCash : 0,
    })
    setOpenEdit(false)
  }

  function submitExpense(e: FormEvent) {
    e.preventDefault()
    const amount = Number(expAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpToast("Ingresa un monto válido")
      window.setTimeout(() => setExpToast(null), 2200)
      return
    }
    if (!expDesc.trim()) {
      setExpToast("Describe el egreso")
      window.setTimeout(() => setExpToast(null), 2200)
      return
    }
    if (!expDate) {
      setExpToast("Indica la fecha")
      window.setTimeout(() => setExpToast(null), 2200)
      return
    }

    if (editingExpId) {
      updateExpense(editingExpId, {
        amount,
        date: expDate,
        description: expDesc.trim(),
        channel: expChannel,
      })
      setExpToast("Egreso actualizado")
    } else {
      addExpense({
        amount,
        date: expDate,
        description: expDesc.trim(),
        channel: expChannel,
      })
      setExpToast("Egreso registrado")
    }
    setEditingExpId(null)
    setExpDesc("")
    setExpAmount("")
    setExpDate(todayIso)
    setExpChannel("banco")
    setExpFormOpen(false)
    window.setTimeout(() => setExpToast(null), 2200)
  }

  function resetExpenseForm() {
    setEditingExpId(null)
    setExpDesc("")
    setExpAmount("")
    setExpDate(todayIso)
    setExpChannel("banco")
    setExpFormOpen(false)
  }

  function startEditExpense(expenseId: string) {
    const exp = expenses.find((x) => x.id === expenseId)
    if (!exp) return
    setEditingExpId(expenseId)
    setExpDesc(exp.description)
    setExpAmount(String(exp.amount))
    setExpDate(exp.date)
    setExpChannel(exp.channel)
    setExpFormOpen(true)
  }

  return (
    <div className="space-y-4">

      {/* Resúmenes tipo Excel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="rounded-2xl surface-card p-4 sm:col-span-2 xl:col-span-1"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Dinero {monthLabel.split(" ")[0]}
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Banco</dt>
              <dd className="font-mono font-semibold">{currencyMxn(summary.availableBank)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Efectivo</dt>
              <dd className="font-mono font-semibold">{currencyMxn(summary.availableCash)}</dd>
            </div>
            {openingOpen > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Fondos iniciales</dt>
                <dd className="font-mono font-semibold">{currencyMxn(openingOpen)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2 border-t border-border pt-1.5 mt-1.5">
              <dt className="text-muted-foreground">En caja</dt>
              <dd className="font-mono font-semibold">
                {currencyMxn(cajaTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Apartado</dt>
              <dd className="font-mono font-semibold">{currencyMxn(reservedOpen)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-border pt-1.5 mt-1.5">
              <dt className="font-semibold">Para usar</dt>
              <dd className="font-mono font-bold text-primary">
                {currencyMxn(afterApartados)}
              </dd>
            </div>
          </dl>
          <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
            El fondo inicial ya estaba en las reservas: se suma a En caja y no recorta Para usar.
            El % o monto de cada mes sí se aparta de lo operativo.
            {summary.openingCarriedFrom
              ? ` Banco y efectivo se cortan el último día de ${formatYearMonthLabel(summary.openingCarriedFrom)} y pasan a este mes.`
              : ""}
          </p>
          <button
            type="button"
            onClick={openOpeningsEditor}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            <Pencil className="size-3" />
            Saldos iniciales
          </button>
        </motion.div>

        {(
          [
            {
              label: "Ingresos banco",
              value: summary.incomeBank,
              tone: "bg-fin-gain/10 text-fin-gain",
            },
            {
              label: "Egresos banco",
              value: summary.expenseBank,
              tone: "bg-destructive/10 text-destructive",
            },
            {
              label: "Ingresos efectivo",
              value: summary.incomeCash,
              tone: "bg-fin-gain/10 text-fin-gain",
            },
            {
              label: "Egresos efectivo",
              value: summary.expenseCash,
              tone: "bg-destructive/10 text-destructive",
            },
          ] as const
        ).map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.04 * (i + 1) }}
            className="rounded-2xl surface-card p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {card.label}
            </p>
            <p className={`mt-3 font-mono text-xl font-bold rounded-lg px-2 py-1.5 ${card.tone}`}>
              {currencyMxn(card.value)}
            </p>
          </motion.div>
        ))}
      </div>

      {openEdit && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold mb-1">
            Apertura del mes · {monthLabel}
          </p>
          <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
            Por defecto se traspasa el cierre del mes anterior (último día natural). Fija un
            saldo solo si quieres cortar esa cadena.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="text-muted-foreground">Disponible inicial banco</span>
              <input
                type="number"
                step="0.01"
                value={draftBank}
                onChange={(e) => setDraftBank(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Disponible inicial efectivo</span>
              <input
                type="number"
                step="0.01"
                value={draftCash}
                onChange={(e) => setDraftCash(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={saveOpenings}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setOpenEdit(false)}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Movimientos del mes */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
        className="rounded-[1.75rem] surface-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold font-display uppercase tracking-[0.08em]">
            Movimientos del mes
          </h3>
          {!expFormOpen && (
            <button
              type="button"
              onClick={() => {
                resetExpenseForm()
                setExpFormOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shrink-0"
            >
              <Plus className="size-3.5" />
              Registrar egreso
            </button>
          )}
        </div>

        {expFormOpen && (
          <form
            onSubmit={submitExpense}
            className="rounded-xl border border-primary/40 bg-primary/5 p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <label className="block text-xs sm:col-span-2">
              <span className="text-muted-foreground">Descripción</span>
              <input
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Renta, IMSS, materiales…"
                className={`${inputCls} mt-1`}
                autoFocus
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Monto</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Fecha</span>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Canal</span>
              <select
                value={expChannel}
                onChange={(e) => setExpChannel(e.target.value as CashChannel)}
                className={`${inputCls} mt-1`}
              >
                <option value="banco">{CASH_CHANNEL_LABEL.banco}</option>
                <option value="efectivo">{CASH_CHANNEL_LABEL.efectivo}</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                {editingExpId ? "Guardar cambios" : "Agregar egreso"}
              </button>
              <button
                type="button"
                onClick={resetExpenseForm}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              {expToast && (
                <p className="text-[11px] font-semibold text-fin-gain">{expToast}</p>
              )}
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-2 font-semibold">Descripción</th>
                <th className="py-2 px-1 font-semibold text-right text-fin-gain">
                  Ing. efectivo
                </th>
                <th className="py-2 px-1 font-semibold text-right text-fin-gain">
                  Ing. banco
                </th>
                <th className="py-2 px-1 font-semibold text-right text-destructive">
                  Egr. efectivo
                </th>
                <th className="py-2 px-1 font-semibold text-right text-destructive">
                  Egr. banco
                </th>
                <th className="py-2 pl-2 font-semibold w-16" />
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    Sin movimientos en {monthLabel}. Los cobros aparecen al marcarse
                    pagados; registra un egreso con el botón de arriba.
                  </td>
                </tr>
              ) : (
                ledger.map((row) => {
                  const isIncome = row.kind === "income"
                  const cashIn =
                    isIncome && row.channel === "efectivo" ? row.amount : undefined
                  const bankIn =
                    isIncome && row.channel === "banco" ? row.amount : undefined
                  const cashOut =
                    !isIncome && row.channel === "efectivo" ? row.amount : undefined
                  const bankOut =
                    !isIncome && row.channel === "banco" ? row.amount : undefined
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-border/60 ${
                        isIncome ? "bg-fin-gain/5" : "bg-destructive/[0.03]"
                      }`}
                    >
                      <td className="py-2.5 pr-2">
                        <p className="font-medium text-foreground leading-snug">
                          {row.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDisplayDate(row.date)}
                          {isIncome ? " · cobro" : " · egreso"}
                        </p>
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono tabular-nums">
                        {moneyCell(cashIn)}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono tabular-nums">
                        {moneyCell(bankIn)}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono tabular-nums">
                        {moneyCell(cashOut)}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono tabular-nums">
                        {moneyCell(bankOut)}
                      </td>
                      <td className="py-2.5 pl-2">
                        {isIncome ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate({ name: "project", id: row.projectId })
                            }
                            className="text-[10px] font-semibold text-primary hover:underline"
                          >
                            Ver
                          </button>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => startEditExpense(row.expenseId)}
                              className="rounded-lg border border-border p-1 hover:border-primary/40"
                              aria-label="Editar egreso"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeExpense(row.expenseId)}
                              className="rounded-lg border border-border p-1 hover:border-destructive/50"
                              aria-label="Eliminar egreso"
                            >
                              <Trash2 className="size-3 text-destructive" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="py-3 pr-2">Totales del mes</td>
                <td className="py-3 px-1 text-right font-mono text-fin-gain">
                  {moneyCell(summary.incomeCash)}
                </td>
                <td className="py-3 px-1 text-right font-mono text-fin-gain">
                  {moneyCell(summary.incomeBank)}
                </td>
                <td className="py-3 px-1 text-right font-mono text-destructive">
                  {moneyCell(summary.expenseCash)}
                </td>
                <td className="py-3 px-1 text-right font-mono text-destructive">
                  {moneyCell(summary.expenseBank)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {!expFormOpen && expToast && (
          <p className="text-[11px] font-semibold text-fin-gain mt-3">{expToast}</p>
        )}
      </motion.section>

      {/* Apartados */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
        className="rounded-[1.75rem] surface-card p-5"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold font-display uppercase tracking-[0.08em] flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              Apartados
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Reservas que defines tú: un % de ingresos (IVA, ISR u otro) o un
              monto fijo. El fondo inicial es dinero que ya tenían; el % de cada
              mes se aparta de lo operativo. “Para usar” está arriba en Dinero.
            </p>
          </div>
          {isAdmin && apartadoDraft === null && (
            <button
              type="button"
              onClick={openNewApartado}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shrink-0"
            >
              <Plus className="size-3.5" />
              Nueva reserva
            </button>
          )}
        </div>

        <div className="space-y-5">
          {resolvedSeparados.length === 0 && apartadoDraft !== "new" ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin reservas.
              {isAdmin ? " Crea una con “Nueva reserva” (por ejemplo IVA 16%)." : ""}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {resolvedSeparados.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(s.id)}
                    className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.kind === "percent"
                          ? `${s.value}% de ingresos`
                          : `Monto fijo ${currencyMxn(s.value)}`}
                        {" · "}mes {currencyMxn(s.monthAmount)}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-primary shrink-0">
                      {currencyMxn(s.balance)}
                    </span>
                  </button>
                </li>
              ))}

              {isAdmin && apartadoDraft === "new" && (
                <li className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-3">
                  <form
                    onSubmit={submitNewApartado}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {apartadoReserveFormFields()}
                  </form>
                </li>
              )}
            </ul>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-border text-sm">
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 sm:col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Total apartado
              </dt>
              <dd className="font-mono font-bold mt-0.5">{currencyMxn(reservedOpen)}</dd>
            </div>
          </dl>
        </div>

        {sepToast && (
          <p className="text-[11px] font-semibold text-fin-gain mt-3">{sepToast}</p>
        )}
      </motion.section>

      {detailSeparado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar"
            onClick={() => setDetailId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={detailSeparado.name}
            className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl surface-elevated border border-border p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Reserva
                </p>
                <h2 className="text-base font-bold text-foreground truncate">
                  {detailSeparado.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground shrink-0"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Saldo
                </dt>
                <dd className="font-mono font-bold text-primary mt-0.5">
                  {currencyMxn(detailSeparado.balance)}
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Este mes
                </dt>
                <dd className="font-mono font-bold mt-0.5">
                  {currencyMxn(detailSeparado.monthAmount)}
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 col-span-2">
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Saldo inicial
                </dt>
                <dd className="font-mono font-bold mt-0.5">
                  {currencyMxn(detailSeparado.openingBalance ?? 0)}
                </dd>
              </div>
            </dl>

            {isAdmin ? (
              <form
                onSubmit={submitDetailEdit}
                className="rounded-xl border border-border bg-muted/10 p-3 space-y-3 mb-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Editar apartado
                </p>
                <label className="block text-xs">
                  <span className="text-muted-foreground">Nombre</span>
                  <input
                    value={sepName}
                    onChange={(e) => setSepName(e.target.value)}
                    className={`${inputCls} mt-1`}
                    required
                  />
                </label>
                <fieldset className="space-y-1.5">
                  <legend className="text-xs text-muted-foreground">Tipo</legend>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSepKind("percent")}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                        sepKind === "percent"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setSepKind("amount")}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                        sepKind === "amount"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      }`}
                    >
                      MXN
                    </button>
                  </div>
                </fieldset>
                <label className="block text-xs">
                  <span className="text-muted-foreground">
                    {sepKind === "percent" ? "Porcentaje" : "Monto fijo"}
                  </span>
                  <input
                    type="number"
                    step={sepKind === "percent" ? "0.1" : "0.01"}
                    min="0"
                    max={sepKind === "percent" ? "100" : undefined}
                    value={sepValue}
                    onChange={(e) => setSepValue(e.target.value)}
                    className={`${inputCls} mt-1`}
                    required
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-muted-foreground">Saldo inicial (MXN)</span>
                  <DecimalInput
                    value={sepOpening}
                    min={0}
                    ariaLabel="Saldo inicial"
                    onChange={setSepOpening}
                    className={`${inputCls} mt-1 font-mono`}
                  />
                  <span className="mt-1 block text-[10px] text-muted-foreground leading-snug">
                    Lo que ya tenían en esa reserva al empezar. Entra a En caja; no se resta de Para usar.
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeTreasurySeparado(detailSeparado.id)
                      setDetailId(null)
                      flashSep("Reserva eliminada")
                    }}
                    className="rounded-xl border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs mb-4">
                {detailSeparado.kind === "percent"
                  ? `${detailSeparado.value}% de ingresos`
                  : `Monto fijo ${currencyMxn(detailSeparado.value)}`}
              </div>
            )}

            {isAdmin && (
              <div className="mb-4">
                {!movFormOpen ? (
                  <button
                    type="button"
                    onClick={() => setMovFormOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:border-primary/40"
                  >
                    <ArrowDownUp className="size-3.5" />
                    Registrar entrada / salida
                  </button>
                ) : (
                  <form
                    onSubmit={submitMovement}
                    className="rounded-xl border border-border bg-muted/10 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        Registrar movimiento
                      </p>
                      <button
                        type="button"
                        onClick={() => setMovFormOpen(false)}
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMovKind("out")}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                          movKind === "out"
                            ? "border-destructive/50 bg-destructive/10 text-destructive"
                            : "border-border"
                        }`}
                      >
                        Salida / adelanto
                      </button>
                      <button
                        type="button"
                        onClick={() => setMovKind("in")}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                          movKind === "in"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border"
                        }`}
                      >
                        Entrada / abono
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs">
                        <span className="text-muted-foreground">Monto</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={movAmount}
                          onChange={(e) => setMovAmount(e.target.value)}
                          className={`${inputCls} mt-1`}
                          required
                        />
                      </label>
                      <label className="block text-xs">
                        <span className="text-muted-foreground">Fecha</span>
                        <input
                          type="date"
                          value={movDate}
                          onChange={(e) => setMovDate(e.target.value)}
                          className={`${inputCls} mt-1`}
                          required
                        />
                      </label>
                    </div>
                    <label className="block text-xs">
                      <span className="text-muted-foreground">Nota</span>
                      <input
                        value={movNote}
                        onChange={(e) => setMovNote(e.target.value)}
                        placeholder={
                          movKind === "out"
                            ? "Adelanto bono, retiro parcial…"
                            : "Abono extra…"
                        }
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                    {movKind === "out" && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={movCreateExpense}
                          onChange={(e) => setMovCreateExpense(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-muted-foreground">
                          Crear egreso en tesorería (banco)
                        </span>
                      </label>
                    )}
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                    >
                      Guardar movimiento
                    </button>
                  </form>
                )}
              </div>
            )}

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                Historial
              </h3>
              {detailHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin movimientos aún.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto">
                  {detailHistory.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border/70 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold leading-snug">
                          {line.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDisplayDate(line.date)}
                          {line.kind === "opening"
                            ? " · saldo inicial"
                            : line.kind === "accrual"
                              ? " · acumulación"
                              : line.kind === "in"
                                ? " · entrada"
                                : " · salida"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`font-mono text-xs font-bold ${
                            line.kind === "out"
                              ? "text-destructive"
                              : "text-fin-gain"
                          }`}
                        >
                          {line.kind === "out" ? "−" : "+"}
                          {currencyMxn(line.amount)}
                        </span>
                        {isAdmin && line.movementId && (
                          <button
                            type="button"
                            onClick={() => {
                              removeApartadoMovement(line.movementId!)
                              flashSep("Movimiento eliminado")
                            }}
                            className="rounded-md border border-border p-1 hover:border-destructive/50"
                            aria-label="Eliminar movimiento"
                          >
                            <Trash2 className="size-3 text-destructive" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
