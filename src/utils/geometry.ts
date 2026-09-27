import { DESIGN_HEIGHT, DESIGN_WIDTH, type ViewportScale } from "../models/canvas"
import type { TemplateElement } from "../models/template"

export function fitScale(
  containerWidth: number,
  containerHeight: number,
  designWidth = DESIGN_WIDTH,
  designHeight = DESIGN_HEIGHT,
): ViewportScale {
  const scale = Math.max(
    0.01,
    Math.min(containerWidth / designWidth, containerHeight / designHeight),
  )
  return {
    scale,
    width: Math.round(designWidth * scale),
    height: Math.round(designHeight * scale),
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function nextZIndex(elements: TemplateElement[]): number {
  if (elements.length === 0) return 10
  return Math.max(...elements.map((el) => el.zIndex)) + 1
}

export function sortByZIndex<T extends { zIndex: number }>(
  elements: T[],
  direction: "asc" | "desc" = "asc",
): T[] {
  return [...elements].sort((a, b) =>
    direction === "asc" ? a.zIndex - b.zIndex : b.zIndex - a.zIndex,
  )
}

export function moveLayers(
  elements: TemplateElement[],
  ids: string[],
  direction: "forward" | "backward" | "front" | "back",
): TemplateElement[] {
  const wanted = new Set(ids)
  const sorted = sortByZIndex(elements, "asc")
  const selected = sorted.filter((element) => wanted.has(element.id))
  if (selected.length === 0) return elements
  if (direction === "front" || direction === "back") {
    const rest = sorted.filter((element) => !wanted.has(element.id))
    const order = direction === "front" ? [...rest, ...selected] : [...selected, ...rest]
    return order.map((element, index) => ({ ...element, zIndex: (index + 1) * 10 }))
  }
  let current = elements
  const walk = sortByZIndex(current, direction === "forward" ? "desc" : "asc")
  for (const element of walk) {
    if (!wanted.has(element.id)) continue
    current = swapZIndex(current, element.id, direction)
  }
  return current
}

export function swapZIndex(
  elements: TemplateElement[],
  id: string,
  direction: "forward" | "backward",
): TemplateElement[] {
  const sorted = sortByZIndex(elements, "asc")
  const index = sorted.findIndex((el) => el.id === id)
  if (index < 0) return elements

  const swapWith = direction === "forward" ? index + 1 : index - 1
  if (swapWith < 0 || swapWith >= sorted.length) return elements

  const current = sorted[index]
  const neighbor = sorted[swapWith]
  const currentZ = current.zIndex
  const neighborZ = neighbor.zIndex

  return elements.map((el) => {
    if (el.id === current.id) return { ...el, zIndex: neighborZ }
    if (el.id === neighbor.id) return { ...el, zIndex: currentZ }
    return el
  })
}

export function isInside(elements: TemplateElement[], id: string, ancestorId: string): boolean {
  const guard = new Set<string>()
  let current = elements.find((element) => element.id === id)?.parentId
  while (current && !guard.has(current)) {
    if (current === ancestorId) return true
    guard.add(current)
    current = elements.find((element) => element.id === current)?.parentId
  }
  return false
}

export function lockedWithAncestors(elements: TemplateElement[]): Set<string> {
  const locked = new Set<string>()
  for (const element of elements) {
    if (element.locked) locked.add(element.id)
  }
  let changed = true
  while (changed) {
    changed = false
    for (const element of elements) {
      if (element.parentId && locked.has(element.parentId) && !locked.has(element.id)) {
        locked.add(element.id)
        changed = true
      }
    }
  }
  return locked
}

export function hiddenWithAncestors(elements: TemplateElement[], hiddenIds: Iterable<string>): Set<string> {
  const hidden = new Set(hiddenIds)
  let changed = true
  while (changed) {
    changed = false
    for (const element of elements) {
      if (element.parentId && hidden.has(element.parentId) && !hidden.has(element.id)) {
        hidden.add(element.id)
        changed = true
      }
    }
  }
  return hidden
}

export function placeLayer(
  elements: TemplateElement[],
  id: string,
  targetId: string,
  before: boolean,
  placement: "beside" | "into" | "root" = "beside",
): TemplateElement[] {
  if (id === targetId) return elements
  if (placement === "into" && isInside(elements, targetId, id)) return elements
  const target = elements.find((element) => element.id === targetId)
  if (!target) return elements
  const parentId = placement === "into" ? targetId : placement === "root" ? undefined : target.parentId
  if (parentId === id || (parentId !== undefined && isInside(elements, parentId, id))) return elements
  const withParent = elements.map((element) => (element.id === id ? { ...element, parentId } : element))
  return reorderLayer(withParent, id, targetId, placement === "into" ? false : before)
}

export function reorderLayer(
  elements: TemplateElement[],
  id: string,
  targetId: string,
  before: boolean,
): TemplateElement[] {
  if (id === targetId) return elements
  const ordered = sortByZIndex(elements, "desc")
  const moving = ordered.find((element) => element.id === id)
  if (!moving) return elements
  const rest = ordered.filter((element) => element.id !== id)
  let index = rest.findIndex((element) => element.id === targetId)
  if (index < 0) return elements
  if (!before) index += 1
  rest.splice(index, 0, moving)
  const zById = new Map(rest.map((element, position) => [element.id, rest.length - position]))
  return elements.map((element) => {
    const zIndex = zById.get(element.id)
    if (zIndex === undefined || zIndex === element.zIndex) return element
    return { ...element, zIndex }
  })
}

export function createId(prefix: string): string {
  const rand = crypto.randomUUID().slice(0, 8)
  return `${prefix}-${rand}`
}

export function roundDesign(value: number): number {
  return Math.round(value)
}
