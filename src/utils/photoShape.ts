import type { PhotoShape } from "../models/template"

export function polaroidInsets(width: number, height: number) {
  return {
    left: width * 0.07,
    top: height * 0.065,
    right: width * 0.07,
    bottom: height * 0.2,
  }
}

export function clipPhotoShape(
  ctx: CanvasRenderingContext2D,
  shape: PhotoShape,
  width: number,
  height: number,
  cornerRadius = 0,
  inset = 0,
): void {
  const radius = Math.min(cornerRadius, width / 2, height / 2)
  ctx.beginPath()

  if (shape === "circle") {
    const ring = Math.max(1, Math.min(width, height) / 2 - inset)
    ctx.ellipse(width / 2, height / 2, ring, ring, 0, 0, Math.PI * 2)
  } else if (shape === "oval") {
    ctx.ellipse(
      width / 2,
      height / 2,
      Math.max(1, width / 2 - inset),
      Math.max(1, height / 2 - inset),
      0,
      0,
      Math.PI * 2,
    )
  } else if (shape === "rounded") {
    ctx.roundRect(0, 0, width, height, radius)
  } else if (shape === "arch") {
    const r = Math.min(width / 2, Math.max(0, cornerRadius))
    const bodyTop = r
    ctx.moveTo(0, height)
    ctx.lineTo(0, bodyTop)
    ctx.arc(width / 2, bodyTop, r, Math.PI, 0)
    ctx.lineTo(width, height)
    ctx.closePath()
  } else if (shape === "polaroid") {
    const inset = polaroidInsets(width, height)
    ctx.rect(inset.left, inset.top, width - inset.left - inset.right, height - inset.top - inset.bottom)
  } else if (shape === "organic") {
    ctx.moveTo(width * 0.16, height * 0.24)
    ctx.bezierCurveTo(width * 0.04, height * 0.06, width * 0.38, 0, width * 0.58, height * 0.08)
    ctx.bezierCurveTo(width * 0.88, height * 0.04, width * 1.03, height * 0.32, width * 0.96, height * 0.52)
    ctx.bezierCurveTo(width * 1.04, height * 0.8, width * 0.74, height * 1.03, width * 0.48, height * 0.93)
    ctx.bezierCurveTo(width * 0.16, height * 1.05, width * -0.04, height * 0.7, width * 0.07, height * 0.44)
    ctx.bezierCurveTo(width * 0.02, height * 0.32, width * 0.08, height * 0.28, width * 0.16, height * 0.24)
    ctx.closePath()
  } else if (shape === "diagonal-left") {
    const cut = width * 0.16
    ctx.moveTo(cut, 0)
    ctx.lineTo(width, 0)
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
  } else if (shape === "diagonal-right") {
    const cut = width * 0.16
    ctx.moveTo(0, 0)
    ctx.lineTo(width - cut, 0)
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
  } else {
    ctx.rect(0, 0, width, height)
  }
}

export function toCanvasBlendMode(blendMode: string | undefined): GlobalCompositeOperation {
  if (blendMode === "soft-light") return "soft-light"
  if (blendMode === "hard-light") return "hard-light"
  if (blendMode === "color-burn") return "color-burn"
  if (blendMode === "color-dodge") return "color-dodge"
  if (
    blendMode === "multiply" ||
    blendMode === "screen" ||
    blendMode === "overlay" ||
    blendMode === "darken" ||
    blendMode === "lighten" ||
    blendMode === "difference" ||
    blendMode === "exclusion" ||
    blendMode === "hue" ||
    blendMode === "saturation" ||
    blendMode === "color" ||
    blendMode === "luminosity"
  ) {
    return blendMode
  }
  return "source-over"
}

export function toPsdBlendMode(
  blendMode: string | undefined,
):
  | "normal"
  | "darken"
  | "multiply"
  | "color burn"
  | "lighten"
  | "screen"
  | "color dodge"
  | "overlay"
  | "soft light"
  | "hard light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity" {
  if (blendMode === "soft-light") return "soft light"
  if (blendMode === "hard-light") return "hard light"
  if (blendMode === "color-burn") return "color burn"
  if (blendMode === "color-dodge") return "color dodge"
  if (
    blendMode === "darken" ||
    blendMode === "multiply" ||
    blendMode === "lighten" ||
    blendMode === "screen" ||
    blendMode === "overlay" ||
    blendMode === "difference" ||
    blendMode === "exclusion" ||
    blendMode === "hue" ||
    blendMode === "saturation" ||
    blendMode === "color" ||
    blendMode === "luminosity"
  ) {
    return blendMode
  }
  return "normal"
}
