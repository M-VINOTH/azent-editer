import type { Canvas, FabricObject } from "fabric"
import { getElementId } from "./canvasService"
import { useTemplateStore } from "../store/templateStore"

type Box = { left: number; right: number; top: number; bottom: number; cx: number; cy: number }
type Stop = { at: number; crossStart: number; crossEnd: number }
type Guide = { axis: "x" | "y"; at: number; start: number; end: number }

const guides: Guide[] = []

export function clearSmartGuides(): void {
  guides.length = 0
}

export function snapSmartGuides(canvas: Canvas, target: FabricObject, locked = { x: false, y: false }): { x: boolean; y: boolean } {
  guides.length = 0
  if (getElementId(target) === "__fold-guide") return locked

  const active = new Set(canvas.getActiveObjects())
  active.add(target)
  const hidden = new Set(useTemplateStore.getState().hiddenIds)
  const others = canvas.getObjects().flatMap((object) => {
    if (active.has(object) || object.visible === false) return []
    const id = getElementId(object)
    if (!id || id === "__fold-guide" || hidden.has(id)) return []
    const box = boundsOf(object)
    return box ? [box] : []
  })

  const moving = boundsOf(target)
  if (!moving) return locked

  const state = useTemplateStore.getState()
  const snapObjects = state.snapToObjects
  const sheet = state.template.canvas
  const zoom = canvas.getZoom() || 1
  const threshold = 8 / zoom
  const pad = 12 / zoom
  const objectBoxes = snapObjects ? others : []
  const xStops = [
    ...objectBoxes.flatMap((box) => edgeStops(box.left, box.cx, box.right, box.top, box.bottom)),
    ...edgeStops(0, sheet.width / 2, sheet.width, 0, sheet.height),
  ]
  const yStops = [
    ...objectBoxes.flatMap((box) => edgeStops(box.top, box.cy, box.bottom, box.left, box.right)),
    ...edgeStops(0, sheet.height / 2, sheet.height, 0, sheet.width),
  ]

  const xEdge = locked.x ? null : nearest(moving.left, moving.cx, moving.right, moving.top, moving.bottom, xStops, threshold, pad, "x")
  const yEdge = locked.y ? null : nearest(moving.top, moving.cy, moving.bottom, moving.left, moving.right, yStops, threshold, pad, "y")
  const xSpace = locked.x || !snapObjects ? null : matchSpacing(moving, objectBoxes, "x", threshold)
  const ySpace = locked.y || !snapObjects ? null : matchSpacing(moving, objectBoxes, "y", threshold)
  const xMatch = closerMatch(xEdge, xSpace)
  const yMatch = closerMatch(yEdge, ySpace)
  if (xMatch) target.set({ left: (target.left ?? 0) + xMatch.delta })
  if (yMatch) target.set({ top: (target.top ?? 0) + yMatch.delta })
  if (xMatch || yMatch) target.setCoords()
  guides.push(...(xMatch?.lines ?? []), ...(yMatch?.lines ?? []))
  return { x: locked.x || Boolean(xMatch), y: locked.y || Boolean(yMatch) }
}

export function paintSmartGuides(canvas: Canvas, ctx: CanvasRenderingContext2D): void {
  if (guides.length === 0) return
  const pixel = canvas.getRetinaScaling() || 1
  const view = canvas.viewportTransform
  if (!view) return
  const toScreen = (x: number, y: number) => ({
    x: x * view[0] + y * view[2] + view[4],
    y: x * view[1] + y * view[3] + view[5],
  })
  ctx.save()
  for (const guide of guides) {
    const a = guide.axis === "x" ? toScreen(guide.at, guide.start) : toScreen(guide.start, guide.at)
    const b = guide.axis === "x" ? toScreen(guide.at, guide.end) : toScreen(guide.end, guide.at)
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
  }
  ctx.restore()
}

function closerMatch(
  edge: { delta: number; lines: Guide[] } | null,
  space: { delta: number; lines: Guide[] } | null,
): { delta: number; lines: Guide[] } | null {
  if (!edge) return space
  if (!space) return edge
  return Math.abs(space.delta) < Math.abs(edge.delta) - 0.01 ? space : edge
}

