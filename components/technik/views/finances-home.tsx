"use client"

import { useState, type ElementType } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Landmark, Receipt } from "lucide-react"
import { yearMonthFromIso } from "@/lib/technik/treasury"
import type { View } from "../app-shell"
import { MonthSwitcher } from "../ui"
import { BillingHome } from "./billing-home"
import { BillingTreasury } from "./billing-treasury"
import { FinancesHero, type FinancesSection } from "./finances-hero"

export type { FinancesSection }

type Props = {
  section: FinancesSection
  navigate: (v: View) => void
}

const EASE = [0.16, 1, 0.3, 1] as const

const SECTIONS: {
  id: FinancesSection
  label: string
  description: string
  icon: ElementType
}[] = [
  {
    id: "facturacion",
    label: "Facturación",
    description: "Cobranza, agenda y economía",
    icon: Receipt,
  },
  {
    id: "balances",
    label: "Balances",
    description: "Libro, egresos y apartados",
    icon: Landmark,
  },
]

export function FinancesHome({ section, navigate }: Props) {
  const [yearMonth, setYearMonth] = useState(() =>
    yearMonthFromIso(new Date().toISOString().slice(0, 10)),
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight font-display">
            Finanzas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cobranza y tesorería por mes natural
          </p>
        </div>
        <MonthSwitcher yearMonth={yearMonth} onChange={setYearMonth} />
      </div>

      <FinancesHero yearMonth={yearMonth} />

      <nav
        aria-label="Secciones de Finanzas"
        className="mb-7 grid grid-cols-2 gap-2 sm:gap-3 rounded-2xl border border-border bg-muted/40 p-1.5 sm:p-2"
      >
        {SECTIONS.map((s) => {
          const isActive = section === s.id
          return (
            <button
              key={s.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => navigate({ name: "finanzas", section: s.id })}
              className={`relative flex items-start gap-3 rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 text-left transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm border border-primary"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground border border-transparent"
              }`}
            >
              <span
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`text-sm sm:text-base font-bold font-display tracking-tight ${
                    isActive ? "text-primary-foreground" : ""
                  }`}
                >
                  {s.label}
                </span>
                <span
                  className={`mt-0.5 block text-[11px] sm:text-xs leading-snug line-clamp-2 ${
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {s.description}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {section === "balances" ? (
            <BillingTreasury navigate={navigate} yearMonth={yearMonth} />
          ) : (
            <BillingHome navigate={navigate} yearMonth={yearMonth} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
