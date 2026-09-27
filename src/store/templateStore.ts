import { create } from "zustand"
import { SAMPLE_DECORATIONS, type EditorAsset } from "../models/asset"
import {
  PHOTO_SHAPES,
  PHOTO_SHAPE_LABELS,
  type AlbumTemplate,
  type Background,
  type PhotoElement,
  type PhotoShape,
  type TemplateElement,
} from "../models/template"
import type { ElementTransform } from "../services/canvasService"
import { cutOutSubject } from "../services/subjectCutout"
import {
  cloneTemplate,
  createDecorationElement,
  createEmptyTemplate,
  createPhotoElement,
  createTextElement,
  duplicateElement,
  generateTemplate,
  getSampleTemplate,
  parseTemplateJson,
  serializeTemplate,
  type GenerateTemplateOptions,
} from "../services/templateService"
import { createId, lockedWithAncestors, moveLayers, nextZIndex, placeLayer, sortByZIndex, swapZIndex } from "../utils/geometry"
import { clearedGrade } from "../utils/photoGrade"
import { autoRetouch } from "../utils/photoRetouch"
import { shapeSize, shapeSvgUrl, strokeGraphic } from "../utils/shapeGraphic"
import { validateTemplate, type ValidationError } from "../utils/validation"

export type EditorTool =
  | "zoom"
  | "hand"
  | "select"
  | "marquee"
  | "quick-select"
  | "wand"
  | "redeye"
  | "heal"
  | "clone"
  | "blur"
  | "sponge"
  | "blemish"
  | "skin"
  | "teeth"
  | "eye"
  | "face"
  | "cleanup"
  | "object"
  | "brush"
  | "eraser"
  | "bucket"
  | "shape"
  | "text"
  | "pencil"
  | "crop"
  | "cookie"
  | "subject"
  | "photo"
  | "decoration"

export type WorkspaceMode = "quick" | "guided" | "advanced"
export type DockPanel =
  | "options"
  | "photos"
  | "layers"
  | "effects"
  | "filters"
  | "styles"
  | "graphics"
  | "library"
  | "more"
export type ViewKind = "actual" | "fit" | "fill" | "print"
export type SheetGuide = { id: string; axis: "x" | "y"; at: number }
export type MutationOrigin = "ui" | "canvas" | "load"

export interface DroppedPhoto {
  url: string
  x: number
  y: number
  width?: number
  height?: number
  replaceId?: string | null
}
export const BACKGROUND_LAYER_ID = "__background"

const HISTORY_LIMIT = 50

interface TemplateStore {
  template: AlbumTemplate
  selectedId: string | null
  selectedIds: string[]
  /** Which part of a framed photo is selected: the shape, or the picture inside it. */
  layerFocus: "frame" | "photo" | null
  hiddenIds: string[]
  /** Framed photos whose picture is hidden while the frame stays visible. */
  hiddenPhotoIds: string[]
  selectedAssetId: string | null
  tool: EditorTool
  workspaceMode: WorkspaceMode
  dockPanel: DockPanel
  foregroundColor: string
  backgroundColor: string
  shapeKind: PhotoShape
  scrollAll: boolean
  showGrid: boolean
  snapToGrid: boolean
  snapToGuides: boolean
  snapToObjects: boolean
  fullScreen: boolean
  theme: "light" | "dark"
  showBefore: boolean
  maskEdit: boolean
  maskDraw: boolean
  guides: SheetGuide[]
  viewRequest: { token: number; kind: ViewKind } | null
  origin: MutationOrigin
  history: AlbumTemplate[]
  historyIndex: number
  validationErrors: ValidationError[]
  statusMessage: string | null
  subjectBusy: boolean
  refineId: string | null
  clipboard: TemplateElement | null
  pasteSerial: number

  setTemplateName: (name: string) => void
  selectElement: (id: string | null, additive?: boolean, focus?: "frame" | "photo" | null) => void
  selectMany: (ids: string[]) => void
  setTool: (tool: EditorTool) => void
  setWorkspaceMode: (mode: WorkspaceMode) => void
  setDockPanel: (panel: DockPanel) => void
  toggleDock: (panel: DockPanel) => void
  setForegroundColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  setShapeKind: (shape: PhotoShape) => void
  loadTemplate: (template: AlbumTemplate, statusMessage: string) => void
  restoreSession: (template: AlbumTemplate, guides: SheetGuide[], selectedId: string | null) => void
  swapColors: () => void
  setScrollAll: (value: boolean) => void
  setShowGrid: (value: boolean) => void
  setSnapToGrid: (value: boolean) => void
  setSnapToGuides: (value: boolean) => void
  setSnapToObjects: (value: boolean) => void
  setFullScreen: (value: boolean) => void
  setTheme: (theme: "light" | "dark") => void
  setShowBefore: (value: boolean) => void
  setMaskEdit: (value: boolean) => void
  setMaskDraw: (value: boolean) => void
  addGuide: (axis: SheetGuide["axis"], at: number) => void
  moveGuide: (id: string, at: number) => void
  removeGuide: (id: string) => void
  requestView: (kind: ViewKind) => void
  toneSelectedPhoto: (kind: "redeye" | "heal" | "blur" | "sponge" | "brush") => void
  removeBackground: (id: string) => Promise<void>
  openSelectionRefine: (id: string) => void
  closeSelectionRefine: () => void
  applySelectionRefine: (id: string, imageUrl: string) => void
  applyPhotoLook: (patch: Partial<Pick<PhotoElement, "brightness" | "contrast" | "saturate" | "blur">>) => void
  resetPhotoLook: () => void
  applyAutoRetouch: (kind: "skin" | "face") => Promise<void>
  placeMark: (x: number, y: number, kind: "shape" | "pencil") => void
  placeStroke: (points: { x: number; y: number }[], kind: "pencil" | "brush") => void
  paintBucket: (elementId?: string) => void
  cyclePhotoShape: () => void
  setSelectedAsset: (id: string | null) => void
  setStatus: (message: string | null) => void

