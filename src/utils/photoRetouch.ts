import type { PhotoElement } from "../models/template"
import { loadHtmlImage } from "./photoRaster"

export type RetouchBrush = "redeye" | "heal" | "blemish" | "skin" | "teeth" | "eye" | "blur" | "sponge" | "clone" | "object"

export const RETOUCH_BRUSHES: ReadonlySet<string> = new Set([
  "redeye",
  "heal",
  "blemish",
  "skin",
  "teeth",
  "eye",
  "blur",
  "sponge",
  "clone",
  "object",
])

type Session = {
  id: string
  canvas: HTMLCanvasElement
  pixels: ImageData
  base: Uint8ClampedArray
  clone: { x: number; y: number } | null
  offset: { x: number; y: number } | null
}

let session: Session | null = null

const MAX_EDGE = 1400

export function photoImagePoint(
  element: PhotoElement,
  localX: number,
  localY: number,
  sourceWidth: number,
  sourceHeight: number,
): { x: number; y: number } | null {
  const fit = element.role === "cutout" ? (element.objectFit ?? "contain") : element.objectFit
  const scale =
    (fit === "contain"
      ? Math.min(element.width / sourceWidth, element.height / sourceHeight)
      : Math.max(element.width / sourceWidth, element.height / sourceHeight)) * (element.photoScale ?? 1)
  if (!Number.isFinite(scale) || scale <= 0) return null
  const drawW = sourceWidth * scale
  const drawH = sourceHeight * scale
  const limitX = Math.abs(drawW - element.width) / 2
  const limitY = Math.abs(drawH - element.height) / 2
  const dx = (element.width - drawW) / 2 + Math.min(limitX, Math.max(-limitX, element.panX ?? 0))
  const dy = (element.height - drawH) / 2 + Math.min(limitY, Math.max(-limitY, element.panY ?? 0))
  let x = (localX - dx) / scale
  let y = (localY - dy) / scale
  if (element.flipX) x = sourceWidth - x
  if (element.flipY) y = sourceHeight - y
  if (x < 0 || y < 0 || x >= sourceWidth || y >= sourceHeight) return null
  return { x, y }
}

export async function openRetouch(element: PhotoElement): Promise<{ width: number; height: number } | null> {
  if (!element.imageUrl) return null
  if (session?.id === element.id) return { width: session.canvas.width, height: session.canvas.height }
  const image = await loadHtmlImage(element.imageUrl)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight, 1))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  session = {
    id: element.id,
    canvas,
    pixels,
    base: new Uint8ClampedArray(pixels.data),
    clone: null,
    offset: null,
  }
  return { width: canvas.width, height: canvas.height }
}

export function retouchCanvas(): HTMLCanvasElement | null {
  return session?.canvas ?? null
}

export function setCloneSource(x: number, y: number): void {
  if (!session) return
  session.clone = { x, y }
  session.offset = null
}

export function hasCloneSource(): boolean {
  return Boolean(session?.clone)
}

export function paintRetouch(kind: RetouchBrush, x: number, y: number, radius: number): void {
  if (!session) return
  if (kind === "clone") {
    if (!session.clone) return
    if (!session.offset) session.offset = { x: session.clone.x - x, y: session.clone.y - y }
  }
  const data = session.pixels.data
  const width = session.pixels.width
  const height = session.pixels.height
  const left = Math.max(0, Math.floor(x - radius))
  const right = Math.min(width - 1, Math.ceil(x + radius))
  const top = Math.max(0, Math.floor(y - radius))
  const bottom = Math.min(height - 1, Math.ceil(y + radius))
  for (let py = top; py <= bottom; py += 1) {
    for (let px = left; px <= right; px += 1) {
      const dist = Math.hypot(px - x, py - y)
      if (dist > radius) continue
      const cover = 1 - dist / radius
      const index = (py * width + px) * 4
      if (data[index + 3] === 0) continue
      if (kind === "clone" && session.offset) {
        copyPixel(session.base, width, height, px + session.offset.x, py + session.offset.y, data, index, cover)
        continue
      }
      if (kind === "heal" || kind === "object") {
        blendAverage(data, width, height, px, py, radius + 3, index, cover * 0.85)
        continue
      }
      if (kind === "blemish") {
        if (isSkin(data[index], data[index + 1], data[index + 2])) blendAverage(data, width, height, px, py, radius, index, cover)
        continue
      }
      if (kind === "skin") {
        if (isSkin(data[index], data[index + 1], data[index + 2])) blendAverage(data, width, height, px, py, 4, index, cover * 0.75)
        continue
      }
      if (kind === "redeye") {
        dampRed(data, index, cover)
        continue
      }
      if (kind === "teeth") {
        whitenTooth(data, index, cover)
        continue
      }
      if (kind === "eye") {
        clarify(data, index, cover)
        continue
      }
      if (kind === "blur") {
        blendAverage(data, width, height, px, py, 3, index, cover * 0.8)
        continue
      }
      saturatePixel(data, index, cover * 0.45)
    }
  }
  session.canvas.getContext("2d")?.putImageData(session.pixels, 0, 0)
}

