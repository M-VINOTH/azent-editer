import type { DecorationElement, PhotoShape } from "../models/template"

export function shapeSvgUrl(shape: PhotoShape, fill: string, width: number, height: number): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${shapeMarkup(shape, w, h, fill)}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function decorationSource(element: DecorationElement): string {
  if (element.shape && element.fill) return shapeSvgUrl(element.shape, element.fill, element.width, element.height)
  return element.assetUrl
}

type StrokePoint = { x: number; y: number }

export function markStrokeWidth(kind: "pencil" | "brush", sheet: number): number {
  return Math.max(kind === "brush" ? 48 : 8, Math.round(sheet * (kind === "brush" ? 0.035 : 0.004)))
}

/** Two light passes take the shake out of a freehand stroke without cutting corners off. */
export function smoothStrokePoints(points: StrokePoint[]): StrokePoint[] {
  if (points.length < 3) return points
  let current = points
  for (let pass = 0; pass < 2; pass += 1) {
    const next = [current[0]]
    for (let index = 1; index < current.length - 1; index += 1) {
      next.push({
        x: current[index - 1].x * 0.2 + current[index].x * 0.6 + current[index + 1].x * 0.2,
        y: current[index - 1].y * 0.2 + current[index].y * 0.6 + current[index + 1].y * 0.2,
      })
    }
    next.push(current[current.length - 1])
    current = next
  }
  return current
}

function curvePath(points: StrokePoint[], close: boolean): string {
  const rounded = points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))
  if (rounded.length < 2) return ""
  if (rounded.length === 2) {
    return `M${rounded[0].x} ${rounded[0].y} L${rounded[1].x} ${rounded[1].y}${close ? " Z" : ""}`
  }
  const parts = [`M${rounded[0].x} ${rounded[0].y}`]
  for (let index = 0; index < rounded.length - 1; index += 1) {
    const p0 = rounded[Math.max(0, index - 1)]
    const p1 = rounded[index]
    const p2 = rounded[index + 1]
    const p3 = rounded[Math.min(rounded.length - 1, index + 2)]
    const c1x = Math.round(p1.x + (p2.x - p0.x) / 6)
    const c1y = Math.round(p1.y + (p2.y - p0.y) / 6)
    const c2x = Math.round(p2.x - (p3.x - p1.x) / 6)
    const c2y = Math.round(p2.y - (p3.y - p1.y) / 6)
    parts.push(`C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`)
  }
  if (close) parts.push("Z")
  return parts.join(" ")
}

function traceSmooth(ctx: CanvasRenderingContext2D, points: StrokePoint[], close: boolean): void {
  ctx.beginPath()
  if (points.length < 2) return
  ctx.moveTo(points[0].x, points[0].y)
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y)
  } else {
    for (let index = 0; index < points.length - 1; index += 1) {
      const p0 = points[Math.max(0, index - 1)]
      const p1 = points[index]
      const p2 = points[index + 1]
      const p3 = points[Math.min(points.length - 1, index + 2)]
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6,
        p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,
        p2.y - (p3.y - p1.y) / 6,
        p2.x,
        p2.y,
      )
    }
  }
  if (close) ctx.closePath()
}

