import type { LayerMask, MaskPoint, TemplateElement } from "../models/template"
import { loadHtmlImage } from "./photoRaster"

export type MaskPreset = "rectangle" | "circle" | "rounded" | "polygon" | "custom" | "vector" | "png"

export type MaskGesture =
  | { type: "move" }
  | { type: "resize"; corner: "nw" | "ne" | "sw" | "se" }
  | { type: "rotate" }
  | { type: "point"; index: number }

type BoxElement = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  mask?: LayerMask
}

export function createMask(preset: MaskPreset, width: number, height: number): LayerMask {
  const insetX = width * 0.14
  const insetY = height * 0.14
  const box = {
    x: insetX,
    y: insetY,
    width: Math.max(40, width - insetX * 2),
    height: Math.max(40, height - insetY * 2),
    rotation: 0,
    feather: 0,
    inverted: false,
  }
  if (preset === "circle") return { ...box, kind: "circle" }
  if (preset === "rounded") return { ...box, kind: "rounded", cornerRadius: Math.min(box.width, box.height) * 0.18 }
  if (preset === "polygon") return { ...box, kind: "polygon", points: regularPolygon(6) }
  if (preset === "custom") return { ...box, kind: "path", smooth: true, points: regularPolygon(6) }
  if (preset === "vector") {
    return {
      ...box,
      kind: "path",
      smooth: false,
      points: [
        { x: 0.08, y: 0.08 },
        { x: 0.92, y: 0.08 },
        { x: 0.92, y: 0.92 },
        { x: 0.08, y: 0.92 },
      ],
    }
  }
  if (preset === "png") return { x: 0, y: 0, width, height, rotation: 0, feather: 0, inverted: false, kind: "png" }
  return { ...box, kind: "rectangle" }
}

export function regularPolygon(sides: number): MaskPoint[] {
  const points: MaskPoint[] = []
  for (let index = 0; index < sides; index += 1) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / sides
    points.push({ x: 0.5 + Math.cos(angle) * 0.42, y: 0.5 + Math.sin(angle) * 0.42 })
  }
  return points
}

export async function withLayerMask(canvas: HTMLCanvasElement, element: { width: number; height: number; mask?: LayerMask }): Promise<void> {
  const mask = element.mask
  if (!mask) return
  if (mask.kind === "png" && !mask.imageUrl) return
  if ((mask.kind === "polygon" || mask.kind === "path") && (mask.points?.length ?? 0) < 3) return
  const png = mask.kind === "png" && mask.imageUrl ? await loadHtmlImage(mask.imageUrl).catch(() => null) : null
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  applyLayerMask(ctx, canvas.width, canvas.height, element.width, element.height, mask, png)
}

export function applyLayerMask(
  ctx: CanvasRenderingContext2D,
  pixelWidth: number,
  pixelHeight: number,
  elementWidth: number,
  elementHeight: number,
  mask: LayerMask,
  png: HTMLImageElement | null,
): void {
  const scaleX = pixelWidth / Math.max(elementWidth, 1)
  const scaleY = pixelHeight / Math.max(elementHeight, 1)
  const maskCanvas = document.createElement("canvas")
  maskCanvas.width = Math.max(1, pixelWidth)
  maskCanvas.height = Math.max(1, pixelHeight)
  const maskCtx = maskCanvas.getContext("2d")
  if (!maskCtx) return
  const boxW = Math.max(1, mask.width * scaleX)
  const boxH = Math.max(1, mask.height * scaleY)
  maskCtx.save()
  maskCtx.translate((mask.x + mask.width / 2) * scaleX, (mask.y + mask.height / 2) * scaleY)
  maskCtx.rotate((mask.rotation * Math.PI) / 180)
  maskCtx.translate(-boxW / 2, -boxH / 2)
  traceMask(maskCtx, mask, boxW, boxH, png)
  maskCtx.restore()

  const feather = Math.max(0, mask.feather) * ((scaleX + scaleY) / 2)
  const source = feather > 0.5 ? blurCanvas(maskCanvas, feather) : maskCanvas
  ctx.save()
  ctx.globalCompositeOperation = mask.inverted ? "destination-out" : "destination-in"
  ctx.drawImage(source, 0, 0)
  ctx.restore()
}

