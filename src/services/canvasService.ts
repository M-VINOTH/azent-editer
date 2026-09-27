import {
  ActiveSelection,
  Canvas,
  Circle,
  FabricImage,
  Rect,
  Shadow,
  StaticCanvas,
  Textbox,
  type FabricObject,
} from "fabric"
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../models/canvas"
import { lockedWithAncestors } from "../utils/geometry"
import { useTemplateStore } from "../store/templateStore"
import type {
  AlbumTemplate,
  Background,
  DecorationElement,
  PhotoElement,
  TemplateElement,
  TextElement,
} from "../models/template"
import { sortByZIndex } from "../utils/geometry"
import { loadHtmlImage, rasterizePhotoElement } from "../utils/photoRaster"
import { toCanvasBlendMode } from "../utils/photoShape"
import { decorationSource } from "../utils/shapeGraphic"
import { clippingBase, withLayerMask } from "../utils/layerMask"

export const ELEMENT_NAME_KEY = "elementId"

export type EditorCanvas = Canvas | StaticCanvas

export interface ElementTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const CONTROL_STYLE = {
  cornerColor: "#c4a574",
  cornerStrokeColor: "#8a704c",
  borderColor: "#c4a574",
  cornerStyle: "circle" as const,
  transparentCorners: false,
  borderScaleFactor: 2,
  padding: 8,
}

function asEditorObject(
  object: FabricObject,
): FabricObject & { elementId?: string; isGuide?: boolean } {
  return object as FabricObject & { elementId?: string; isGuide?: boolean }
}

export function getElementId(object: FabricObject): string | undefined {
  return asEditorObject(object).elementId
}

export function markElement(object: FabricObject, elementId: string): void {
  asEditorObject(object).elementId = elementId
}

export function readTransform(object: FabricObject): ElementTransform {
  const groupScale = object.group?.getObjectScaling()
  const width = Math.max(1, Math.round(object.getScaledWidth() * (groupScale?.x || 1)))
  const height = Math.max(1, Math.round(object.getScaledHeight() * (groupScale?.y || 1)))
  const center = object.getCenterPoint()
  return {
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
    width,
    height,
    rotation: Math.round((object.angle ?? 0) * 10) / 10,
  }
}

function createPhotoObjectFromRaster(element: PhotoElement, canvas: HTMLCanvasElement): FabricObject {
  const image = new FabricImage(canvas, {
    originX: "center",
    originY: "center",
    left: element.x + element.width / 2,
    top: element.y + element.height / 2,
    scaleX: element.width / Math.max(canvas.width, 1),
    scaleY: element.height / Math.max(canvas.height, 1),
    angle: element.rotation,
    opacity: element.opacity ?? 1,
    globalCompositeOperation: toCanvasBlendMode(element.blendMode),
    perPixelTargetFind: element.role === "cutout",
    objectCaching: element.role !== "cutout",
    ...CONTROL_STYLE,
  })
  const framed = Boolean(element.border && element.border.width > 0)
  const autoShadow = element.shape === "polaroid" || element.role === "cutout" || framed
  if (element.shadow === true || (element.shadow !== false && autoShadow)) {
    image.set({
      shadow: new Shadow({
        color: element.role === "cutout" ? "rgba(80, 36, 48, 0.28)" : "rgba(40, 24, 16, 0.32)",
        blur: element.role === "cutout" ? 90 : framed ? 55 : 70,
        offsetX: framed ? 18 : 12,
        offsetY: element.role === "cutout" ? 36 : framed ? 28 : 40,
      }),
    })
  }
  markElement(image, element.id)
  return image
}

function rasterSize(element: PhotoElement): { width: number; height: number } {
  const maxEdge = 2048
  const scale = Math.min(1, maxEdge / Math.max(element.width, element.height))
  return {
    width: Math.max(1, Math.round(element.width * scale)),
    height: Math.max(1, Math.round(element.height * scale)),
  }
}

async function createPlaceholderPhoto(element: PhotoElement): Promise<FabricObject> {
  const size = rasterSize(element)
  const canvas = rasterizePhotoElement(element, null, size.width, size.height)
  await withLayerMask(canvas, element)
  return createPhotoObjectFromRaster(element, canvas)
}

function pictureHidden(id: string): boolean {
  return useTemplateStore.getState().hiddenPhotoIds.includes(id)
}

/** Editor-only. Export passes false so the saved look is what leaves the app. */
let paintBefore = false

