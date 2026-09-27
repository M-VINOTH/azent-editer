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

export function strokeGraphic(
  points: { x: number; y: number }[],
  color: string,
  strokeWidth: number,
): { url: string; x: number; y: number; width: number; height: number } {
  const width = Math.max(2, Math.round(strokeWidth))
  const pad = Math.ceil(width / 2) + 2
  const safe = points.length > 0 ? points : [{ x: 0, y: 0 }]
  const minX = Math.min(...safe.map((point) => point.x)) - pad
  const minY = Math.min(...safe.map((point) => point.y)) - pad
  const maxX = Math.max(...safe.map((point) => point.x)) + pad
  const maxY = Math.max(...safe.map((point) => point.y)) + pad
  const boxWidth = Math.max(1, Math.round(maxX - minX))
  const boxHeight = Math.max(1, Math.round(maxY - minY))
  const ink = color.replace(/"/g, "")
  const body =
    safe.length < 2
      ? `<circle cx="${pad}" cy="${pad}" r="${width / 2}" fill="${ink}"/>`
      : `<path d="${safe
          .map((point, index) => `${index === 0 ? "M" : "L"}${Math.round(point.x - minX)} ${Math.round(point.y - minY)}`)
          .join(" ")}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}" viewBox="0 0 ${boxWidth} ${boxHeight}">${body}</svg>`
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    x: Math.round(minX),
    y: Math.round(minY),
    width: boxWidth,
    height: boxHeight,
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