export function finishRetouch(cutout: boolean): string | null {
  if (!session) return null
  const url = session.canvas.toDataURL(cutout ? "image/png" : "image/jpeg", 0.92)
  session = null
  return url
}

export function cancelRetouch(): void {
  session = null
}

export async function autoRetouch(element: PhotoElement, kind: "skin" | "face"): Promise<string | null> {
  if (!element.imageUrl) return null
  cancelRetouch()
  const image = await loadHtmlImage(element.imageUrl)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight, 1))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  smoothSkin(frame, kind === "face" ? 0.62 : 0.5)
  ctx.putImageData(frame, 0, 0)
  return canvas.toDataURL(element.role === "cutout" ? "image/png" : "image/jpeg", 0.92)
}

function smoothSkin(frame: ImageData, amount: number): void {
  const { data, width, height } = frame
  const copy = new Uint8ClampedArray(data)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4
      if (!isSkin(copy[index], copy[index + 1], copy[index + 2])) continue
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const sample = ((y + oy) * width + (x + ox)) * 4
          r += copy[sample]
          g += copy[sample + 1]
          b += copy[sample + 2]
          count += 1
        }
      }
      data[index] = mix(copy[index], r / count, amount)
      data[index + 1] = mix(copy[index + 1], g / count, amount)
      data[index + 2] = mix(copy[index + 2], b / count, amount)
    }
  }
}

function blendAverage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  reach: number,
  index: number,
  cover: number,
): void {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const step = Math.max(1, Math.round(reach / 3))
  for (let oy = -reach; oy <= reach; oy += step) {
    const sy = y + oy
    if (sy < 0 || sy >= height) continue
    for (let ox = -reach; ox <= reach; ox += step) {
      const sx = x + ox
      if (sx < 0 || sx >= width) continue
      if (Math.hypot(ox, oy) < reach * 0.45) continue
      const sample = (sy * width + sx) * 4
      if (data[sample + 3] === 0) continue
      r += data[sample]
      g += data[sample + 1]
      b += data[sample + 2]
      count += 1
    }
  }
  if (!count) return
  data[index] = mix(data[index], r / count, cover)
  data[index + 1] = mix(data[index + 1], g / count, cover)
  data[index + 2] = mix(data[index + 2], b / count, cover)
}

function copyPixel(
  base: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  data: Uint8ClampedArray,
  index: number,
  cover: number,
): void {
  const sx = Math.round(x)
  const sy = Math.round(y)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return
  const sample = (sy * width + sx) * 4
  data[index] = mix(data[index], base[sample], cover)
  data[index + 1] = mix(data[index + 1], base[sample + 1], cover)
  data[index + 2] = mix(data[index + 2], base[sample + 2], cover)
  data[index + 3] = mix(data[index + 3], base[sample + 3], cover)
}

function dampRed(data: Uint8ClampedArray, index: number, cover: number): void {
  const r = data[index]
  const g = data[index + 1]
  const b = data[index + 2]
  if (r < 80 || r < g * 1.35 || r < b * 1.35) return
  data[index] = mix(r, (g + b) / 2, cover)
}

function whitenTooth(data: Uint8ClampedArray, index: number, cover: number): void {
  const r = data[index]
  const g = data[index + 1]
  const b = data[index + 2]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (r + g + b) / 3
  const sat = max === 0 ? 0 : (max - min) / max
  if (light < 165 || sat > 0.38 || sat < 0.03 || b > g) return
  data[index] = mix(r, Math.min(255, r + 8), cover)
  data[index + 1] = mix(g, Math.min(255, g + 10), cover)
  data[index + 2] = mix(b, Math.min(255, b + 28), cover)
}

function clarify(data: Uint8ClampedArray, index: number, cover: number): void {
  const amount = cover * 0.55
  data[index] = mix(data[index], (data[index] - 128) * 1.35 + 128, amount)
  data[index + 1] = mix(data[index + 1], (data[index + 1] - 128) * 1.35 + 128, amount)
  data[index + 2] = mix(data[index + 2], (data[index + 2] - 128) * 1.35 + 128, amount)
  saturatePixel(data, index, cover * 0.35)
}

function saturatePixel(data: Uint8ClampedArray, index: number, amount: number): void {
  const r = data[index]
  const g = data[index + 1]
  const b = data[index + 2]
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
  data[index] = mix(r, gray + (r - gray) * 1.8, amount)
  data[index + 1] = mix(g, gray + (g - gray) * 1.8, amount)
  data[index + 2] = mix(b, gray + (b - gray) * 1.8, amount)
}

function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12 && r - b > 12 && Math.abs(r - g) < 90
}

function mix(from: number, to: number, amount: number): number {
  const value = from + (to - from) * amount
  return value < 0 ? 0 : value > 255 ? 255 : value
}