export function setPhotoCompare(before: boolean): void {
  paintBefore = before
}

export async function paintWithoutCompare<T>(run: () => Promise<T>): Promise<T> {
  paintBefore = false
  try {
    return await run()
  } finally {
    paintBefore = useTemplateStore.getState().showBefore
  }
}

function shownPhoto(element: PhotoElement): PhotoElement {
  if (!paintBefore) return element
  return {
    ...element,
    brightness: 0,
    contrast: 0,
    saturate: 0,
    blur: 0,
    imageUrl: element.sourceUrl || element.imageUrl,
    role: element.role === "cutout" ? "slot" : element.role,
  }
}

async function createFilledPhoto(element: PhotoElement): Promise<FabricObject> {
  const hidePicture = pictureHidden(element.id)
  const first = shownPhoto(element)
  let source = hidePicture ? null : await loadHtmlImage(first.imageUrl ?? "")
  const view = shownPhoto(element)
  if (!hidePicture && view.imageUrl && view.imageUrl !== first.imageUrl) {
    source = await loadHtmlImage(view.imageUrl)
  }
  const size = rasterSize(element)
  const canvas = rasterizePhotoElement(view, source, size.width, size.height, hidePicture)
  await withLayerMask(canvas, view)
  return createPhotoObjectFromRaster(element, canvas)
}

async function createPhotoObject(element: PhotoElement): Promise<FabricObject> {
  if (!element.imageUrl) return await createPlaceholderPhoto(element)
  try {
    return await createFilledPhoto(element)
  } catch {
    return createPlaceholderPhoto(element)
  }
}

function createTextObject(element: TextElement): FabricObject {
  const textbox = new Textbox(element.text, {
    originX: "center",
    originY: "center",
    left: element.x + element.width / 2,
    top: element.y + element.height / 2,
    width: element.width,
    fontSize: element.fontSize,
    fontFamily: element.fontFamily,
    fontWeight: element.fontWeight,
    fill: element.color,
    textAlign: element.textAlign,
    angle: element.rotation,
    flipX: element.flipX ?? false,
    flipY: element.flipY ?? false,
    splitByGrapheme: false,
    ...CONTROL_STYLE,
  })
  markElement(textbox, element.id)
  return textbox
}

async function paintDecorationCanvas(element: DecorationElement): Promise<HTMLCanvasElement> {
  const scale = Math.min(1, 2048 / Math.max(element.width, element.height, 1))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(element.width * scale))
  canvas.height = Math.max(1, Math.round(element.height * scale))
  const ctx = canvas.getContext("2d")
  if (ctx) {
    try {
      const image = await loadHtmlImage(decorationSource(element))
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    } catch {
      ctx.fillStyle = "rgba(196, 165, 116, 0.25)"
      ctx.beginPath()
      ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    await withLayerMask(canvas, element)
  }
  return canvas
}

async function createDecorationObject(element: DecorationElement): Promise<FabricObject> {
  if (element.mask) {
    const raster = await paintDecorationCanvas(element)
    const image = new FabricImage(raster, {
      originX: "center",
      originY: "center",
      left: element.x + element.width / 2,
      top: element.y + element.height / 2,
      scaleX: element.width / Math.max(raster.width, 1),
      scaleY: element.height / Math.max(raster.height, 1),
      angle: element.rotation,
      flipX: element.flipX ?? false,
      flipY: element.flipY ?? false,
      opacity: element.opacity,
      globalCompositeOperation: toCanvasBlendMode(element.blendMode),
      perPixelTargetFind: true,
      objectCaching: false,
      ...CONTROL_STYLE,
    })
    markElement(image, element.id)
    return image
  }
  try {
    const img = await FabricImage.fromURL(decorationSource(element), { crossOrigin: "anonymous" })
    const nativeW = img.width || 1
    const nativeH = img.height || 1
    img.set({
      originX: "center",
      originY: "center",
      left: element.x + element.width / 2,
      top: element.y + element.height / 2,
      scaleX: element.width / nativeW,
      scaleY: element.height / nativeH,
      angle: element.rotation,
      flipX: element.flipX ?? false,
      flipY: element.flipY ?? false,
      opacity: element.opacity,
      globalCompositeOperation: toCanvasBlendMode(element.blendMode),
      perPixelTargetFind: true,
      objectCaching: false,
      ...CONTROL_STYLE,
    })
    markElement(img, element.id)
    return img
  } catch {
    const fallback = new Circle({
      originX: "center",
      originY: "center",
      left: element.x + element.width / 2,
      top: element.y + element.height / 2,
      radius: Math.min(element.width, element.height) / 2,
      fill: "rgba(196, 165, 116, 0.25)",
      stroke: "#c4a574",
      strokeWidth: 8,
      angle: element.rotation,
      opacity: element.opacity,
      ...CONTROL_STYLE,
    })
    markElement(fallback, element.id)
    return fallback
  }
}

