import { VISIT_PHOTO_MAX_BYTES, VISIT_THUMB_MAX_BYTES } from "./visit-photos"

const FULL_EDGE = 1280
const THUMB_EDGE = 480

export type CompressedVisitImage = {
  full: Blob
  thumb: Blob
  width: number
  height: number
  mime: "image/jpeg" | "image/webp"
}

function preferWebp(): boolean {
  if (typeof document === "undefined") return false
  const c = document.createElement("canvas")
  return c.toDataURL("image/webp").startsWith("data:image/webp")
}

async function decodeImage(file: File): Promise<{ bitmap: ImageBitmap | HTMLImageElement; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    return { bitmap, close: () => bitmap.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("No se pudo leer la imagen."))
      el.src = url
    })
    return {
      bitmap: img,
      close: () => URL.revokeObjectURL(url),
    }
  }
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const sw = "width" in source ? source.width : 0
  const sh = "height" in source ? source.height : 0
  const scale = Math.min(1, maxEdge / Math.max(sw, sh, 1))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo comprimir la imagen.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  return { canvas, width, height }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo comprimir la imagen."))
        else resolve(blob)
      },
      mime,
      quality,
    )
  })
}

async function encodeUnder(
  canvas: HTMLCanvasElement,
  mime: "image/jpeg" | "image/webp",
  maxBytes: number,
  startQuality: number,
): Promise<Blob> {
  let quality = startQuality
  let blob = await canvasToBlob(canvas, mime, quality)
  while (blob.size > maxBytes && quality > 0.42) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, mime, quality)
  }
  if (blob.size > maxBytes && mime === "image/webp") {
    return encodeUnder(canvas, "image/jpeg", maxBytes, 0.62)
  }
  if (blob.size > maxBytes) {
    throw new Error("La foto sigue pesando demasiado. Prueba otra toma más cercana.")
  }
  return blob
}

/**
 * Redimensiona, corrige orientación EXIF y exporta JPEG/WebP liviano + miniatura.
 * No se guarda el original ni metadatos EXIF (el canvas los descarta).
 */
export async function compressVisitImage(file: File): Promise<CompressedVisitImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se aceptan fotos (JPEG, PNG, WebP).")
  }
  if (file.type === "image/heic" || file.type === "image/heif") {
    throw new Error("Este formato no se puede comprimir aquí. Toma la foto con la cámara o elige un JPEG.")
  }

  const { bitmap, close } = await decodeImage(file)
  try {
    const fullDraw = drawToCanvas(bitmap, FULL_EDGE)
    const thumbDraw = drawToCanvas(bitmap, THUMB_EDGE)
    const mime: "image/jpeg" | "image/webp" = preferWebp() ? "image/webp" : "image/jpeg"
    const full = await encodeUnder(fullDraw.canvas, mime, VISIT_PHOTO_MAX_BYTES, mime === "image/webp" ? 0.72 : 0.68)
    const thumb = await encodeUnder(thumbDraw.canvas, "image/jpeg", VISIT_THUMB_MAX_BYTES, 0.56)
    return {
      full,
      thumb,
      width: fullDraw.width,
      height: fullDraw.height,
      mime: full.type === "image/webp" ? "image/webp" : "image/jpeg",
    }
  } finally {
    close()
  }
}
