import { formatDisplayDate } from "./dates"

/** Datos de membrete para cotizaciones al cliente (formato imprimible). */
export const TECHNIK_COMPANY = {
  name: "Technik Solutions",
  addressLines: ["Calle Aldama 244 A"],
  phones: ["(646)-215-7180", "(646)-136-5195"],
  email: "info@solutionstechnik.com",
  website: "www.solutionstechnik.com",
  slogan: "Entregamos calidad, construimos confianza",
} as const

/** Copias fijas al enviar cotizaciones / solicitudes de materiales. */
export const QUOTE_CC_EMAILS = [
  "i.ochoa@solutionstechnik.com",
  "m.archuleta@solutionstechnik.com",
  "info@solutionstechnik.com",
] as const

/** IVA frontera (default). Interior del país: editar a 16% en la cotización. */
export const DEFAULT_TAX_RATE = 0.08
/** Retención ISR por default (1.25%) — se resta del total. */
export const DEFAULT_ISR_RETENTION_RATE = 0.0125

/** Markup sobre costo de material → precio público sugerido (editable hasta envío). */
export const MATERIAL_PUBLIC_MARKUP = 0.1
/** Carga IMSS/INFONAVIT sobre mano de obra (solo economía interna). */
export const LABOR_BURDEN_RATE = 0.2
/** Ganancia interna: (MO base + materiales con markup) × tasa. */
export const INTERNAL_PROFIT_RATE = 0.6
/** Bono anual: (ganancia + materiales con markup) × tasa. */
export const ANNUAL_BONUS_RATE = 0.1
/** Tarifa base sugerida de mano de obra ($/h) al crear ítems en catálogo. */
export const DEFAULT_LABOR_HOURLY_RATE = 110

/** Porcentaje legible: 0.08 → "8", 0.0125 → "1.25" */
export function formatPercentLabel(rate: number): string {
  if (!Number.isFinite(rate)) return "0"
  const pct = rate * 100
  const fixed = pct.toFixed(4).replace(/\.?0+$/, "")
  return fixed === "-0" ? "0" : fixed
}

export const DEFAULT_QUOTE_TERMS = `1.- Esta cotización tiene una vigencia de 15 días a partir de la fecha de emisión.
2.- Tiempo de entrega: a confirmar según carga de trabajo y disponibilidad de materiales.
3.- Precios en pesos mexicanos (MXN). No incluyen conceptos no listados.
4.- Cualquier cambio de alcance puede modificar tiempos y costos.`

export function formatQuoteDate(iso: string): string {
  return formatDisplayDate(iso, iso)
}