export async function createElementObject(element: TemplateElement): Promise<FabricObject | null> {
  if (element.type === "group") return null
  if (element.type === "photo") return createPhotoObject(element)
  if (element.type === "text") return createTextObject(element)
  return createDecorationObject(element)
}

function applyInteractionLock(object: FabricObject, locked: boolean): void {
  object.set({
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    hasControls: !locked,
  })
  if (object instanceof Textbox) object.set({ editable: !locked })
}

function applyLayerLocks(canvas: EditorCanvas, elements: TemplateElement[]): void {
  const locked = lockedWithAncestors(elements)
  for (const element of elements) {
    const object = findObjectByElementId(canvas, element.id)
    if (!object) continue
    applyInteractionLock(object, locked.has(element.id))
  }
}

async function addElementObject(canvas: EditorCanvas, element: TemplateElement): Promise<void> {
  const object = await createElementObject(element)
  if (object) canvas.add(object)
}

export async function applyBackground(
  canvas: EditorCanvas,
  background: Background,
  width = DESIGN_WIDTH,
  height = DESIGN_HEIGHT,
): Promise<void> {
  canvas.backgroundImage = undefined
  if (background.type === "transparent") {
    canvas.backgroundColor = "rgba(0,0,0,0)"
    return
  }
  if (background.type === "color") {
    canvas.backgroundColor = background.value
    return
  }

  canvas.backgroundColor = "#F5EFE6"
  try {
    const img = await FabricImage.fromURL(background.url, { crossOrigin: "anonymous" })
    const scale = Math.max(width / (img.width || 1), height / (img.height || 1))
    img.set({
      originX: "left",
      originY: "top",
      left: 0,
      top: 0,
      scaleX: scale,
      scaleY: scale,
      opacity: background.opacity ?? 1,
      selectable: false,
      evented: false,
    })
    canvas.backgroundImage = img
  } catch {
    canvas.backgroundColor = "#F5EFE6"
  }
}

function showsFold(recipeId: string | undefined): boolean {
  return Boolean(recipeId && !recipeId.startsWith("studio:"))
}

export function createFoldGuide(width = DESIGN_WIDTH, height = DESIGN_HEIGHT): FabricObject {
  const guide = new Rect({
    originX: "center",
    originY: "top",
    left: width / 2,
    top: 0,
    width: 6,
    height,
    fill: "rgba(120, 100, 80, 0.28)",
    selectable: false,
    evented: false,
    excludeFromExport: true,
    hoverCursor: "default",
  })
  const tagged = asEditorObject(guide)
  tagged.elementId = "__fold-guide"
  tagged.isGuide = true
  return guide
}

async function textMaskClip(element: TextElement): Promise<FabricImage> {
  const scale = Math.min(1, 2048 / Math.max(element.width, element.height, 1))
  const raster = document.createElement("canvas")
  raster.width = Math.max(1, Math.round(element.width * scale))
  raster.height = Math.max(1, Math.round(element.height * scale))
  const ctx = raster.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, raster.width, raster.height)
  }
  await withLayerMask(raster, element)
  return new FabricImage(raster, {
    originX: "center",
    originY: "center",
    left: 0,
    top: 0,
    scaleX: element.width / Math.max(raster.width, 1),
    scaleY: element.height / Math.max(raster.height, 1),
  })
}

async function syncLayerClipping(canvas: EditorCanvas, elements: TemplateElement[]): Promise<void> {
  const objects = new Map<string, FabricObject>()
  for (const object of canvas.getObjects()) {
    const id = getElementId(object)
    if (id) objects.set(id, object)
  }
  for (const element of elements) {
    if (element.type === "group") continue
    const object = objects.get(element.id)
    if (!object) continue
    const textMask = element.type === "text" && element.mask ? await textMaskClip(element) : undefined
    const base = element.clipping ? clippingBase(elements, element) : null
    const baseObject = base ? objects.get(base.id) : undefined
    if (!textMask && !(baseObject && baseObject !== object)) {
      if (object.clipPath) {
        object.clipPath = undefined
        object.dirty = true
      }
      continue
    }
    let clip: FabricObject | undefined = textMask
    if (baseObject && baseObject !== object) {
      const clone = await baseObject.clone()
      clone.set({ absolutePositioned: true, evented: false, selectable: false })
      if (clip) clip.clipPath = clone
      else clip = clone
    }
    object.clipPath = clip
    object.dirty = true
  }
}