export function layerLocalPoint(element: BoxElement, designX: number, designY: number): { x: number; y: number } {
  const centerX = element.x + element.width / 2
  const centerY = element.y + element.height / 2
  const rad = (-element.rotation * Math.PI) / 180
  const dx = designX - centerX
  const dy = designY - centerY
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad) + element.width / 2,
    y: dx * Math.sin(rad) + dy * Math.cos(rad) + element.height / 2,
  }
}

export function maskNormalized(mask: LayerMask, local: { x: number; y: number }): MaskPoint {
  const rel = maskLocalPoint(mask, local.x, local.y)
  return {
    x: rel.x / Math.max(mask.width, 1),
    y: rel.y / Math.max(mask.height, 1),
  }
}

export function hitMask(element: BoxElement, designX: number, designY: number, slop: number): MaskGesture | null {
  const mask = element.mask
  if (!mask) return null
  const local = layerLocalPoint(element, designX, designY)
  const point = maskLocalPoint(mask, local.x, local.y)
  if (mask.kind === "polygon" || mask.kind === "path") {
    const points = mask.points ?? []
    for (let index = 0; index < points.length; index += 1) {
      const px = points[index].x * mask.width
      const py = points[index].y * mask.height
      if (Math.hypot(point.x - px, point.y - py) <= slop) return { type: "point", index }
    }
  }
  const handle = { x: mask.width / 2, y: -slop * 2.2 }
  if (Math.hypot(point.x - handle.x, point.y - handle.y) <= slop) return { type: "rotate" }
  const corners: { corner: "nw" | "ne" | "sw" | "se"; x: number; y: number }[] = [
    { corner: "nw", x: 0, y: 0 },
    { corner: "ne", x: mask.width, y: 0 },
    { corner: "sw", x: 0, y: mask.height },
    { corner: "se", x: mask.width, y: mask.height },
  ]
  for (const corner of corners) {
    if (Math.hypot(point.x - corner.x, point.y - corner.y) <= slop) return { type: "resize", corner: corner.corner }
  }
  if (point.x >= -slop && point.y >= -slop && point.x <= mask.width + slop && point.y <= mask.height + slop) return { type: "move" }
  return null
}

export function moveMask(
  origin: LayerMask,
  gesture: MaskGesture,
  startLocal: { x: number; y: number },
  local: { x: number; y: number },
): LayerMask {
  const dx = local.x - startLocal.x
  const dy = local.y - startLocal.y
  if (gesture.type === "move") {
    return { ...origin, x: origin.x + dx, y: origin.y + dy }
  }
  if (gesture.type === "rotate") {
    const centerX = origin.x + origin.width / 2
    const centerY = origin.y + origin.height / 2
    const start = Math.atan2(startLocal.y - centerY, startLocal.x - centerX)
    const next = Math.atan2(local.y - centerY, local.x - centerX)
    return { ...origin, rotation: origin.rotation + ((next - start) * 180) / Math.PI }
  }
  if (gesture.type === "point") {
    const rel = maskLocalPoint(origin, local.x, local.y)
    const points = (origin.points ?? []).map((point, index) =>
      index === gesture.index
        ? { x: rel.x / Math.max(origin.width, 1), y: rel.y / Math.max(origin.height, 1) }
        : point,
    )
    return { ...origin, points }
  }
  const rad = (-origin.rotation * Math.PI) / 180
  const mdx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const mdy = dx * Math.sin(rad) + dy * Math.cos(rad)
  return resizeMask(origin, gesture.corner, mdx, mdy)
}