  addPhotoSlot: (imageUrl?: string) => void
  addLayer: (kind: "photo" | "text" | "shape" | "decoration", imageUrl?: string) => void
  dropPhotos: (drops: DroppedPhoto[]) => void
  addText: () => void
  addDecoration: (asset?: EditorAsset) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  renameLayer: (id: string, name: string) => void
  toggleLocked: (id: string) => void
  groupSelected: () => void
  ungroupSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  bringForward: () => void
  sendBackward: () => void
  bringToFront: () => void
  sendToBack: () => void
  flipSelected: (axis: "x" | "y") => void
  rotateSelected: (delta: number) => void
  alignSelected: (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") => void
  addTextAt: (x: number, y: number) => void
  commitHistory: () => void
  toggleHidden: (id: string) => void
  togglePhotoHidden: (id: string) => void
  selectAndReorder: (id: string, direction: "forward" | "backward") => void
  reorderLayer: (id: string, targetId: string, before: boolean, placement?: "beside" | "into" | "root") => void
  newTemplate: (options: { name: string; width: number; height: number; dpi: number }) => void

  updateElement: (id: string, patch: Partial<TemplateElement>, origin?: MutationOrigin) => void
  applyCanvasTransform: (id: string, transform: ElementTransform, commit: boolean) => void
  setBackground: (background: Background) => void
  applyPhotoAsset: (asset: EditorAsset) => void
  applyDecorationAsset: (asset: EditorAsset) => void
  applyBackgroundAsset: (asset: EditorAsset) => void

  undo: () => void
  redo: () => void
  generate: (options: GenerateTemplateOptions) => void
  loadFromJson: (raw: string) => void
  exportJson: () => string
  resetToSample: () => void
}

function withHistory(
  template: AlbumTemplate,
  history: AlbumTemplate[],
  historyIndex: number,
): Pick<TemplateStore, "template" | "history" | "historyIndex" | "validationErrors"> {
  const nextHistory = history.slice(0, historyIndex + 1)
  nextHistory.push(cloneTemplate(template))
  if (nextHistory.length > HISTORY_LIMIT) nextHistory.shift()
  return {
    template,
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
    validationErrors: validateTemplate(template).errors,
  }
}

const LAYOUT_KEYS = new Set([
  "x",
  "y",
  "rotation",
  "panX",
  "panY",
  "photoScale",
  "id",
  "zIndex",
  "parentId",
  "name",
  "type",
  "assetUrl",
  "assetId",
  "imageUrl",
  "sourceUrl",
  "text",
  "mask",
  "clipping",
])

function applyElementPatch(element: TemplateElement, patch: Partial<TemplateElement>, includeLayout: boolean): TemplateElement {
  const nextPatch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!includeLayout && LAYOUT_KEYS.has(key)) continue
    nextPatch[key] = value
  }
  if (Object.keys(nextPatch).length === 0) return element
  let next = { ...element, ...nextPatch } as TemplateElement
  const sizeChanged = nextPatch.width !== undefined || nextPatch.height !== undefined
  if (next.type === "decoration" && next.shape && (nextPatch.fill !== undefined || nextPatch.shape !== undefined || sizeChanged)) {
    const shape = next.shape
    const fill = next.fill ?? "#111111"
    next = {
      ...next,
      fill,
      assetId: next.assetId.startsWith("shape-") ? next.assetId : "shape-layer",
      assetUrl: shapeSvgUrl(shape, fill, next.width, next.height),
    }
  }
  return next
}

function unlockedIds(elements: TemplateElement[], ids: string[]): string[] {
  const locked = lockedWithAncestors(elements)
  return ids.filter((id) => !locked.has(id))
}

function lockedEdit(elements: TemplateElement[], id: string | null | undefined): { statusMessage: string } | null {
  if (!id || !lockedWithAncestors(elements).has(id)) return null
  return { statusMessage: "Unlock the layer before editing it." }
}

function withoutParent(element: TemplateElement): TemplateElement {
  if (!element.parentId) return element
  const next = { ...element }
  delete next.parentId
  return next
}

function duplicateLayers(elements: TemplateElement[], ids: string[]): TemplateElement[] {
  const copying = new Set<string>()
  const include = (id: string) => {
    if (copying.has(id)) return
    copying.add(id)
    for (const element of elements) {
      if (element.parentId === id) include(element.id)
    }
  }
  for (const id of ids) include(id)
  const ordered = sortByZIndex(
    elements.filter((element) => copying.has(element.id)),
    "asc",
  )
  const idMap = new Map<string, string>()
  for (const element of ordered) idMap.set(element.id, createId(element.type))
  let zIndex = nextZIndex(elements)
  return ordered.map((element) => ({
    ...structuredClone(element),
    id: idMap.get(element.id) ?? createId(element.type),
    parentId: element.parentId && idMap.has(element.parentId) ? idMap.get(element.parentId) : element.parentId,
    x: element.x + 180,
    y: element.y + 180,
    zIndex: zIndex++,
    locked: false,
  }))
}

function chosenIds(state: { selectedId: string | null; selectedIds: string[] }): string[] {
  const ids = state.selectedIds.filter((id) => id && id !== BACKGROUND_LAYER_ID)
  if (ids.length > 0) return ids
  if (state.selectedId && state.selectedId !== BACKGROUND_LAYER_ID) return [state.selectedId]
  return []
}

function selectedElement(template: AlbumTemplate, selectedId: string | null): TemplateElement | undefined {
  return template.elements.find((element) => element.id === selectedId)
}