export async function renderTemplateOnCanvas(
  canvas: EditorCanvas,
  template: AlbumTemplate,
  options: { hiddenIds?: Set<string>; showGuides?: boolean } = {},
): Promise<void> {
  const hiddenIds = options.hiddenIds ?? new Set<string>()
  const removable = canvas.getObjects()
  if (removable.length > 0) canvas.remove(...removable)

  await applyBackground(canvas, template.background, template.canvas.width, template.canvas.height)

  const visible = sortByZIndex(template.elements, "asc").filter((element) => !hiddenIds.has(element.id))
  for (const element of visible) {
    await addElementObject(canvas, element)
  }
  applyLayerLocks(canvas, template.elements)
  await syncLayerClipping(canvas, template.elements)

  if (options.showGuides && showsFold(template.recipeId)) {
    canvas.add(createFoldGuide(template.canvas.width, template.canvas.height))
  }

  canvas.requestRenderAll()
}

export function findObjectByElementId(canvas: EditorCanvas, elementId: string): FabricObject | undefined {
  return canvas.getObjects().find((object) => getElementId(object) === elementId)
}

const photoCache = new Map<string, Promise<HTMLImageElement>>()
const photoPaintTokens = new Map<string, number>()

function loadCachedPhoto(url: string): Promise<HTMLImageElement> {
  const cached = photoCache.get(url)
  if (cached) return cached
  const pending = loadHtmlImage(url)
  photoCache.set(url, pending)
  pending.catch(() => photoCache.delete(url))
  return pending
}

export async function refreshPhotoObject(canvas: EditorCanvas, element: PhotoElement): Promise<void> {
  const object = findObjectByElementId(canvas, element.id)
  if (!object || !(object instanceof FabricImage)) return
  const token = (photoPaintTokens.get(element.id) ?? 0) + 1
  photoPaintTokens.set(element.id, token)
  const hidePicture = pictureHidden(element.id)
  const first = shownPhoto(element)
  let source = !hidePicture && first.imageUrl ? await loadCachedPhoto(first.imageUrl) : null
  if (photoPaintTokens.get(element.id) !== token) return
  const view = shownPhoto(element)
  if (!hidePicture && view.imageUrl && view.imageUrl !== first.imageUrl) {
    source = await loadCachedPhoto(view.imageUrl)
    if (photoPaintTokens.get(element.id) !== token) return
  }
  const size = rasterSize(element)
  const raster = rasterizePhotoElement(view, source, size.width, size.height, hidePicture)
  await withLayerMask(raster, view)
  object.setElement(raster)
  object.set({
    scaleX: element.width / Math.max(raster.width, 1),
    scaleY: element.height / Math.max(raster.height, 1),
  })
  object.setCoords()
  canvas.requestRenderAll()
}

export async function repaintPhotoCompare(
  canvas: EditorCanvas,
  elements: TemplateElement[],
  before: boolean,
): Promise<void> {
  setPhotoCompare(before)
  for (const element of elements) {
    if (element.type === "photo") await refreshPhotoObject(canvas, element)
  }
}

function paintSlice(element: TemplateElement): string {
  const { zIndex: _zIndex, parentId: _parentId, name: _name, locked: _locked, ...rest } = element
  return JSON.stringify(rest)
}

function photoNeedsRaster(before: PhotoElement, next: PhotoElement): boolean {
  const keys: (keyof PhotoElement)[] = [
    "imageUrl",
    "shape",
    "cornerRadius",
    "panX",
    "panY",
    "photoScale",
    "flipX",
    "flipY",
    "brightness",
    "contrast",
    "saturate",
    "blur",
    "role",
    "objectFit",
    "width",
    "height",
    "mask",
  ]
  return keys.some((key) => JSON.stringify(before[key]) !== JSON.stringify(next[key])) || JSON.stringify(before.border) !== JSON.stringify(next.border)
}

function releaseSelection(canvas: EditorCanvas): void {
  if ("discardActiveObject" in canvas) canvas.discardActiveObject()
}