function matchSpacing(moving: Box, others: Box[], axis: "x" | "y", threshold: number): { delta: number; lines: Guide[] } | null {
  const horizontal = axis === "x"
  const start = horizontal ? moving.left : moving.top
  const end = horizontal ? moving.right : moving.bottom
  const crossStart = horizontal ? moving.top : moving.left
  const crossEnd = horizontal ? moving.bottom : moving.right
  const size = end - start
  const row = others.filter((box) => overlaps(crossStart, crossEnd, horizontal ? box.top : box.left, horizontal ? box.bottom : box.right))
  if (row.length === 0) return null

  const before = (box: Box) => (horizontal ? box.right : box.bottom)
  const after = (box: Box) => (horizontal ? box.left : box.top)
  const sorted = [...row].sort((a, b) => before(a) - before(b))
  const gaps: number[] = []
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gap = after(sorted[index + 1]) - before(sorted[index])
    if (gap > 1 && gap < size * 0.85) gaps.push(gap)
  }

  let best: { delta: number; lines: Guide[] } | null = null
  const consider = (delta: number, lines: Guide[]) => {
    if (Math.abs(delta) > threshold) return
    if (!best || Math.abs(delta) < Math.abs(best.delta) - 0.01) best = { delta, lines }
  }
  const mid = (box: Box) => (Math.max(crossStart, horizontal ? box.top : box.left) + Math.min(crossEnd, horizontal ? box.bottom : box.right)) / 2
  const gapLine = (from: number, to: number, at: number): Guide =>
    horizontal ? { axis: "y", at, start: from, end: to } : { axis: "x", at, start: from, end: to }

  for (const neighbor of row) {
    const neighborEnd = before(neighbor)
    if (neighborEnd > start + threshold) continue
    for (const gap of gaps) {
      const desired = neighborEnd + gap
      consider(desired - start, [gapLine(neighborEnd, desired, mid(neighbor))])
    }
  }
  for (const neighbor of row) {
    const neighborStart = after(neighbor)
    if (neighborStart < end - threshold) continue
    for (const gap of gaps) {
      const desiredEnd = neighborStart - gap
      consider(desiredEnd - end, [gapLine(desiredEnd, neighborStart, mid(neighbor))])
    }
  }

  const left = row.filter((box) => before(box) <= (start + end) / 2).sort((a, b) => before(b) - before(a))[0]
  const right = row.filter((box) => after(box) >= (start + end) / 2).sort((a, b) => after(a) - after(b))[0]
  if (left && right && before(left) < after(right)) {
    const desired = (before(left) + after(right) - size) / 2
    const gap = desired - before(left)
    if (gap > 1) {
      const at = (mid(left) + mid(right)) / 2
      consider(desired - start, [gapLine(before(left), desired, at), gapLine(desired + size, after(right), at)])
    }
  }
  return best
}

function overlaps(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.min(a2, b2) - Math.max(a1, b1) > 0
}

function edgeStops(a: number, mid: number, b: number, crossStart: number, crossEnd: number): Stop[] {
  return [
    { at: a, crossStart, crossEnd },
    { at: mid, crossStart, crossEnd },
    { at: b, crossStart, crossEnd },
  ]
}

function nearest(
  edgeA: number,
  mid: number,
  edgeB: number,
  crossStart: number,
  crossEnd: number,
  stops: Stop[],
  threshold: number,
  pad: number,
  axis: Guide["axis"],
): { delta: number; lines: Guide[] } | null {
  const edges = [edgeA, mid, edgeB]
  let best: { delta: number; at: number } | null = null
  for (const edge of edges) {
    for (const stop of stops) {
      const delta = stop.at - edge
      if (Math.abs(delta) > threshold) continue
      if (!best || Math.abs(delta) < Math.abs(best.delta) - 0.01) best = { delta, at: stop.at }
    }
  }
  if (!best) return null

  const lines = new Map<number, Guide>()
  for (const stop of stops) {
    if (Math.abs(stop.at - best.at) > 0.5) continue
    const hitsMoving = edges.some((edge) => Math.abs(edge + best.delta - stop.at) <= 0.5)
    if (!hitsMoving) continue
    const key = Math.round(stop.at)
    const start = Math.min(crossStart, stop.crossStart) - pad
    const end = Math.max(crossEnd, stop.crossEnd) + pad
    const existing = lines.get(key)
    if (!existing) lines.set(key, { axis, at: stop.at, start, end })
    else {
      existing.start = Math.min(existing.start, start)
      existing.end = Math.max(existing.end, end)
    }
  }
  return { delta: best.delta, lines: [...lines.values()].map((line) => ({ ...line, axis })) }
}

function boundsOf(object: FabricObject): Box | null {
  const center = object.getCenterPoint()
  const width = object.getScaledWidth()
  const height = object.getScaledHeight()
  if (width < 1 || height < 1) return null
  const angle = ((object.angle || 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const boxWidth = width * cos + height * sin
  const boxHeight = width * sin + height * cos
  return {
    left: center.x - boxWidth / 2,
    right: center.x + boxWidth / 2,
    top: center.y - boxHeight / 2,
    bottom: center.y + boxHeight / 2,
    cx: center.x,
    cy: center.y,
  }
}