function clampTone(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toneLabel(kind: "redeye" | "heal" | "blur" | "sponge" | "brush"): string {
  if (kind === "redeye") return "Red eye reduced the red in this photo"
  if (kind === "heal") return "Healing brush lightened this photo"
  if (kind === "blur") return "Blurred this photo"
  if (kind === "sponge") return "Sponge added saturation"
  return "Brush added contrast"
}

function photoPatch(
  state: {
    template: AlbumTemplate
    history: AlbumTemplate[]
    historyIndex: number
  },
  next: PhotoElement,
  statusMessage: string,
) {
  const template = {
    ...state.template,
    elements: state.template.elements.map((element) => (element.id === next.id ? next : element)),
  }
  return {
    origin: "ui" as const,
    ...withHistory(template, state.history, state.historyIndex),
    statusMessage,
  }
}

const initialTemplate = getSampleTemplate()

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  template: initialTemplate,
  selectedId: null,
  selectedIds: [],
  layerFocus: null,
  hiddenIds: [],
  hiddenPhotoIds: [],
  selectedAssetId: SAMPLE_DECORATIONS[0]?.id ?? null,
  tool: "hand",
  workspaceMode: "advanced",
  dockPanel: "options",
  foregroundColor: "#111111",
  backgroundColor: "#ffffff",
  shapeKind: "rectangle",
  scrollAll: false,
  showGrid: true,
  snapToGrid: true,
  snapToGuides: true,
  snapToObjects: true,
  fullScreen: false,
  theme: typeof localStorage === "undefined" || localStorage.getItem("azent-editor-theme") !== "dark" ? "light" : "dark",
  showBefore: false,
  maskEdit: false,
  maskDraw: false,
  guides: [],
  viewRequest: null,
  origin: "load",
  history: [cloneTemplate(initialTemplate)],
  historyIndex: 0,
  validationErrors: validateTemplate(initialTemplate).errors,
  statusMessage: null,
  subjectBusy: false,
  refineId: null,
  clipboard: null,
  pasteSerial: 0,

  setTemplateName: (name) =>
    set((state) => ({
      origin: "ui",
      ...withHistory({ ...state.template, name }, state.history, state.historyIndex),
    })),

  selectElement: (id, additive = false, focus = null) =>
    set((state) => {
      if (!id) return { selectedId: null, selectedIds: [], layerFocus: null, maskEdit: false, maskDraw: false }
      const keepMask = state.selectedId === id
      if (!additive) {
        return {
          selectedId: id,
          selectedIds: [id],
          layerFocus: focus,
          maskEdit: keepMask ? state.maskEdit : false,
          maskDraw: keepMask ? state.maskDraw : false,
        }
      }
      const exists = state.selectedIds.includes(id)
      const selectedIds = exists ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id]
      const nextId = selectedIds[selectedIds.length - 1] ?? null
      return {
        selectedId: nextId,
        selectedIds,
        layerFocus: focus,
        maskEdit: nextId === state.selectedId ? state.maskEdit : false,
        maskDraw: nextId === state.selectedId ? state.maskDraw : false,
        statusMessage: selectedIds.length > 1 ? `${selectedIds.length} layers selected` : state.statusMessage,
      }
    }),
  selectMany: (ids) =>
    set((state) => {
      const selectedIds = ids.filter((id) => id && id !== BACKGROUND_LAYER_ID)
      const same =
        selectedIds.length === state.selectedIds.length && selectedIds.every((id) => state.selectedIds.includes(id))
      if (same) return state
      return {
        selectedId: selectedIds[selectedIds.length - 1] ?? null,
        selectedIds,
        statusMessage: selectedIds.length > 1 ? `${selectedIds.length} layers selected` : state.statusMessage,
      }
    }),
  setTool: (tool) => set({ tool }),
  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
  setDockPanel: (panel) => set({ dockPanel: panel }),
  toggleDock: (panel) =>
    set((state) => ({ dockPanel: state.dockPanel === panel ? "options" : panel })),
  setForegroundColor: (color) => set({ foregroundColor: color }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  swapColors: () =>
    set((state) => ({
      foregroundColor: state.backgroundColor,
      backgroundColor: state.foregroundColor,
    })),
  setShapeKind: (shape) =>
    set((state) => {
      const current = state.template.elements.find((element) => element.id === state.selectedId)
      const isShape = current?.type === "decoration" && (Boolean(current.shape) || current.assetId.startsWith("shape-"))
      if (!current || !isShape || current.type !== "decoration") {
        return { shapeKind: shape, statusMessage: `Shape: ${PHOTO_SHAPE_LABELS[shape]}` }
      }
      const fill = current.fill ?? state.foregroundColor
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) =>
          element.id === current.id && element.type === "decoration"
            ? {
                ...element,
                shape,
                fill,
                assetUrl: shapeSvgUrl(shape, fill, element.width, element.height),
              }
            : element,
        ),
      }
      return {
        shapeKind: shape,
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `Shape: ${PHOTO_SHAPE_LABELS[shape]}`,
      }
    }),
  loadTemplate: (template, statusMessage) =>
    set((state) => ({
      origin: "load" as const,
      selectedId: null,
      selectedIds: [],
      layerFocus: null,
      hiddenIds: [],
      hiddenPhotoIds: [],
      tool: "select" as const,
      ...withHistory(template, state.history, state.historyIndex),
      statusMessage,
    })),
  restoreSession: (template, guides, selectedId) =>
    set(() => {
      const known = template.elements.some((element) => element.id === selectedId) || selectedId === BACKGROUND_LAYER_ID
      return {
        origin: "load" as const,
        template,
        guides,
        selectedId: known ? selectedId : null,
        selectedIds: known && selectedId ? [selectedId] : [],
        layerFocus: null,
        hiddenIds: [],
        hiddenPhotoIds: [],
        maskEdit: false,
        maskDraw: false,
        history: [cloneTemplate(template)],
        historyIndex: 0,
        validationErrors: validateTemplate(template).errors,
        statusMessage: "Restored your last editing session.",
      }
    }),
  setScrollAll: (value) => set({ scrollAll: value, statusMessage: value ? "Scroll all windows is on. This spread is the only open window." : "Scroll all windows is off." }),
  setShowGrid: (value) => set({ showGrid: value, statusMessage: value ? "Grid is on." : "Grid is off." }),
  setSnapToGrid: (value) => set({ snapToGrid: value, statusMessage: value ? "Snap to grid is on." : "Snap to grid is off." }),
  setSnapToGuides: (value) =>
    set({
      snapToGuides: value,
      statusMessage: value ? "Snap to guides is on. Drag from a ruler to place a guide." : "Snap to guides is off.",
    }),
  setSnapToObjects: (value) =>
    set({
      snapToObjects: value,
      statusMessage: value ? "Snap to objects is on. Dragged layers line up with other layers." : "Snap to objects is off.",
    }),
  setFullScreen: (value) =>
    set((state) => ({
      fullScreen: value,
      viewRequest: { token: (state.viewRequest?.token ?? 0) + 1, kind: "fit" as const },
      statusMessage: value ? "Full screen. Press Escape to show the panels." : "Panels are back.",
    })),
  setTheme: (theme) => {
    localStorage.setItem("azent-editor-theme", theme)
    document.documentElement.dataset.theme = theme
    set({ theme, statusMessage: theme === "dark" ? "Dark theme." : "Light theme." })
  },
  setShowBefore: (value) =>
    set({
      showBefore: value,
      statusMessage: value
        ? "Before. Photos show their original color, with no tone edits or background removal."
        : "After. Photos show the current edits.",
    }),
  setMaskEdit: (value) => set(value ? { maskEdit: true } : { maskEdit: false, maskDraw: false }),
  setMaskDraw: (value) => set(value ? { maskDraw: true, maskEdit: true } : { maskDraw: false }),
  addGuide: (axis, at) =>
    set((state) => ({
      guides: [...state.guides, { id: createId("guide"), axis, at }],
      statusMessage: "Guide placed. Drag a layer and it locks to the line.",
    })),
  moveGuide: (id, at) =>
    set((state) => ({
      guides: state.guides.map((guide) => (guide.id === id ? { ...guide, at } : guide)),
    })),
  removeGuide: (id) =>
    set((state) => ({
      guides: state.guides.filter((guide) => guide.id !== id),
      statusMessage: "Guide removed.",
    })),
  requestView: (kind) =>
    set((state) => ({
      viewRequest: { token: (state.viewRequest?.token ?? 0) + 1, kind },
    })),
  setSelectedAsset: (id) => set({ selectedAssetId: id }),
  setStatus: (message) => set({ statusMessage: message }),

  addPhotoSlot: (imageUrl) =>
    set((state) => {
      const element = createPhotoElement(nextZIndex(state.template.elements))
      if (imageUrl) element.imageUrl = imageUrl
      const template = {
        ...state.template,
        elements: [...state.template.elements, element],
      }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        tool: "select" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: "Added photo slot",
      }
    }),

  addLayer: (kind, imageUrl) =>
    set((state) => {
      const sheetW = state.template.canvas.width
      const sheetH = state.template.canvas.height
      const shift = (state.template.elements.length % 6) * Math.round(sheetW * 0.015)
      const zIndex = nextZIndex(state.template.elements)
      let element: TemplateElement
      let statusMessage = "Added a layer on top."
      if (kind === "photo") {
        element = createPhotoElement(zIndex)
        element.width = Math.round(sheetW * 0.28)
        element.height = Math.round(element.width * 0.72)
        element.border = { width: 28, color: "#FFFFFF" }
        element.shadow = true
        if (imageUrl) element.imageUrl = imageUrl
        statusMessage = imageUrl
          ? "Photo layer added on top."
          : "Empty photo layer added on top. Drop a photo onto it, or choose one from the Photo Bin."
      } else if (kind === "text") {
        element = createTextElement(zIndex)
        element.width = Math.round(sheetW * 0.4)
        element.height = Math.round(sheetH * 0.12)
        element.fontSize = Math.round(sheetH * 0.045)
        statusMessage = "Text layer added on top."
      } else if (kind === "shape") {
        const color = state.foregroundColor
        const box = shapeSize(state.shapeKind, Math.round(Math.min(sheetW, sheetH) * 0.28))
        element = createDecorationElement(
          {
            id: "shape-layer",
            name: "Shape",
            kind: "decoration",
            url: shapeSvgUrl(state.shapeKind, color, box.width, box.height),
          },
          zIndex,
        )
        element.width = box.width
        element.height = box.height
        element.shape = state.shapeKind
        element.fill = color
        statusMessage = `${PHOTO_SHAPE_LABELS[state.shapeKind]} added. Change it from the shape list while it is selected.`
      } else {
        element = createDecorationElement(
          SAMPLE_DECORATIONS.find((item) => item.id === state.selectedAssetId) ?? SAMPLE_DECORATIONS[0],
          zIndex,
        )
        element.width = Math.round(sheetW * 0.16)
        element.height = element.width
        statusMessage = "Decoration layer added on top."
      }
      element.x = Math.round((sheetW - element.width) / 2 + shift)
      element.y = Math.round((sheetH - element.height) / 2 + shift)
      return {
        origin: "ui" as const,
        selectedId: element.id,
        tool: "select" as const,
        ...withHistory(
          { ...state.template, elements: [...state.template.elements, element] },
          state.history,
          state.historyIndex,
        ),
        statusMessage,
      }
    }),

  dropPhotos: (drops) =>
    set((state) => {
      if (drops.length === 0) return state
      let elements = [...state.template.elements]
      let selectedId = state.selectedId
      const sheetW = state.template.canvas.width
      const sheetH = state.template.canvas.height
      for (const drop of drops) {
        if (drop.replaceId) {
          elements = elements.map((element) =>
            element.id === drop.replaceId && element.type === "photo"
              ? { ...element, imageUrl: drop.url, panX: 0, panY: 0, photoScale: 1 }
              : element,
          )
          selectedId = drop.replaceId
          continue
        }
        const width = drop.width ?? Math.round(sheetW * 0.24)
        const height = drop.height ?? Math.round(width * 0.72)
        const element = createPhotoElement(nextZIndex(elements))
        element.imageUrl = drop.url
        element.width = width
        element.height = height
        element.shadow = true
        element.x = Math.min(Math.max(0, drop.x - width / 2), Math.max(0, sheetW - width))
        element.y = Math.min(Math.max(0, drop.y - height / 2), Math.max(0, sheetH - height))
        elements = [...elements, element]
        selectedId = element.id
      }
      const filled = drops.some((drop) => drop.replaceId)
      return {
        origin: "ui" as const,
        selectedId,
        tool: "select" as const,
        ...withHistory({ ...state.template, elements }, state.history, state.historyIndex),
        statusMessage: filled
          ? "Dropped into the frame. It stays here so you can edit it."
          : "Dropped onto the sheet. Drag the handles to place it.",
      }
    }),

  addText: () =>
    set((state) => {
      const element = createTextElement(nextZIndex(state.template.elements))
      const template = {
        ...state.template,
        elements: [...state.template.elements, element],
      }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        tool: "select" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: "Added text",
      }
    }),

  addDecoration: (asset) =>
    set((state) => {
      const deco =
        asset ??
        SAMPLE_DECORATIONS.find((item) => item.id === state.selectedAssetId) ??
        SAMPLE_DECORATIONS[0]
      const element = createDecorationElement(deco, nextZIndex(state.template.elements))
      const template = {
        ...state.template,
        elements: [...state.template.elements, element],
      }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        selectedAssetId: deco.id,
        tool: "select" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `Added ${deco.name}`,
      }
    }),

  deleteSelected: () =>
    set((state) => {
      const chosen = chosenIds(state)
      if (chosen.length === 0) return state
      const ids = new Set(unlockedIds(state.template.elements, chosen))
      if (ids.size === 0) return { statusMessage: "Unlock a layer before deleting it." }
      const template = {
        ...state.template,
        elements: state.template.elements
          .filter((element) => !ids.has(element.id))
          .map((element) => (element.parentId && ids.has(element.parentId) ? withoutParent(element) : element)),
      }
      const skipped = chosen.length - ids.size
      return {
        origin: "ui" as const,
        selectedId: null,
        selectedIds: [],
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage:
          skipped > 0
            ? `Deleted ${ids.size} layers. ${skipped} stayed because they are locked.`
            : ids.size > 1
              ? `Deleted ${ids.size} layers`
              : "Deleted layer",
      }
    }),

  duplicateSelected: () =>
    set((state) => {
      const ids = chosenIds(state)
      if (ids.length === 0) return state
      const copies = duplicateLayers(state.template.elements, ids)
      if (copies.length === 0) return state
      const template = {
        ...state.template,
        elements: [...state.template.elements, ...copies],
      }
      const topCopies = copies.filter((element) => !element.parentId || !copies.some((item) => item.id === element.parentId))
      return {
        origin: "ui" as const,
        selectedId: topCopies[0]?.id ?? copies[0].id,
        selectedIds: topCopies.map((element) => element.id),
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: copies.length > 1 ? `Duplicated ${copies.length} layers` : "Duplicated layer",
      }
    }),

  renameLayer: (id, name) =>
    set((state) => {
      const current = state.template.elements.find((element) => element.id === id)
      if (!current) return state
      const blocked = lockedEdit(state.template.elements, id)
      if (blocked) return blocked
      const trimmed = name.trim()
      const nextName = current.type === "group" ? trimmed || "Group" : trimmed
      if ((current.name ?? "") === nextName) return state
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) => {
          if (element.id !== id) return element
          if (!nextName) {
            const next = { ...element }
            delete next.name
            return next
          }
          return { ...element, name: nextName }
        }),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: "Renamed layer",
      }
    }),

  toggleLocked: (id) =>
    set((state) => {
      const current = state.template.elements.find((element) => element.id === id)
      if (!current) return state
      if (!current.locked && lockedWithAncestors(state.template.elements).has(id)) {
        return { statusMessage: "Unlock the group first." }
      }
      const locked = !current.locked
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) => (element.id === id ? { ...element, locked } : element)),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: locked ? "Layer locked. It stays in place until you unlock it." : "Layer unlocked.",
      }
    }),

  groupSelected: () =>
    set((state) => {
      const ids = new Set(chosenIds(state))
      if (ids.size === 0) return { statusMessage: "Select layers to group." }
      const tops = state.template.elements.filter((element) => ids.has(element.id) && !(element.parentId && ids.has(element.parentId)))
      if (tops.length === 0) return state
      const content = tops.filter((element) => element.type !== "group")
      const boxes = content.length > 0 ? content : tops
      const minX = Math.min(...boxes.map((element) => element.x))
      const minY = Math.min(...boxes.map((element) => element.y))
      const maxX = Math.max(...boxes.map((element) => element.x + element.width))
      const maxY = Math.max(...boxes.map((element) => element.y + element.height))
      const parents = new Set(tops.map((element) => element.parentId ?? ""))
      const sharedParent = parents.size === 1 ? tops[0].parentId : undefined
      const groupNumber = state.template.elements.filter((element) => element.type === "group").length + 1
      const group: TemplateElement = {
        id: createId("group"),
        type: "group",
        name: `Group ${groupNumber}`,
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.max(1, Math.round(maxX - minX)),
        height: Math.max(1, Math.round(maxY - minY)),
        rotation: 0,
        zIndex: nextZIndex(state.template.elements),
        parentId: sharedParent,
      }
      const topIds = new Set(tops.map((element) => element.id))
      const template = {
        ...state.template,
        elements: [
          ...state.template.elements.map((element) => (topIds.has(element.id) ? { ...element, parentId: group.id } : element)),
          group,
        ],
      }
      return {
        origin: "ui" as const,
        selectedId: group.id,
        selectedIds: [group.id],
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: tops.length > 1 ? `Grouped ${tops.length} layers.` : "Grouped the layer.",
      }
    }),

  ungroupSelected: () =>
    set((state) => {
      const ids = new Set(chosenIds(state))
      if (ids.size === 0) return { statusMessage: "Select a group to ungroup." }
      const groups = state.template.elements.filter((element) => ids.has(element.id) && element.type === "group")
      if (groups.length > 0) {
        const groupIds = new Set(groups.map((element) => element.id))
        const parentOf = new Map(groups.map((element) => [element.id, element.parentId]))
        const released = state.template.elements.filter((element) => element.parentId && groupIds.has(element.parentId))
        const template = {
          ...state.template,
          elements: state.template.elements
            .filter((element) => !groupIds.has(element.id))
            .map((element) => {
              if (!element.parentId || !groupIds.has(element.parentId)) return element
              const parentId = parentOf.get(element.parentId)
              return parentId ? { ...element, parentId } : withoutParent(element)
            }),
        }
        return {
          origin: "ui" as const,
          selectedId: released[0]?.id ?? null,
          selectedIds: released.map((element) => element.id),
          ...withHistory(template, state.history, state.historyIndex),
          statusMessage: groups.length > 1 ? `Ungrouped ${groups.length} groups.` : "Ungrouped the layers.",
        }
      }
      const nested = state.template.elements.filter((element) => ids.has(element.id) && element.parentId)
      if (nested.length === 0) return { statusMessage: "Select a group to ungroup." }
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) => {
          if (!ids.has(element.id) || !element.parentId) return element
          const parent = state.template.elements.find((item) => item.id === element.parentId)
          return parent?.parentId ? { ...element, parentId: parent.parentId } : withoutParent(element)
        }),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: nested.length > 1 ? `Moved ${nested.length} layers out of the group.` : "Moved the layer out of the group.",
      }
    }),

  copySelected: () =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (!current) {
        return { statusMessage: "Select a layer to copy" }
      }
      return {
        clipboard: structuredClone(current),
        pasteSerial: 0,
        statusMessage: "Copied layer",
      }
    }),

  pasteClipboard: () =>
    set((state) => {
      if (!state.clipboard) {
        return { statusMessage: "Nothing to paste" }
      }
      const pasteSerial = state.pasteSerial + 1
      const copy = duplicateElement(state.clipboard, nextZIndex(state.template.elements))
      copy.x = state.clipboard.x + 180 * pasteSerial
      copy.y = state.clipboard.y + 180 * pasteSerial
      const template = {
        ...state.template,
        elements: [...state.template.elements, copy],
      }
      return {
        origin: "ui" as const,
        selectedId: copy.id,
        pasteSerial,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: "Pasted layer",
      }
    }),

  bringForward: () =>
    set((state) => {
      const ids = chosenIds(state)
      if (ids.length === 0) return state
      const template = {
        ...state.template,
        elements: moveLayers(state.template.elements, ids, "forward"),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: ids.length > 1 ? "Moved the selected layers forward" : "Moved layer forward",
      }
    }),

  sendBackward: () =>
    set((state) => {
      const ids = chosenIds(state)
      if (ids.length === 0) return state
      const template = {
        ...state.template,
        elements: moveLayers(state.template.elements, ids, "backward"),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: ids.length > 1 ? "Moved the selected layers backward" : "Moved layer backward",
      }
    }),

  bringToFront: () =>
    set((state) => {
      const ids = chosenIds(state)
      if (ids.length === 0) return state
      const template = {
        ...state.template,
        elements: moveLayers(state.template.elements, ids, "front"),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: ids.length > 1 ? "Brought the selected layers to the front" : "Brought layer to the front",
      }
    }),

  sendToBack: () =>
    set((state) => {
      const ids = chosenIds(state)
      if (ids.length === 0) return state
      const template = {
        ...state.template,
        elements: moveLayers(state.template.elements, ids, "back"),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: ids.length > 1 ? "Sent the selected layers to the back" : "Sent layer to the back",
      }
    }),

  flipSelected: (axis) =>
    set((state) => {
      const ids = new Set(unlockedIds(state.template.elements, chosenIds(state)))
      if (ids.size === 0) return chosenIds(state).length > 0 ? { statusMessage: "Unlock a layer before editing it." } : state
      const key = axis === "x" ? "flipX" : "flipY"
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) =>
          ids.has(element.id) && element.type !== "group" ? { ...element, [key]: !element[key] } : element,
        ),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: axis === "x" ? "Flipped horizontal" : "Flipped vertical",
      }
    }),

  rotateSelected: (delta) =>
    set((state) => {
      const ids = new Set(unlockedIds(state.template.elements, chosenIds(state)))
      if (ids.size === 0) return chosenIds(state).length > 0 ? { statusMessage: "Unlock a layer before editing it." } : state
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) =>
          ids.has(element.id) && element.type !== "group"
            ? { ...element, rotation: Math.round((element.rotation + delta) * 10) / 10 }
            : element,
        ),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: ids.size > 1 ? "Rotated the selected layers" : "Rotated layer",
      }
    }),

  alignSelected: (edge) =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (!current) return state
      if (lockedWithAncestors(state.template.elements).has(current.id) || current.type === "group") {
        return { statusMessage: current.type === "group" ? "Align the layers inside the group." : "Unlock a layer before editing it." }
      }
      const { width, height } = state.template.canvas
      const patch: Partial<TemplateElement> = {}
      if (edge === "left") patch.x = 0
      if (edge === "center") patch.x = Math.round((width - current.width) / 2)
      if (edge === "right") patch.x = Math.round(width - current.width)
      if (edge === "top") patch.y = 0
      if (edge === "middle") patch.y = Math.round((height - current.height) / 2)
      if (edge === "bottom") patch.y = Math.round(height - current.height)
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) =>
          element.id === current.id ? ({ ...element, ...patch } as TemplateElement) : element,
        ),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: "Aligned layer",
      }
    }),

  addTextAt: (x, y) =>
    set((state) => {
      const element = createTextElement(nextZIndex(state.template.elements))
      element.x = Math.round(x - element.width / 2)
      element.y = Math.round(y - element.height / 2)
      element.color = state.foregroundColor
      const template = {
        ...state.template,
        elements: [...state.template.elements, element],
      }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        tool: "select" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: "Added text",
      }
    }),

  commitHistory: () =>
    set((state) => ({
      origin: "ui" as const,
      ...withHistory(state.template, state.history, state.historyIndex),
    })),

  toggleHidden: (id) =>
    set((state) => {
      const hidden = state.hiddenIds.includes(id)
      return {
        origin: "ui" as const,
        hiddenIds: hidden ? state.hiddenIds.filter((item) => item !== id) : [...state.hiddenIds, id],
        selectedId: hidden ? state.selectedId : state.selectedId === id ? null : state.selectedId,
      }
    }),

  togglePhotoHidden: (id) =>
    set((state) => {
      const hidden = state.hiddenPhotoIds.includes(id)
      return {
        hiddenPhotoIds: hidden ? state.hiddenPhotoIds.filter((item) => item !== id) : [...state.hiddenPhotoIds, id],
        statusMessage: hidden ? "Photo shown inside the frame" : "Photo hidden. The frame stays.",
      }
    }),

  selectAndReorder: (id, direction) =>
    set((state) => {
      const template = {
        ...state.template,
        elements: swapZIndex(state.template.elements, id, direction),
      }
      return {
        origin: "ui" as const,
        selectedId: id,
        ...withHistory(template, state.history, state.historyIndex),
      }
    }),

  reorderLayer: (id, targetId, before, placement = "beside") =>
    set((state) => {
      const elements = placeLayer(state.template.elements, id, targetId, before, placement)
      const changed = elements.some((element) => {
        const previous = state.template.elements.find((item) => item.id === element.id)
        return previous !== undefined && (previous.zIndex !== element.zIndex || previous.parentId !== element.parentId)
      })
      if (!changed) return state
      const template = { ...state.template, elements }
      const parent = placement === "into" ? state.template.elements.find((element) => element.id === targetId) : undefined
      const parentLabel = parent
        ? parent.name ||
          (parent.type === "photo" && parent.role !== "wash" && parent.role !== "cutout"
            ? PHOTO_SHAPE_LABELS[parent.shape]
            : parent.type === "text"
              ? parent.text
              : parent.type)
        : ""
      return {
        origin: "ui" as const,
        selectedId: id,
        selectedIds: [id],
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: parent ? `Moved inside ${parentLabel}` : placement === "root" ? "Layer moved to the back" : "Layer order updated",
      }
    }),

  newTemplate: (options) =>
    set((state) => {
      const template = createEmptyTemplate(options.name.trim() || "Untitled", options)
      return {
        origin: "load" as const,
        selectedId: null,
        selectedIds: [],
        layerFocus: null,
        hiddenIds: [],
        hiddenPhotoIds: [],
        tool: "select" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `New template ${template.canvas.width}×${template.canvas.height} at ${template.canvas.dpi} dpi`,
      }
    }),

  updateElement: (id, patch, origin = "ui") =>
    set((state) => {
      const locked = lockedWithAncestors(state.template.elements)
      if (locked.has(id)) return origin === "canvas" ? state : { statusMessage: "Unlock the layer before editing it." }
      const chosen = origin === "canvas" ? [id] : chosenIds(state).filter((item) => !locked.has(item))
      const share = chosen.includes(id) && chosen.length > 1
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) => {
          if (element.id === id) return applyElementPatch(element, patch, true)
          const source = state.template.elements.find((item) => item.id === id)
          if (!share || !chosen.includes(element.id) || !source || source.type !== element.type) return element
          return applyElementPatch(element, patch, false)
        }),
      }
      if (origin === "canvas") {
        return {
          origin,
          template,
          validationErrors: validateTemplate(template).errors,
        }
      }
      return {
        origin,
        ...withHistory(template, state.history, state.historyIndex),
      }
    }),

  applyCanvasTransform: (id, transform, commit) =>
    set((state) => {
      if (lockedWithAncestors(state.template.elements).has(id)) return state
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) =>
          element.id === id ? { ...element, ...transform } : element,
        ),
      }
      if (!commit) {
        return {
          origin: "canvas" as const,
          template,
          validationErrors: validateTemplate(template).errors,
        }
      }
      return {
        origin: "canvas" as const,
        ...withHistory(template, state.history, state.historyIndex),
      }
    }),

  setBackground: (background) =>
    set((state) => ({
      origin: "ui" as const,
      ...withHistory({ ...state.template, background }, state.history, state.historyIndex),
      statusMessage: "Updated background",
    })),

  applyPhotoAsset: (asset) =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (current?.type === "photo") {
        const blocked = lockedEdit(state.template.elements, current.id)
        if (blocked) return blocked
        const isCutout = asset.id.includes("cutout") || current.role === "cutout"
        const template = {
          ...state.template,
          elements: state.template.elements.map((element) =>
            element.id === current.id && element.type === "photo"
              ? {
                  ...element,
                  imageUrl: asset.url,
                  ...(isCutout
                    ? { role: "cutout" as const, objectFit: "contain" as const }
                    : {}),
                }
              : element,
          ),
        }
        return {
          origin: "ui" as const,
          selectedAssetId: asset.id,
          ...withHistory(template, state.history, state.historyIndex),
          statusMessage: `Assigned ${asset.name}`,
        }
      }
      const element = createPhotoElement(nextZIndex(state.template.elements))
      element.imageUrl = asset.url
      if (asset.id.includes("cutout")) {
        element.role = "cutout"
        element.objectFit = "contain"
      }
      const template = {
        ...state.template,
        elements: [...state.template.elements, element],
      }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        selectedAssetId: asset.id,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `Added ${asset.name}`,
      }
    }),

  applyDecorationAsset: (asset) =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (current?.type === "decoration") {
        const blocked = lockedEdit(state.template.elements, current.id)
        if (blocked) return blocked
        const template = {
          ...state.template,
          elements: state.template.elements.map((element) =>
            element.id === current.id && element.type === "decoration"
              ? { ...element, assetId: asset.id, assetUrl: asset.url }
              : element,
          ),
        }
        return {
          origin: "ui" as const,
          selectedAssetId: asset.id,
          ...withHistory(template, state.history, state.historyIndex),
          statusMessage: `Replaced decoration with ${asset.name}`,
        }
      }
      const element = createDecorationElement(asset, nextZIndex(state.template.elements))
      const template = {
        ...state.template,
        elements: [...state.template.elements, element],
      }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        selectedAssetId: asset.id,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `Added ${asset.name}`,
      }
    }),

  applyBackgroundAsset: (asset) =>
    set((state) => ({
      origin: "ui" as const,
      selectedAssetId: asset.id,
      ...withHistory(
        {
          ...state.template,
          background: { type: "image", assetId: asset.id, url: asset.url, opacity: 1 },
        },
        state.history,
        state.historyIndex,
      ),
      statusMessage: `Background: ${asset.name}`,
    })),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state
      const historyIndex = state.historyIndex - 1
      const template = cloneTemplate(state.history[historyIndex])
      return {
        origin: "load" as const,
        template,
        historyIndex,
        selectedId: template.elements.some((element) => element.id === state.selectedId) ? state.selectedId : null,
        selectedIds: state.selectedIds.filter((id) => template.elements.some((element) => element.id === id)),
        validationErrors: validateTemplate(template).errors,
        statusMessage: "Undo",
      }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const historyIndex = state.historyIndex + 1
      const template = cloneTemplate(state.history[historyIndex])
      return {
        origin: "load" as const,
        template,
        historyIndex,
        selectedId: template.elements.some((element) => element.id === state.selectedId) ? state.selectedId : null,
        selectedIds: state.selectedIds.filter((id) => template.elements.some((element) => element.id === id)),
        validationErrors: validateTemplate(template).errors,
        statusMessage: "Redo",
      }
    }),

  generate: (options) =>
    set((state) => {
      const template = generateTemplate(options)
      return {
        origin: "load" as const,
        selectedId: null,
        hiddenIds: [],
        hiddenPhotoIds: [],
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `Generated ${template.name}`,
      }
    }),

  loadFromJson: (raw) => {
    const template = parseTemplateJson(raw)
    set((state) => ({
      origin: "load" as const,
      selectedId: null,
      hiddenIds: [],
      hiddenPhotoIds: [],
      ...withHistory(template, state.history, state.historyIndex),
      statusMessage: `Loaded ${template.name}`,
    }))
  },

  exportJson: () => serializeTemplate(get().template),

  toneSelectedPhoto: (kind) =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (!current || current.type !== "photo") {
        return { ...state, statusMessage: "Click a photo first." }
      }
      if (lockedWithAncestors(state.template.elements).has(current.id)) {
        return { statusMessage: "Unlock the photo before editing it." }
      }
      const next = { ...current }
      if (kind === "redeye") {
        next.saturate = clampTone((next.saturate ?? 0) - 18, -100, 100)
        next.contrast = clampTone((next.contrast ?? 0) + 8, -100, 100)
      } else if (kind === "heal") {
        next.brightness = clampTone((next.brightness ?? 0) + 8, -100, 100)
        next.blur = 0
      } else if (kind === "blur") {
        next.blur = clampTone((next.blur ?? 0) + 2, 0, 24)
      } else if (kind === "sponge") {
        next.saturate = clampTone((next.saturate ?? 0) + 15, -100, 100)
      } else {
        next.contrast = clampTone((next.contrast ?? 0) + 8, -100, 100)
      }
      return photoPatch(state, next, toneLabel(kind))
    }),

  removeBackground: async (id) => {
    const state = get()
    if (state.subjectBusy) return
    const current = state.template.elements.find((element) => element.id === id)
    if (!current || current.type !== "photo") {
      set({ statusMessage: "Click a photo to remove its background." })
      return
    }
    if (lockedWithAncestors(state.template.elements).has(id)) {
      set({ statusMessage: "Unlock the photo before editing it." })
      return
    }
    if (current.role === "wash") {
      set({ statusMessage: "That layer is the backdrop. Choose the portrait instead." })
      return
    }
    if (!current.imageUrl) {
      set({ statusMessage: "Add a photo to this frame first." })
      return
    }
    set({ subjectBusy: true, statusMessage: "Selecting subject…", selectedId: id, selectedIds: [id] })
    try {
      const imageUrl = await cutOutSubject(current.imageUrl)
      const latest = get().template.elements.find((element) => element.id === id)
      if (!latest || latest.type !== "photo") {
        set({ subjectBusy: false, statusMessage: "That photo is no longer on the sheet." })
        return
      }
      get().updateElement(id, {
        imageUrl,
        sourceUrl: latest.sourceUrl ?? latest.imageUrl,
        role: "cutout",
        shape: "rectangle",
        border: undefined,
        shadow: true,
      })
      set({
        subjectBusy: false,
        tool: "select",
        statusMessage: "Background removed. Use Crop & select if the edge needs a correction.",
      })
    } catch (error) {
      set({
        subjectBusy: false,
        statusMessage: error instanceof Error ? error.message : "Could not select the subject.",
      })
    }
  },

  openSelectionRefine: (id) => {
    const current = get().template.elements.find((element) => element.id === id)
    if (!current || current.type !== "photo" || current.role === "wash") {
      set({ statusMessage: "Choose a portrait to crop or select." })
      return
    }
    if (!current.imageUrl) {
      set({ statusMessage: "Add a photo to this frame first." })
      return
    }
    if (lockedWithAncestors(get().template.elements).has(id)) {
      set({ statusMessage: "Unlock the layer before editing it." })
      return
    }
    set({
      refineId: id,
      selectedId: id,
      selectedIds: [id],
      statusMessage: "Drag a box to keep that area, or paint to remove and restore.",
    })
  },

  closeSelectionRefine: () => set({ refineId: null, statusMessage: "Selection closed." }),

  applySelectionRefine: (id, imageUrl) =>
    set((state) => {
      const current = state.template.elements.find((element) => element.id === id)
      if (!current || current.type !== "photo") return { refineId: null }
      const blocked = lockedEdit(state.template.elements, id)
      if (blocked) return { ...blocked, refineId: null }
      return {
        ...photoPatch(
          state,
          {
            ...current,
            imageUrl,
            sourceUrl: current.sourceUrl ?? current.imageUrl,
            role: "cutout",
            shape: "rectangle",
            border: undefined,
            shadow: true,
          },
          "Selection applied. What you kept stays, and the rest of the background is gone.",
        ),
        refineId: null,
        tool: "select",
      }
    }),

  applyPhotoLook: (patch) =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (!current || current.type !== "photo") {
        return { ...state, statusMessage: "Select a photo to apply this look." }
      }
      const blocked = lockedEdit(state.template.elements, current.id)
      if (blocked) return blocked
      return photoPatch(state, { ...current, ...patch }, "Applied look")
    }),

  resetPhotoLook: () =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (!current || current.type !== "photo") return state
      const blocked = lockedEdit(state.template.elements, current.id)
      if (blocked) return blocked
      return photoPatch(state, { ...current, ...clearedGrade() }, "Reset photo tone")
    }),

  applyAutoRetouch: async (kind) => {
    const state = get()
    const current = selectedElement(state.template, state.selectedId)
    if (!current || current.type !== "photo" || !current.imageUrl) {
      set({ statusMessage: "Select a photo first." })
      return
    }
    if (lockedWithAncestors(state.template.elements).has(current.id)) {
      set({ statusMessage: "Unlock the photo before editing it." })
      return
    }
    set({ statusMessage: kind === "face" ? "Enhancing the face…" : "Smoothing skin…" })
    const imageUrl = await autoRetouch(current, kind)
    if (!imageUrl) {
      set({ statusMessage: "Could not retouch that photo." })
      return
    }
    const latest = get().template.elements.find((element) => element.id === current.id)
    if (!latest || latest.type !== "photo") return
    get().updateElement(current.id, {
      imageUrl,
      sourceUrl: latest.sourceUrl ?? latest.imageUrl,
      ...(kind === "face" ? { sharpness: Math.min(100, (latest.sharpness ?? 0) + 12), vibrance: Math.min(100, (latest.vibrance ?? 0) + 8) } : {}),
    })
    set({
      statusMessage: kind === "face" ? "Face enhancement smoothed skin and lifted clarity." : "Skin smoothing applied.",
    })
  },

  placeMark: (x, y, kind) =>
    set((state) => {
      const wide = kind === "pencil"
      const color = state.foregroundColor
      const shape = wide ? "rectangle" : state.shapeKind
      const sheet = Math.min(state.template.canvas.width, state.template.canvas.height)
      const box = wide
        ? { width: Math.round(sheet * 0.35), height: Math.max(14, Math.round(sheet * 0.008)) }
        : shapeSize(shape, Math.round(sheet * 0.28))
      const element = createDecorationElement(
        {
          id: wide ? "pencil-mark" : "shape-mark",
          name: wide ? "Pencil" : "Shape",
          kind: "decoration",
          url: shapeSvgUrl(shape, color, box.width, box.height),
        },
        nextZIndex(state.template.elements),
      )
      element.x = Math.round(x - box.width / 2)
      element.y = Math.round(y - box.height / 2)
      element.width = box.width
      element.height = box.height
      if (!wide) {
        element.shape = shape
        element.fill = color
      }
      const template = { ...state.template, elements: [...state.template.elements, element] }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: wide ? "Drew a pencil stroke" : `Placed a ${PHOTO_SHAPE_LABELS[shape].toLowerCase()}`,
      }
    }),

  placeStroke: (points, kind) =>
    set((state) => {
      if (points.length === 0) return state
      const sheet = Math.min(state.template.canvas.width, state.template.canvas.height)
      const strokeWidth = Math.max(kind === "brush" ? 28 : 8, Math.round(sheet * (kind === "brush" ? 0.016 : 0.004)))
      const graphic = strokeGraphic(points, state.foregroundColor, strokeWidth)
      const element = createDecorationElement(
        {
          id: kind === "brush" ? "brush-mark" : "pencil-mark",
          name: kind === "brush" ? "Brush" : "Pencil",
          kind: "decoration",
          url: graphic.url,
        },
        nextZIndex(state.template.elements),
      )
      element.name = kind === "brush" ? "Brush" : "Pencil"
      element.x = graphic.x
      element.y = graphic.y
      element.width = graphic.width
      element.height = graphic.height
      element.assetUrl = graphic.url
      const template = { ...state.template, elements: [...state.template.elements, element] }
      return {
        origin: "ui" as const,
        selectedId: element.id,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: kind === "brush" ? "Painted a brush stroke" : "Drew a pencil stroke",
      }
    }),

  paintBucket: (elementId) =>
    set((state) => {
      const target = state.template.elements.find((element) => element.id === elementId)
      if (target && lockedWithAncestors(state.template.elements).has(target.id)) {
        return { statusMessage: "Unlock the layer before editing it." }
      }
      if (target?.type === "text") {
        const template = {
          ...state.template,
          elements: state.template.elements.map((element) =>
            element.id === target.id && element.type === "text"
              ? { ...element, color: state.foregroundColor }
              : element,
          ),
        }
        return {
          origin: "ui" as const,
          selectedId: target.id,
          ...withHistory(template, state.history, state.historyIndex),
          statusMessage: "Filled the type with the foreground color",
        }
      }
      return {
        origin: "ui" as const,
        ...withHistory(
          { ...state.template, background: { type: "color", value: state.foregroundColor } },
          state.history,
          state.historyIndex,
        ),
        statusMessage: "Filled the background",
      }
    }),

  cyclePhotoShape: () =>
    set((state) => {
      const current = selectedElement(state.template, state.selectedId)
      if (!current || current.type !== "photo") {
        return { ...state, statusMessage: "Cookie cutter works on a photo. Click one first." }
      }
      const blocked = lockedEdit(state.template.elements, current.id)
      if (blocked) return blocked
      const index = PHOTO_SHAPES.indexOf(current.shape)
      const shape = PHOTO_SHAPES[(index + 1) % PHOTO_SHAPES.length]
      const template = {
        ...state.template,
        elements: state.template.elements.map((element) =>
          element.id === current.id && element.type === "photo" ? { ...element, shape } : element,
        ),
      }
      return {
        origin: "ui" as const,
        ...withHistory(template, state.history, state.historyIndex),
        statusMessage: `Cookie cutter: ${shape}`,
      }
    }),

  resetToSample: () =>
    set((state) => ({
      origin: "load" as const,
      selectedId: null,
      selectedIds: [],
      hiddenIds: [],
      hiddenPhotoIds: [],
      ...withHistory(getSampleTemplate(), state.history, state.historyIndex),
      statusMessage: "Blank template",
    })),
}))