function placeObject(object: FabricObject, element: TemplateElement): void {
  const host = object.canvas
  if (object.group && host && "discardActiveObject" in host) host.discardActiveObject()
  object.set({
    left: element.x + element.width / 2,
    top: element.y + element.height / 2,
    angle: element.rotation,
    opacity: element.type === "photo" ? (element.opacity ?? 1) : element.type === "decoration" ? element.opacity : 1,
  })
  if (element.type === "photo" || element.type === "decoration") {
    object.set({ globalCompositeOperation: toCanvasBlendMode(element.blendMode) })
  }
  object.setCoords()
}

async function updateExistingObject(canvas: EditorCanvas, object: FabricObject, before: TemplateElement, next: TemplateElement): Promise<void> {
  if (next.type === "group") {
    canvas.remove(object)
    return
  }
  if (before.type !== next.type) {
    canvas.remove(object)
    await addElementObject(canvas, next)
    return
  }
  if (next.type === "photo" && before.type === "photo") {
    if (photoNeedsRaster(before, next) || !(object instanceof FabricImage)) {
      if (!(object instanceof FabricImage)) {
        canvas.remove(object)
        await addElementObject(canvas, next)
        return
      }
      await refreshPhotoObject(canvas, next)
    }
    const framed = Boolean(next.border && next.border.width > 0)
    const autoShadow = next.shape === "polaroid" || next.role === "cutout" || framed
    const wantsShadow = next.shadow === true || (next.shadow !== false && autoShadow)
    object.set({
      shadow: wantsShadow
        ? new Shadow({
            color: next.role === "cutout" ? "rgba(80, 36, 48, 0.28)" : "rgba(40, 24, 16, 0.32)",
            blur: next.role === "cutout" ? 90 : framed ? 55 : 70,
            offsetX: framed ? 18 : 12,
            offsetY: next.role === "cutout" ? 36 : framed ? 28 : 40,
          })
        : null,
    })
    placeObject(object, next)
    return
  }
  if (next.type === "text" && object instanceof Textbox) {
    object.set({
      text: next.text,
      width: next.width,
      fontSize: next.fontSize,
      fontFamily: next.fontFamily,
      fontWeight: next.fontWeight,
      fill: next.color,
      textAlign: next.textAlign,
      flipX: next.flipX ?? false,
      flipY: next.flipY ?? false,
    })
    placeObject(object, next)
    return
  }
  if (next.type === "decoration" && before.type === "decoration") {
    const shapeChanged =
      before.shape !== next.shape ||
      before.fill !== next.fill ||
      (Boolean(next.shape) && (before.width !== next.width || before.height !== next.height))
    const maskChanged = JSON.stringify(before.mask) !== JSON.stringify(next.mask)
    if (maskChanged && next.mask && object instanceof FabricImage) {
      const raster = await paintDecorationCanvas(next)
      object.setElement(raster)
      object.set({
        scaleX: next.width / Math.max(raster.width, 1),
        scaleY: next.height / Math.max(raster.height, 1),
        flipX: next.flipX ?? false,
        flipY: next.flipY ?? false,
      })
      placeObject(object, next)
      return
    }
    if (before.assetUrl !== next.assetUrl || shapeChanged || maskChanged) {
      if (object.group && "discardActiveObject" in canvas) canvas.discardActiveObject()
      canvas.remove(object)
      await addElementObject(canvas, next)
      return
    }
    if (object instanceof FabricImage) {
      const nativeW = object.width || 1
      const nativeH = object.height || 1
      object.set({
        scaleX: next.width / nativeW,
        scaleY: next.height / nativeH,
        flipX: next.flipX ?? false,
        flipY: next.flipY ?? false,
      })
    }
    placeObject(object, next)
  }
}

function stackByZ(canvas: EditorCanvas, elements: TemplateElement[], hiddenIds: Set<string>): void {
  const visible = sortByZIndex(elements, "asc").filter((element) => !hiddenIds.has(element.id))
  visible.forEach((element, index) => {
    const object = findObjectByElementId(canvas, element.id)
    if (object) canvas.moveObjectTo(object, index)
  })
  const guide = findObjectByElementId(canvas, "__fold-guide")
  if (guide) canvas.bringObjectToFront(guide)
}

