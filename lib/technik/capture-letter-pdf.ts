"use client"

import type { QuotePdfKind } from "./outbound"

const LETTER_IN_W = 8.5
const LETTER_IN_H = 11

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function waitFrames(n = 2) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  }
}

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"))
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true })
        img.addEventListener("error", () => resolve(), { once: true })
      })
    }),
  )
}

async function findLetter(kind: QuotePdfKind): Promise<HTMLElement> {
  for (let i = 0; i < 30; i++) {
    const el = document.querySelector<HTMLElement>(
      `[data-print-letter][data-print-kind="${kind}"]`,
    )
    if (el && el.offsetWidth > 8 && el.offsetHeight > 8) return el
    await waitFrames(1)
  }
  throw new Error("No se encontró la carta Letter para generar el PDF.")
}

/**
 * Rasteriza la carta 8.5×11″ del preview y la mete en un PDF de una sola hoja.
 */
export async function captureLetterPdfBlob(kind: QuotePdfKind): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  const el = await findLetter(kind)
  const host = el.closest<HTMLElement>("[data-print-host]")

  const restoreHost = host
    ? { opacity: host.style.opacity, zIndex: host.style.zIndex }
    : null
  const restoreSiblings: Array<{ node: HTMLElement; display: string }> = []

  if (host) {
    host.style.opacity = "1"
    host.style.zIndex = "-1"
    host.querySelectorAll<HTMLElement>("[data-print-letter]").forEach((node) => {
      if (node.getAttribute("data-print-kind") === kind) return
      const wrap = node.parentElement ?? node
      restoreSiblings.push({ node: wrap, display: wrap.style.display })
      wrap.style.display = "none"
    })
  }

  try {
    await waitForImages(el)
    if (document.fonts?.ready) await document.fonts.ready
    await waitFrames(2)
    await sleep(40)

    const w = el.offsetWidth
    const h = el.offsetHeight

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 10_000,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: w,
      height: h,
      onclone: (_doc, cloned) => {
        let node: HTMLElement | null = cloned
        while (node) {
          node.style.opacity = "1"
          node.style.visibility = "visible"
          node.style.transform = "none"
          node.style.clipPath = "none"
          node = node.parentElement
        }
        cloned.style.width = `${w}px`
        cloned.style.height = `${h}px`
        cloned.style.boxShadow = "none"
        cloned.style.colorScheme = "light"
        cloned.style.backgroundColor = "#ffffff"
      },
    })

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
      compress: true,
    })
    const img = canvas.toDataURL("image/jpeg", 0.93)
    pdf.addImage(img, "JPEG", 0, 0, LETTER_IN_W, LETTER_IN_H, undefined, "FAST")
    return pdf.output("blob")
  } finally {
    for (const { node, display } of restoreSiblings) {
      node.style.display = display
    }
    if (host && restoreHost) {
      host.style.opacity = restoreHost.opacity
      host.style.zIndex = restoreHost.zIndex
    }
  }
}