export function paintLiveStroke(
  ctx: CanvasRenderingContext2D,
  view: number[] | null | undefined,
  points: StrokePoint[],
  color: string,
  strokeWidth: number,
  fillClosed: boolean,
): void {
  if (!view || points.length === 0) return
  const toScreen = (point: StrokePoint) => ({
    x: point.x * view[0] + point.y * view[2] + view[4],
    y: point.x * view[1] + point.y * view[3] + view[5],
  })
  const smoothed = smoothStrokePoints(points).map(toScreen)
  const filled = fillClosed && enclosesShape(points)
  const zoom = Math.hypot(view[0], view[1]) || 1
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1, strokeWidth * zoom)
  if (smoothed.length === 1) {
    ctx.beginPath()
    ctx.arc(smoothed[0].x, smoothed[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    traceSmooth(ctx, smoothed, filled)
    if (filled) ctx.fill()
    else ctx.stroke()
  }
  ctx.restore()
}

function enclosesShape(points: { x: number; y: number }[]): boolean {
  if (points.length < 3) return false
  const first = points[0]
  const last = points[points.length - 1]
  const gap = Math.hypot(last.x - first.x, last.y - first.y)
  let perimeter = 0
  for (let index = 1; index < points.length; index += 1) {
    perimeter += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
  }
  return perimeter > 0 && gap < perimeter * 0.35
}

export function strokeGraphic(
  points: { x: number; y: number }[],
  color: string,
  strokeWidth: number,
  fillClosed = false,
): { url: string; x: number; y: number; width: number; height: number; filled: boolean } {
  const filled = fillClosed && enclosesShape(points)
  const width = Math.max(2, Math.round(strokeWidth))
  const pad = filled ? 2 : Math.ceil(width / 2) + 2
  const safe = points.length > 0 ? points : [{ x: 0, y: 0 }]
  const minX = Math.min(...safe.map((point) => point.x)) - pad
  const minY = Math.min(...safe.map((point) => point.y)) - pad
  const maxX = Math.max(...safe.map((point) => point.x)) + pad
  const maxY = Math.max(...safe.map((point) => point.y)) + pad
  const boxWidth = Math.max(1, Math.round(maxX - minX))
  const boxHeight = Math.max(1, Math.round(maxY - minY))
  const ink = color.replace(/"/g, "")
  const local = smoothStrokePoints(safe).map((point) => ({ x: point.x - minX, y: point.y - minY }))
  const path = curvePath(local, filled)
  const body =
    safe.length < 2
      ? `<circle cx="${pad}" cy="${pad}" r="${width / 2}" fill="${ink}"/>`
      : filled
        ? `<path d="${path}" fill="${ink}"/>`
        : `<path d="${path}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}">${body}</svg>`
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    x: Math.round(minX),
    y: Math.round(minY),
    width: boxWidth,
    height: boxHeight,
    filled,
  }
}

export function shapeSize(shape: PhotoShape, longEdge: number): { width: number; height: number } {
  const edge = Math.max(80, Math.round(longEdge))
  if (shape === "circle" || shape === "organic") return { width: edge, height: edge }
  if (shape === "oval") return { width: Math.round(edge * 1.4), height: Math.round(edge * 0.86) }
  if (shape === "arch" || shape === "polaroid") return { width: Math.round(edge * 0.78), height: Math.round(edge * 1.12) }
  if (shape === "diagonal-left" || shape === "diagonal-right") return { width: Math.round(edge * 1.3), height: Math.round(edge * 0.9) }
  return { width: Math.round(edge * 1.25), height: Math.round(edge * 0.82) }
}

function shapeMarkup(shape: PhotoShape, w: number, h: number, fill: string): string {
  const color = fill.replace(/"/g, "")
  if (shape === "circle") {
    const r = Math.min(w, h) / 2
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${r}" ry="${r}" fill="${color}"/>`
  }
  if (shape === "oval") {
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${color}"/>`
  }
  if (shape === "rounded") {
    const r = Math.min(w, h) * 0.12
    return `<rect width="${w}" height="${h}" rx="${r}" fill="${color}"/>`
  }
  if (shape === "arch") {
    const r = w / 2
    return `<path fill="${color}" d="M0 ${h} L0 ${r} A ${r} ${r} 0 0 1 ${w} ${r} L${w} ${h} Z"/>`
  }
  if (shape === "polaroid") {
    const left = w * 0.07
    const top = h * 0.065
    const right = w * 0.07
    const bottom = h * 0.2
    return `<rect width="${w}" height="${h}" rx="${Math.min(w, h) * 0.035}" fill="#fbf7f1"/><rect x="${left}" y="${top}" width="${w - left - right}" height="${h - top - bottom}" fill="${color}"/>`
  }
  if (shape === "organic") {
    return `<path fill="${color}" d="M${w * 0.16} ${h * 0.24} C${w * 0.04} ${h * 0.06} ${w * 0.38} 0 ${w * 0.58} ${h * 0.08} C${w * 0.88} ${h * 0.04} ${w * 1.03} ${h * 0.32} ${w * 0.96} ${h * 0.52} C${w * 1.04} ${h * 0.8} ${w * 0.74} ${h * 1.03} ${w * 0.48} ${h * 0.93} C${w * 0.16} ${h * 1.05} ${w * -0.04} ${h * 0.7} ${w * 0.07} ${h * 0.44} C${w * 0.02} ${h * 0.32} ${w * 0.08} ${h * 0.28} ${w * 0.16} ${h * 0.24} Z"/>`
  }
  if (shape === "diagonal-left") {
    const cut = w * 0.16
    return `<path fill="${color}" d="M${cut} 0 L${w} 0 L${w} ${h} L0 ${h} Z"/>`
  }
  if (shape === "diagonal-right") {
    const cut = w * 0.16
    return `<path fill="${color}" d="M0 0 L${w - cut} 0 L${w} ${h} L0 ${h} Z"/>`
  }
  return `<rect width="${w}" height="${h}" fill="${color}"/>`
}