export async function syncTemplateOnCanvas(
  canvas: EditorCanvas,
  previous: AlbumTemplate,
  next: AlbumTemplate,
  hiddenIds: Set<string>,
): Promise<void> {
  if (previous.canvas.width !== next.canvas.width || previous.canvas.height !== next.canvas.height) {
    await renderTemplateOnCanvas(canvas, next, { hiddenIds, showGuides: true })
    return
  }
  const previousIds = new Set(previous.elements.map((element) => element.id))
  const nextIds = new Set(next.elements.map((element) => element.id))
  const overlap = next.elements.filter((element) => previousIds.has(element.id)).length
  if (overlap === 0 && next.elements.length > 0) {
    await renderTemplateOnCanvas(canvas, next, { hiddenIds, showGuides: true })
    return
  }
  if (JSON.stringify(previous.background) !== JSON.stringify(next.background)) {
    await applyBackground(canvas, next.background, next.canvas.width, next.canvas.height)
  }
  const previousById = new Map(previous.elements.map((element) => [element.id, element]))
  releaseSelection(canvas)
  for (const id of previousIds) {
    if (nextIds.has(id) && !hiddenIds.has(id)) continue
    const object = findObjectByElementId(canvas, id)
    if (object) canvas.remove(object)
  }
  for (const element of next.elements) {
    if (hiddenIds.has(element.id) || element.type === "group") continue
    const before = previousById.get(element.id)
    const object = findObjectByElementId(canvas, element.id)
    if (!before || !object) {
      await addElementObject(canvas, element)
      continue
    }
    if (paintSlice(before) !== paintSlice(element)) {
      await updateExistingObject(canvas, object, before, element)
    }
  }
  applyLayerLocks(canvas, next.elements)
  await syncLayerClipping(canvas, next.elements)
  stackByZ(canvas, next.elements, hiddenIds)
  const guide = findObjectByElementId(canvas, "__fold-guide")
  if (showsFold(next.recipeId) && !guide) canvas.add(createFoldGuide(next.canvas.width, next.canvas.height))
  if (!showsFold(next.recipeId) && guide) canvas.remove(guide)
  canvas.requestRenderAll()
}

export function objectIsHeld(object: FabricObject): boolean {
  const locked = lockedWithAncestors(useTemplateStore.getState().template.elements)
  const members = object instanceof ActiveSelection ? object.getObjects() : [object]
  return members.some((item) => {
    const id = getElementId(item)
    return Boolean(id && locked.has(id))
  })
}

/** Keep a multi-selection from dragging a layer that is locked through its group. */
export function holdLockedSelection(canvas: Canvas): void {
  const active = canvas.getActiveObject()
  if (!(active instanceof ActiveSelection) || !objectIsHeld(active)) return
  active.set({
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
  })
  canvas.requestRenderAll()
}

export function applyToolMode(canvas: Canvas, tool: string): void {
  const move = tool === "select"
  const marquee = tool === "marquee"
  const navigate = tool === "hand" || tool === "zoom"
  const paint = tool === "pencil" || tool === "brush"
  const locked = lockedWithAncestors(useTemplateStore.getState().template.elements)
  canvas.selection = move || marquee
  canvas.skipTargetFind = navigate || paint
  canvas.defaultCursor =
    tool === "hand"
      ? "grab"
      : tool === "zoom"
        ? "zoom-in"
        : tool === "crop"
          ? "move"
          : tool === "text"
            ? "text"
            : tool === "bucket"
              ? "cell"
              : tool === "eraser"
                ? "not-allowed"
                : "crosshair"
  if (move) canvas.defaultCursor = "default"
  canvas.hoverCursor = canvas.defaultCursor
  for (const object of canvas.getObjects()) {
    const id = getElementId(object)
    if (id === "__fold-guide") continue
    const held = Boolean(id && locked.has(id))
    object.set({
      selectable: !navigate && !paint,
      evented: !navigate && !paint,
      hasControls: move && !held,
      hasBorders: !navigate,
      lockMovementX: !move || held,
      lockMovementY: !move || held,
      lockScalingX: !move || held,
      lockScalingY: !move || held,
      lockRotation: !move || held,
    })
    if (object instanceof Textbox) object.set({ editable: move && !held })
  }
  holdLockedSelection(canvas)
  canvas.requestRenderAll()
}

export function selectElementOnCanvas(canvas: Canvas, elementId: string | null): void {
  if (!elementId) {
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    return
  }
  const object = findObjectByElementId(canvas, elementId)
  if (!object) {
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    return
  }
  if (canvas.getActiveObject() !== object) {
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
  }
}
