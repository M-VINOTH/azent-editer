import type { Canvas, FabricObject, TOriginX, TOriginY } from "fabric"
import { getElementId } from "./canvasService"
import { useTemplateStore } from "../store/templateStore"

type Point = { x: number; y: number }
type Corners = { tl: Point; tr: Point; bl: Point; br: Point }
type Axis = "width" | "height"

type SizeGuide = {
  axis: Axis
  matchedAxis: Axis
  size: number
  self: Corners
  other: Corners
}

type ScaleTransform = {
  originX: TOriginX
  originY: TOriginY
  corner: string
  shiftKey: boolean
}

const guides: SizeGuide[] = []

export function clearSizeGuides(): void {
  guides.length = 0
}

export function snapLayerSize(canvas: Canvas, target: FabricObject, transform: ScaleTransform): string | null {
  guides.length = 0
  const zoom = canvas.getZoom() || 1
  const threshold = 12 / zoom
  const width = target.getScaledWidth()
  const height = target.getScaledHeight()
  if (width < 1 || height < 1) return null

  const activeIds = new Set(canvas.getActiveObjects().map((object) => getElementId(object)).filter((id): id is string => Boolean(id)))
  const ownId = getElementId(target)
  if (ownId) activeIds.add(ownId)
  const hidden = new Set(useTemplateStore.getState().hiddenIds)
  const others = useTemplateStore.getState().template.elements.filter((element) => !activeIds.has(element.id) && !hidden.has(element.id))
  if (others.length === 0) return null

  const center = target.getCenterPoint()
  const proportional = transform.shiftKey
  const edges = scaledEdges(transform.corner, proportional)
  const widthMatch = edges.x ? nearestSize(width, center, others, threshold) : null
  const heightMatch = edges.y ? nearestSize(height, center, others, threshold) : null

  let nextWidth = width
  let nextHeight = height
  let widthGuide: ReturnType<typeof nearestSize> = null
  let heightGuide: ReturnType<typeof nearestSize> = null

  if (proportional) {
    const widthDelta = widthMatch ? Math.abs(widthMatch.size - width) : Number.POSITIVE_INFINITY
    const heightDelta = heightMatch ? Math.abs(heightMatch.size - height) : Number.POSITIVE_INFINITY
    if (widthMatch && widthDelta <= heightDelta && width > 0) {
      const ratio = widthMatch.size / width
      nextWidth = widthMatch.size
      nextHeight = height * ratio
      widthGuide = widthMatch
    } else if (heightMatch && height > 0) {
      const ratio = heightMatch.size / height
      nextHeight = heightMatch.size
      nextWidth = width * ratio
      heightGuide = heightMatch
    }
  } else {
    if (widthMatch) {
      nextWidth = widthMatch.size
      widthGuide = widthMatch
    }
    if (heightMatch) {
      nextHeight = heightMatch.size
      heightGuide = heightMatch
    }
  }

  const snapped = Math.abs(nextWidth - width) > 0.01 || Math.abs(nextHeight - height) > 0.01
  if (snapped) {
    const anchor = target.getPositionByOrigin(transform.originX, transform.originY)
    if (width > 0 && Math.abs(nextWidth - width) > 0.01) target.set("scaleX", target.scaleX * (nextWidth / width))
    if (height > 0 && Math.abs(nextHeight - height) > 0.01) target.set("scaleY", target.scaleY * (nextHeight / height))
    target.setPositionByOrigin(anchor, transform.originX, transform.originY)
  }
  if (!widthGuide && !heightGuide) return null
  target.setCoords()

  const self = cornersFromObject(target)
  if (widthGuide && self) {
    guides.push({
      axis: "width",
      matchedAxis: widthGuide.axis,
      size: Math.round(nextWidth),
      self,
      other: cornersFromElement(widthGuide.element),
    })
  }
  if (heightGuide && self) {
    guides.push({
      axis: "height",
      matchedAxis: heightGuide.axis,
      size: Math.round(nextHeight),
      self,
      other: cornersFromElement(heightGuide.element),
    })
  }
  if (guides.length === 0) return null
  if (widthGuide && heightGuide) return "Width and height match a nearby layer"
  if (widthGuide) return "Width matches a nearby layer"
  return "Height matches a nearby layer"
}

export function paintSizeGuides(canvas: Canvas, ctx: CanvasRenderingContext2D): void {
  if (guides.length === 0) return
  const zoom = canvas.getZoom() || 1
  ctx.save()
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (const guide of guides) {
    const selfEdge = measureEdge(guide.self, guide.axis, zoom)
    const otherEdge = measureEdge(guide.other, guide.matchedAxis, zoom)
    strokeBracket(ctx, canvas, selfEdge, false)
    strokeBracket(ctx, canvas, otherEdge, true)
    strokeLink(ctx, canvas, selfEdge.mid, otherEdge.mid)
    paintLabel(ctx, canvas, selfEdge.mid, guide.size)
  }
  ctx.restore()
}

function scaledEdges(corner: string, proportional: boolean): { x: boolean; y: boolean } {
  if (proportional) return { x: true, y: true }
  if (corner === "ml" || corner === "mr") return { x: true, y: false }
  if (corner === "mt" || corner === "mb") return { x: false, y: true }
  return { x: true, y: true }
}

