"use client"

import type { QuotePdfKind } from "./outbound"

const LETTER_IN_W = 8.5
const LETTER_IN_H = 11
const LETTER_PX_W = Math.round(LETTER_IN_W * 96)
const LETTER_PX_H = Math.round(LETTER_IN_H * 96)

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
  for (let i = 0; i < 40; i++) {
    const el = document.querySelector<HTMLElement>(
      `[data-print-letter][data-print-kind="${kind}"]`,
    )
    if (el && el.offsetWidth > 8 && el.offsetHeight > 8) return el
    await waitFrames(1)
  }
  throw new Error("No se encontró la carta Letter para generar el PDF.")
}

/**
 * Rasteriza la carta 8.5×11″ del preview (misma plantilla, modo claro, 1 hoja).
 */
export async function captureLetterPdfBlob(kind: QuotePdfKind): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  const source = await findLetter(kind)
  const stage = document.createElement("div")
  stage.setAttribute("data-pdf-capture-stage", "true")
  Object.assign(stage.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: `${LETTER_PX_W}px`,
    height: `${LETTER_PX_H}px`,
    overflow: "hidden",
    opacity: "1",
    background: "#ffffff",
    colorScheme: "light",
    zIndex: "2147483646",
    pointerEvents: "none",
  })
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute("data-print-letter")
  Object.assign(clone.style, {
    width: `${LETTER_PX_W}px`,
    height: `${LETTER_PX_H}px`,
    maxWidth: "none",
    maxHeight: "none",
    transform: "none",
    boxShadow: "none",
    backgroundColor: "#ffffff",
    color: "#171717",
    colorScheme: "light",
  })
  stage.appendChild(clone)
  document.body.appendChild(stage)

  try {
    await waitForImages(clone)
    if (document.fonts?.ready) await document.fonts.ready
    await waitFrames(2)
    await sleep(60)

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 10_000,
      width: LETTER_PX_W,
      height: LETTER_PX_H,
      windowWidth: LETTER_PX_W,
      windowHeight: LETTER_PX_H,
      onclone: (doc, cloned) => {
        doc.documentElement.classList.remove("dark")
        doc.documentElement.style.colorScheme = "light"
        doc.body.style.background = "#ffffff"
        cloned.style.width = `${LETTER_PX_W}px`
        cloned.style.height = `${LETTER_PX_H}px`
        cloned.style.backgroundColor = "#ffffff"
        cloned.style.color = "#171717"
        cloned.style.colorScheme = "light"
        cloned.style.transform = "none"
        cloned.style.boxShadow = "none"
      },
    })

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
      compress: true,
    })
    const img = canvas.toDataURL("image/jpeg", 0.95)
    pdf.addImage(img, "JPEG", 0, 0, LETTER_IN_W, LETTER_IN_H, undefined, "FAST")
    return pdf.output("blob")
  } finally {
    stage.remove()
  }
}
