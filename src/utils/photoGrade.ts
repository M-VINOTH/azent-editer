import type { PhotoElement } from "../models/template"

export const PHOTO_GRADE_KEYS = [
  "exposure",
  "highlights",
  "shadows",
  "vibrance",
  "temperature",
  "tint",
  "sharpness",
  "vignette",
  "curveShadows",
  "curveMidtones",
  "curveHighlights",
  "levelsBlack",
  "levelsGamma",
  "levelsWhite",
  "hue",
  "balanceCyanRed",
  "balanceMagentaGreen",
  "balanceYellowBlue",
  "noise",
] as const

export type PhotoGradeKey = (typeof PHOTO_GRADE_KEYS)[number]

export function gradeActive(element: PhotoElement): boolean {
  return PHOTO_GRADE_KEYS.some((key) => (element[key] ?? 0) !== 0)
}

export function clearedGrade(): Pick<PhotoElement, PhotoGradeKey | "brightness" | "contrast" | "saturate" | "blur"> {
  const cleared = {
    brightness: 0,
    contrast: 0,
    saturate: 0,
    blur: 0,
  } as Pick<PhotoElement, PhotoGradeKey | "brightness" | "contrast" | "saturate" | "blur">
  for (const key of PHOTO_GRADE_KEYS) cleared[key] = 0
  return cleared
}

export function applyPhotoGrade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  element: PhotoElement,
): void {
  if (!gradeActive(element)) return
  const frame = ctx.getImageData(0, 0, width, height)
  const data = frame.data
  const blur = element.noise || element.sharpness ? boxBlur(data, width, height) : null
  const exposure = Math.pow(2, (element.exposure ?? 0) / 70)
  const black = ((element.levelsBlack ?? 0) / 100) * 90
  const white = 255 - ((element.levelsWhite ?? 0) / 100) * 90
  const span = Math.max(1, white - black)
  const gamma = Math.pow(2, -((element.levelsGamma ?? 0) / 100))
  const noise = (element.noise ?? 0) / 100
  const sharp = (element.sharpness ?? 0) / 100
  const hue = ((element.hue ?? 0) * Math.PI) / 180
  const hueOn = hue !== 0
  const cos = Math.cos(hue)
  const sin = Math.sin(hue)
  const vignette = (element.vignette ?? 0) / 100

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    if (data[index + 3] === 0) continue
    let r = data[index]
    let g = data[index + 1]
    let b = data[index + 2]
    if (blur && (noise || sharp)) {
      const br = blur[index]
      const bg = blur[index + 1]
      const bb = blur[index + 2]
      if (noise) {
        r = r * (1 - noise) + br * noise
        g = g * (1 - noise) + bg * noise
        b = b * (1 - noise) + bb * noise
      }
      if (sharp) {
        r += (r - br) * sharp * 1.5
        g += (g - bg) * sharp * 1.5
        b += (b - bb) * sharp * 1.5
      }
    }
    r *= exposure
    g *= exposure
    b *= exposure
    r = level(r, black, span, gamma)
    g = level(g, black, span, gamma)
    b = level(b, black, span, gamma)

    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    const shadowW = Math.max(0, 1 - lum * 2)
    const highW = Math.max(0, lum * 2 - 1)
    const midW = 1 - Math.abs(lum - 0.5) * 2
    const curve =
      ((element.curveShadows ?? 0) / 100) * 70 * shadowW +
      ((element.curveMidtones ?? 0) / 100) * 50 * midW +
      ((element.curveHighlights ?? 0) / 100) * 70 * highW
    const lift = ((element.shadows ?? 0) / 100) * 75 * shadowW + ((element.highlights ?? 0) / 100) * 75 * highW + curve
    r += lift
    g += lift
    b += lift

    const warm = (element.temperature ?? 0) / 100
    r += warm * 30
    g += warm * 8
    b -= warm * 34
    const tint = (element.tint ?? 0) / 100
    r += tint * 18
    b += tint * 18
    g -= tint * 24

    const cyanRed = ((element.balanceCyanRed ?? 0) / 100) * midW
    const magentaGreen = ((element.balanceMagentaGreen ?? 0) / 100) * midW
    const yellowBlue = ((element.balanceYellowBlue ?? 0) / 100) * midW
    r += cyanRed * 40 - magentaGreen * 20 + yellowBlue * 20
    g += magentaGreen * 40 - cyanRed * 20 + yellowBlue * 20
    b += -yellowBlue * 40 - cyanRed * 20 - magentaGreen * 20

    const vibrance = (element.vibrance ?? 0) / 100
    if (vibrance) {
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max <= 0 ? 0 : (max - min) / max
      const boost = vibrance * (1 - sat)
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r += (r - gray) * boost
      g += (g - gray) * boost
      b += (b - gray) * boost
    }
    if (hueOn) {
      const nr =
        r * (0.213 + cos * 0.787 - sin * 0.213) +
        g * (0.715 - cos * 0.715 - sin * 0.715) +
        b * (0.072 - cos * 0.072 + sin * 0.928)
      const ng =
        r * (0.213 - cos * 0.213 + sin * 0.143) +
        g * (0.715 + cos * 0.285 + sin * 0.14) +
        b * (0.072 - cos * 0.072 - sin * 0.283)
      const nb =
        r * (0.213 - cos * 0.213 - sin * 0.787) +
        g * (0.715 - cos * 0.715 + sin * 0.715) +
        b * (0.072 + cos * 0.928 + sin * 0.072)
      r = nr
      g = ng
      b = nb
    }
    if (vignette) {
      const x = pixel % width
      const y = (pixel - x) / width
      const dx = (x - width / 2) / (width / 2)
      const dy = (y - height / 2) / (height / 2)
      const falloff = Math.max(0, Math.sqrt(dx * dx + dy * dy) - 0.4) / 0.75
      const factor = 1 - vignette * falloff * falloff
      r *= factor
      g *= factor
      b *= factor
    }
    data[index] = clampByte(r)
    data[index + 1] = clampByte(g)
    data[index + 2] = clampByte(b)
  }
  ctx.putImageData(frame, 0, 0)
}

function level(value: number, black: number, span: number, gamma: number): number {
  const scaled = (value - black) / span
  return Math.pow(Math.min(1, Math.max(0, scaled)), gamma) * 255
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value
}

function boxBlur(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const next = new Uint8ClampedArray(data.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let oy = -1; oy <= 1; oy += 1) {
        const sy = y + oy
        if (sy < 0 || sy >= height) continue
        for (let ox = -1; ox <= 1; ox += 1) {
          const sx = x + ox
          if (sx < 0 || sx >= width) continue
          const index = (sy * width + sx) * 4
          r += data[index]
          g += data[index + 1]
          b += data[index + 2]
          count += 1
        }
      }
      const index = (y * width + x) * 4
      next[index] = r / count
      next[index + 1] = g / count
      next[index + 2] = b / count
      next[index + 3] = data[index + 3]
    }
  }
  return next
}