function nearestSize(
  current: number,
  center: Point,
  others: { x: number; y: number; width: number; height: number; rotation: number }[],
  threshold: number,
): { size: number; axis: Axis; element: (typeof others)[number]; distance: number } | null {
  let best: { size: number; axis: Axis; element: (typeof others)[number]; distance: number } | null = null
  for (const element of others) {
    const distance = Math.hypot(element.x + element.width / 2 - center.x, element.y + element.height / 2 - center.y)
    for (const axis of ["width", "height"] as const) {
      const size = axis === "width" ? element.width : element.height
      const delta = Math.abs(size - current)
      if (delta > threshold) continue
      const bestDelta = best ? Math.abs(best.size - current) : Number.POSITIVE_INFINITY
      const closerSize = delta < bestDelta - 0.01
      const sameSizeCloser = Math.abs(delta - bestDelta) <= 0.01 && (!best || distance < best.distance)
      if (closerSize || sameSizeCloser) best = { size, axis, element, distance }
    }
  }
  return best
}

function cornersFromObject(target: FabricObject): Corners | null {
  const coords = target.aCoords
  if (!coords) return null
  return {
    tl: { x: coords.tl.x, y: coords.tl.y },
    tr: { x: coords.tr.x, y: coords.tr.y },
    bl: { x: coords.bl.x, y: coords.bl.y },
    br: { x: coords.br.x, y: coords.br.y },
  }
}

function cornersFromElement(element: { x: number; y: number; width: number; height: number; rotation: number }): Corners {
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  const rad = ((element.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hx = element.width / 2
  const hy = element.height / 2
  const point = (px: number, py: number): Point => ({
    x: cx + px * cos - py * sin,
    y: cy + px * sin + py * cos,
  })
  return { tl: point(-hx, -hy), tr: point(hx, -hy), bl: point(-hx, hy), br: point(hx, hy) }
}

function measureEdge(corners: Corners, axis: Axis, zoom: number): { a: Point; b: Point; mid: Point } {
  const start = axis === "width" ? corners.tl : corners.tr
  const end = axis === "width" ? corners.tr : corners.br
  const center = {
    x: (corners.tl.x + corners.br.x) / 2,
    y: (corners.tl.y + corners.br.y) / 2,
  }
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const outward = Math.hypot(mid.x - center.x, mid.y - center.y) || 1
  const gap = 14 / zoom
  const ox = ((mid.x - center.x) / outward) * gap
  const oy = ((mid.y - center.y) / outward) * gap
  return {
    a: { x: start.x + ox, y: start.y + oy },
    b: { x: end.x + ox, y: end.y + oy },
    mid: { x: mid.x + ox, y: mid.y + oy },
  }
}

function sceneToScreen(canvas: Canvas, point: Point): Point {
  const v = canvas.viewportTransform
  return {
    x: point.x * v[0] + point.y * v[2] + v[4],
    y: point.x * v[1] + point.y * v[3] + v[5],
  }
}

function screenScale(canvas: Canvas): number {
  return canvas.getRetinaScaling() || 1
}

function strokeBracket(ctx: CanvasRenderingContext2D, canvas: Canvas, edge: { a: Point; b: Point }, dashed: boolean): void {
  const pixel = screenScale(canvas)
  const a = sceneToScreen(canvas, edge.a)
  const b = sceneToScreen(canvas, edge.b)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  const tick = 7 * pixel
  ctx.save()
  ctx.setLineDash(dashed ? [5 * pixel, 4 * pixel] : [])
  traceBracket(ctx, a, b, nx, ny, tick)
  ctx.lineWidth = 3 * pixel
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()
  traceBracket(ctx, a, b, nx, ny, tick)
  ctx.lineWidth = 1.5 * pixel
  ctx.strokeStyle = "#e11d74"
  ctx.stroke()
  ctx.restore()
}

function traceBracket(ctx: CanvasRenderingContext2D, a: Point, b: Point, nx: number, ny: number, tick: number): void {
  ctx.beginPath()
  ctx.moveTo(a.x + nx * tick, a.y + ny * tick)
  ctx.lineTo(a.x - nx * tick, a.y - ny * tick)
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.moveTo(b.x + nx * tick, b.y + ny * tick)
  ctx.lineTo(b.x - nx * tick, b.y - ny * tick)
}

function strokeLink(ctx: CanvasRenderingContext2D, canvas: Canvas, from: Point, to: Point): void {
  const pixel = screenScale(canvas)
  const a = sceneToScreen(canvas, from)
  const b = sceneToScreen(canvas, to)
  if (Math.hypot(b.x - a.x, b.y - a.y) < 8 * pixel) return
  ctx.save()
  ctx.setLineDash([4 * pixel, 4 * pixel])
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineWidth = 3 * pixel
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.lineWidth = 1 * pixel
  ctx.strokeStyle = "#e11d74"
  ctx.stroke()
  ctx.restore()
}

function paintLabel(ctx: CanvasRenderingContext2D, canvas: Canvas, at: Point, size: number): void {
  const pixel = screenScale(canvas)
  const point = sceneToScreen(canvas, at)
  const label = String(size)
  ctx.save()
  ctx.font = `600 ${Math.round(11 * pixel)}px sans-serif`
  const width = ctx.measureText(label).width
  const padX = 5 * pixel
  const boxW = width + padX * 2
  const boxH = 16 * pixel
  ctx.fillStyle = "#e11d74"
  ctx.beginPath()
  ctx.roundRect(point.x - boxW / 2, point.y - boxH / 2, boxW, boxH, 3 * pixel)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(label, point.x, point.y + 0.5)
  ctx.restore()
}
