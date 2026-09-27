import type { FabricObject } from "fabric"
import { useTemplateStore } from "../store/templateStore"
import { getElementId } from "./canvasService"

type Lock = { x: boolean; y: boolean }

export function snapToSheetGuides(object: FabricObject, locked: Lock): Lock {
  const state = useTemplateStore.getState()
  if (!state.snapToGuides || state.guides.length === 0) return locked
  if (getElementId(object) === "__fold-guide") return locked

  const box = boundsOf(object)
  if (!box) return locked
  const zoom = object.canvas?.getZoom() || 1
  const threshold = 8 / zoom
  const next = { ...locked }
  let moved = false

  if (!locked.x) {
    const delta = closestDelta(
      box.left,
      box.cx,
      box.right,
      state.guides.filter((guide) => guide.axis === "x").map((guide) => guide.at),
      threshold,
    )
    if (delta != null) {
      object.set({ left: (object.left ?? 0) + delta })
      next.x = true
      moved = true
    }
  }
  if (!locked.y) {
    const delta = closestDelta(
      box.top,
      box.cy,
      box.bottom,
      state.guides.filter((guide) => guide.axis === "y").map((guide) => guide.at),
      threshold,
    )
    if (delta != null) {
      object.set({ top: (object.top ?? 0) + delta })
      next.y = true
      moved = true
    }
  }
  if (moved) object.setCoords()
  return next
}

function closestDelta(edgeA: number, mid: number, edgeB: number, stops: number[], threshold: number): number | null {
  let best: number | null = null
  for (const edge of [edgeA, mid, edgeB]) {
    for (const at of stops) {
      const delta = at - edge
      if (Math.abs(delta) > threshold) continue
      if (best == null || Math.abs(delta) < Math.abs(best) - 0.01) best = delta
    }
  }
  return best
}

function boundsOf(object: FabricObject): { left: number; right: number; top: number; bottom: number; cx: number; cy: number } | null {
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