export function paintMaskOverlay(
  ctx: CanvasRenderingContext2D,
  view: number[] | null | undefined,
  element: BoxElement,
): void {
  const mask = element.mask
  const outline = maskOutline(element)
  if (!mask || !outline || !view) return
  const toScreen = (point: { x: number; y: number }) => ({
    x: point.x * view[0] + point.y * view[2] + view[4],
    y: point.x * view[1] + point.y * view[3] + view[5],
  })
  ctx.save()
  ctx.strokeStyle = "#2f6fed"
  ctx.fillStyle = "#ffffff"
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  outline.corners.forEach((corner, index) => {
    const screen = toScreen(corner)
    if (index === 0) ctx.moveTo(screen.x, screen.y)
    else ctx.lineTo(screen.x, screen.y)
  })
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])
  const top = toScreen(outline.corners[0])
  const rotate = toScreen(outline.rotate)
  ctx.beginPath()
  ctx.moveTo((top.x + toScreen(outline.corners[1]).x) / 2, (top.y + toScreen(outline.corners[1]).y) / 2)
  ctx.lineTo(rotate.x, rotate.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(rotate.x, rotate.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  for (const corner of outline.corners) {
    const screen = toScreen(corner)
    ctx.strokeRect(screen.x - 4, screen.y - 4, 8, 8)
    ctx.fillRect(screen.x - 3, screen.y - 3, 6, 6)
  }
  if (mask.kind === "polygon" || mask.kind === "path") {
    ctx.fillStyle = "#2f6fed"
    for (const point of outline.points) {
      const screen = toScreen(point)
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

export function maskOutline(element: BoxElement): { corners: { x: number; y: number }[]; rotate: { x: number; y: number }; points: { x: number; y: number }[] } | null {
  const mask = element.mask
  if (!mask) return null
  const corners = [
    maskPointToDesign(element, mask, 0, 0),
    maskPointToDesign(element, mask, mask.width, 0),
    maskPointToDesign(element, mask, mask.width, mask.height),
    maskPointToDesign(element, mask, 0, mask.height),
  ]
  const rotate = maskPointToDesign(element, mask, mask.width / 2, -28)
  const points = (mask.points ?? []).map((point) => maskPointToDesign(element, mask, point.x * mask.width, point.y * mask.height))
  return { corners, rotate, points }
}

export function clippingBase(elements: TemplateElement[], element: TemplateElement): TemplateElement | null {
  const ordered = [...elements].filter((item) => item.type !== "group").sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
  const index = ordered.findIndex((item) => item.id === element.id)
  if (index <= 0) return null
  let cursor = index - 1
  while (cursor >= 0 && ordered[cursor].clipping) cursor -= 1
  return cursor >= 0 ? ordered[cursor] : null
}

function resizeMask(origin: LayerMask, corner: "nw" | "ne" | "sw" | "se", mdx: number, mdy: number): LayerMask {
  const min = 24
  let left = 0
  let top = 0
  let right = origin.width
  let bottom = origin.height
  if (corner === "se" || corner === "ne") right = Math.max(left + min, right + mdx)
  else left = Math.min(right - min, left + mdx)
  if (corner === "se" || corner === "sw") bottom = Math.max(top + min, bottom + mdy)
  else top = Math.min(bottom - min, top + mdy)
  const width = right - left
  const height = bottom - top
  const anchor = corner === "se" ? { x: 0, y: 0 } : corner === "nw" ? { x: origin.width, y: origin.height } : corner === "ne" ? { x: 0, y: origin.height } : { x: origin.width, y: 0 }
  const anchorLayer = maskLocalToLayer(origin, anchor.x, anchor.y)
  const anchorNext = { x: anchor.x - left, y: anchor.y - top }
  const rad = (origin.rotation * Math.PI) / 180
  const dx = anchorNext.x - width / 2
  const dy = anchorNext.y - height / 2
  const centerX = anchorLayer.x - (dx * Math.cos(rad) - dy * Math.sin(rad))
  const centerY = anchorLayer.y - (dx * Math.sin(rad) + dy * Math.cos(rad))
  return { ...origin, x: centerX - width / 2, y: centerY - height / 2, width, height }
}

function maskLocalToLayer(mask: LayerMask, maskX: number, maskY: number): { x: number; y: number } {
  const rad = (mask.rotation * Math.PI) / 180
  const dx = maskX - mask.width / 2
  const dy = maskY - mask.height / 2
  return {
    x: mask.x + mask.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: mask.y + mask.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

function maskPointToDesign(element: BoxElement, mask: LayerMask, maskX: number, maskY: number): { x: number; y: number } {
  const rad = (mask.rotation * Math.PI) / 180
  const dx = maskX - mask.width / 2
  const dy = maskY - mask.height / 2
  const localX = mask.x + mask.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad)
  const localY = mask.y + mask.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad)
  const centerX = element.x + element.width / 2
  const centerY = element.y + element.height / 2
  const layer = (element.rotation * Math.PI) / 180
  const ox = localX - element.width / 2
  const oy = localY - element.height / 2
  return {
    x: centerX + ox * Math.cos(layer) - oy * Math.sin(layer),
    y: centerY + ox * Math.sin(layer) + oy * Math.cos(layer),
  }
}

function maskLocalPoint(mask: LayerMask, localX: number, localY: number): { x: number; y: number } {
  const centerX = mask.x + mask.width / 2
  const centerY = mask.y + mask.height / 2
  const rad = (-mask.rotation * Math.PI) / 180
  const dx = localX - centerX
  const dy = localY - centerY
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad) + mask.width / 2,
    y: dx * Math.sin(rad) + dy * Math.cos(rad) + mask.height / 2,
  }
}

function traceMask(
  ctx: CanvasRenderingContext2D,
  mask: LayerMask,
  width: number,
  height: number,
  png: HTMLImageElement | null,
): void {
  if (mask.kind === "png") {
    if (!png) return
    drawPngMask(ctx, png, width, height)
    return
  }
  ctx.beginPath()
  if (mask.kind === "circle") {
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
  } else if (mask.kind === "rounded") {
    const radius = Math.min(mask.cornerRadius ?? Math.min(width, height) * 0.16, width / 2, height / 2)
    ctx.roundRect(0, 0, width, height, radius)
  } else if (mask.kind === "polygon" || mask.kind === "path") {
    const points = mask.points ?? []
    if (points.length < 3) return
    if (mask.kind === "path" && mask.smooth) traceSmooth(ctx, points, width, height)
    else traceStraight(ctx, points, width, height)
  } else {
    ctx.rect(0, 0, width, height)
  }
  ctx.fillStyle = "#fff"
  ctx.fill()
}

function traceStraight(ctx: CanvasRenderingContext2D, points: MaskPoint[], width: number, height: number): void {
  points.forEach((point, index) => {
    const x = point.x * width
    const y = point.y * height
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

function traceSmooth(ctx: CanvasRenderingContext2D, points: MaskPoint[], width: number, height: number): void {
  const mapped = points.map((point) => ({ x: point.x * width, y: point.y * height }))
  const first = mapped[0]
  const last = mapped[mapped.length - 1]
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let index = 0; index < mapped.length; index += 1) {
    const current = mapped[index]
    const next = mapped[(index + 1) % mapped.length]
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2)
  }
  ctx.closePath()
}

function drawPngMask(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  ctx.drawImage(image, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, Math.round(width), Math.round(height))
  let shaped = false
  for (let index = 3; index < pixels.data.length; index += 16) {
    if (pixels.data[index] < 250) {
      shaped = true
      break
    }
  }
  if (shaped) return
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luma = pixels.data[index] * 0.2126 + pixels.data[index + 1] * 0.7152 + pixels.data[index + 2] * 0.0722
    pixels.data[index] = 255
    pixels.data[index + 1] = 255
    pixels.data[index + 2] = 255
    pixels.data[index + 3] = luma
  }
  ctx.putImageData(pixels, 0, 0)
}

function blurCanvas(source: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return source
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(source, 0, 0)
  ctx.filter = "none"
  return canvas
}
