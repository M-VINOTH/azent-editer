import { useEffect, useRef } from "react"
import { ActiveSelection, Canvas, Point, Textbox, type FabricObject } from "fabric"
import {
  applyToolMode,
  findObjectByElementId,
  getElementId,
  holdLockedSelection,
  objectIsHeld,
  readTransform,
  previewPhotoBitmap,
  refreshPhotoObject,
  repaintPhotoCompare,
  renderTemplateOnCanvas,
  setPhotoCompare,
  selectElementOnCanvas,
  syncTemplateOnCanvas,
} from "../../services/canvasService"
import { BACKGROUND_LAYER_ID, useTemplateStore } from "../../store/templateStore"
import { PHOTO_DROP_TYPE } from "../../models/asset"
import { clearSizeGuides, paintSizeGuides, snapLayerSize } from "../../services/sizeSnap"
import { clearSmartGuides, paintSmartGuides, snapSmartGuides } from "../../services/smartGuides"
import { snapToSheetGuides } from "../../services/sheetGuides"
import type { SheetGuide } from "../../store/templateStore"
import { fitScale, hiddenWithAncestors, lockedWithAncestors } from "../../utils/geometry"
import type { LayerMask, PhotoElement } from "../../models/template"
import { hitMask, layerLocalPoint, maskNormalized, moveMask, paintMaskOverlay, type MaskGesture } from "../../utils/layerMask"
import {
  finishRetouch,
  hasCloneSource,
  openRetouch,
  paintRetouch,
  photoImagePoint,
  RETOUCH_BRUSHES,
  retouchCanvas,
  setCloneSource,
  type RetouchBrush,
} from "../../utils/photoRetouch"

export function AlbumCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const horizontalRulerRef = useRef<HTMLCanvasElement>(null)
  const verticalRulerRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<HTMLCanvasElement>(null)
  const guideDragRef = useRef<GuideDrag | null>(null)
  const maskDragRef = useRef<MaskDrag | null>(null)
  const maskClaimRef = useRef(false)
  const syncingRef = useRef(false)
  const showGrid = useTemplateStore((state) => state.showGrid)
  const guides = useTemplateStore((state) => state.guides)
  const fabricRef = useRef<Canvas | null>(null)
  const renderTokenRef = useRef(0)
  const previousTemplateRef = useRef<typeof template | null>(null)
  const viewRef = useRef({ zoom: 1, x: 0, y: 0 })

  const template = useTemplateStore((state) => state.template)
  const origin = useTemplateStore((state) => state.origin)
  const selectedId = useTemplateStore((state) => state.selectedId)
  const selectedIds = useTemplateStore((state) => state.selectedIds)
  const hiddenIds = useTemplateStore((state) => state.hiddenIds)
  const hiddenPhotoIds = useTemplateStore((state) => state.hiddenPhotoIds)
  const tool = useTemplateStore((state) => state.tool)
  const subjectBusy = useTemplateStore((state) => state.subjectBusy)
  const selectElement = useTemplateStore((state) => state.selectElement)
  const applyCanvasTransform = useTemplateStore((state) => state.applyCanvasTransform)
  const updateElement = useTemplateStore((state) => state.updateElement)
  const addTextAt = useTemplateStore((state) => state.addTextAt)
  const commitHistory = useTemplateStore((state) => state.commitHistory)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const designRef = useRef({ width: template.canvas.width, height: template.canvas.height, dpi: template.canvas.dpi })
  designRef.current = { width: template.canvas.width, height: template.canvas.height, dpi: template.canvas.dpi }
  const toolRef = useRef(tool)
  toolRef.current = tool
  const suppressClearRef = useRef(false)
  const zoomCapNoted = useRef(false)
  const maskEdit = useTemplateStore((state) => state.maskEdit)
  useEffect(() => {
    fabricRef.current?.requestRenderAll()
  }, [maskEdit, selectedId])

  const applyView = (canvas: Canvas, host: HTMLElement) => {
    const bounds = host.getBoundingClientRect()
    const design = designRef.current
    const fitted = fitScale(Math.max(120, bounds.width - 56), Math.max(80, bounds.height - 56), design.width, design.height)
    const zoom = clampZoom(viewRef.current.zoom, maxSheetZoom(fitted.width, fitted.height))
    viewRef.current.zoom = zoom
    const width = Math.max(1, Math.round(fitted.width * zoom))
    const height = Math.max(1, Math.round(fitted.height * zoom))
    if (canvas.getWidth() !== width || canvas.getHeight() !== height) {
      canvas.setDimensions({ width, height })
    }
    canvas.setZoom(fitted.scale * zoom)
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transform = `translate(calc(-50% + ${viewRef.current.x}px), calc(-50% + ${viewRef.current.y}px))`
    }
    syncRulers()
    canvas.requestRenderAll()
  }

  const syncRulers = () => {
    const host = hostRef.current
    const sheet = sheetRef.current
    const design = designRef.current
    if (!host || !sheet || design.width < 1) return
    const hostBox = host.getBoundingClientRect()
    const sheetBox = sheet.getBoundingClientRect()
    paintRulers(horizontalRulerRef.current, verticalRulerRef.current, {
      hostWidth: hostBox.width,
      hostHeight: hostBox.height,
      originX: sheetBox.left - hostBox.left,
      originY: sheetBox.top - hostBox.top,
      scale: sheetBox.width / design.width,
      dpi: design.dpi,
    })
    paintSheetGrid(gridRef.current, sheetBox.width, sheetBox.height, design.width, design.dpi, useTemplateStore.getState().showGrid)
    paintSheetGuides(gridRef.current, sheetBox.width, sheetBox.height, design.width, design.height, useTemplateStore.getState().guides, guideDragRef.current)
  }

  const zoomAt = (canvas: Canvas, host: HTMLElement, clientX: number, clientY: number, nextZoom: number) => {
    const bounds = host.getBoundingClientRect()
    const design = designRef.current
    const fitted = fitScale(Math.max(120, bounds.width - 56), Math.max(80, bounds.height - 56), design.width, design.height)
    const oldZoom = viewRef.current.zoom || 1
    const oldW = Math.max(1, Math.round(fitted.width * oldZoom))
    const oldH = Math.max(1, Math.round(fitted.height * oldZoom))
    const oldLeft = (bounds.width - oldW) / 2 + viewRef.current.x
    const oldTop = (bounds.height - oldH) / 2 + viewRef.current.y
    const localX = clientX - bounds.left - oldLeft
    const localY = clientY - bounds.top - oldTop
    const limit = maxSheetZoom(fitted.width, fitted.height)
    const next = clampZoom(nextZoom, limit)
    if (Math.abs(next - oldZoom) < 0.0001) {
      if (nextZoom > limit + 0.001 && !zoomCapNoted.current) {
        zoomCapNoted.current = true
        setStatus("Zoom stops here so the sheet does not freeze.")
      }
      return
    }
    const newW = Math.max(1, Math.round(fitted.width * next))
    const newH = Math.max(1, Math.round(fitted.height * next))
    viewRef.current.zoom = next
    viewRef.current.x = clientX - bounds.left - localX * (newW / oldW) - (bounds.width - newW) / 2
    viewRef.current.y = clientY - bounds.top - localY * (newH / oldH) - (bounds.height - newH) / 2
    applyView(canvas, host)
  }

  const applyViewRef = useRef(applyView)
  applyViewRef.current = applyView
  const zoomAtRef = useRef(zoomAt)
  zoomAtRef.current = zoomAt
  const syncRulersRef = useRef(syncRulers)
  syncRulersRef.current = syncRulers

  const sceneFromClientRef = useRef<(clientX: number, clientY: number) => { x: number; y: number; inside: boolean } | null>(() => null)
  sceneFromClientRef.current = (clientX, clientY) => {
    const sheet = sheetRef.current
    const design = designRef.current
    if (!sheet || design.width < 1) return null
    const box = sheet.getBoundingClientRect()
    const scale = box.width / design.width
    if (scale <= 0) return null
    return {
      x: (clientX - box.left) / scale,
      y: (clientY - box.top) / scale,
      inside: clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom,
    }
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = guideDragRef.current
      if (!drag) return
      const scene = sceneFromClientRef.current(event.clientX, event.clientY)
      if (!scene) return
      drag.at = drag.axis === "x" ? scene.x : scene.y
      syncRulersRef.current()
    }
    const up = (event: PointerEvent) => {
      const drag = guideDragRef.current
      if (!drag) return
      guideDragRef.current = null
      const scene = sceneFromClientRef.current(event.clientX, event.clientY)
      const store = useTemplateStore.getState()
      const at = scene ? (drag.axis === "x" ? scene.x : scene.y) : drag.at
      if (!scene?.inside) {
        if (drag.id) store.removeGuide(drag.id)
      } else if (drag.id) store.moveGuide(drag.id, at)
      else store.addGuide(drag.axis, at)
      syncRulersRef.current()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    const canvasEl = canvasElRef.current
    if (!host || !canvasEl) return

    const canvas = new Canvas(canvasEl, {
      preserveObjectStacking: true,
      selection: true,
      selectionKey: ["shiftKey", "ctrlKey", "metaKey"],
      backgroundColor: "rgba(0,0,0,0)",
      stopContextMenu: true,
      fireRightClick: false,
      uniformScaling: false,
    })
    fabricRef.current = canvas

    const resize = () => applyViewRef.current(canvas, host)
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const commitTransform = (commit: boolean) => {
      if (toolRef.current !== "select") return
      const objects = canvas.getActiveObjects()
      if (objects.length === 0) return
      for (const object of objects) {
        const id = getElementId(object)
        if (!id || id === "__fold-guide") continue
        applyCanvasTransform(id, readTransform(object), false)
      }
      if (commit) commitHistory()
    }

    let retouch: { id: string; kind: RetouchBrush; lastX: number; lastY: number } | null = null
    let retouchFrame = 0
    let crop: { id: string; lastX: number; lastY: number; moved: boolean } | null = null
    let hand: { x: number; y: number; panX: number; panY: number } | null = null
    let stroke: { kind: "pencil" | "brush"; points: { x: number; y: number }[] } | null = null
    let wheelCommit = 0

    const photoInsideEdit = (): PhotoElement | undefined => {
      const state = useTemplateStore.getState()
      if (state.selectedId === BACKGROUND_LAYER_ID) {
        const wash = state.template.elements.find((item) => item.type === "photo" && item.role === "wash")
        return wash?.type === "photo" ? wash : undefined
      }
      const selected = state.template.elements.find((item) => item.id === state.selectedId)
      return selected?.type === "photo" ? selected : undefined
    }

    const idsFromCanvas = () =>
      canvas
        .getActiveObjects()
        .map((object) => getElementId(object))
        .filter((id): id is string => Boolean(id && id !== "__fold-guide"))

    canvas.on("selection:created", () => {
      holdLockedSelection(canvas)
      useTemplateStore.getState().selectMany(idsFromCanvas())
    })
    canvas.on("selection:updated", () => {
      holdLockedSelection(canvas)
      useTemplateStore.getState().selectMany(idsFromCanvas())
    })
    canvas.on("selection:cleared", (event) => {
      if (suppressClearRef.current) return
      if (!event.e) return
      selectElement(null)
    })
    const pinHeld = (
      target: FabricObject | undefined,
      transform: { original?: { left: number; top: number; scaleX: number; scaleY: number; angle: number } } | undefined,
    ) => {
      if (!target || !objectIsHeld(target)) return false
      const original = transform?.original
      if (original) {
        target.set({
          left: original.left,
          top: original.top,
          scaleX: original.scaleX,
          scaleY: original.scaleY,
          angle: original.angle,
        })
        target.setCoords()
      }
      return true
    }
    let sizeHint = ""
    canvas.on("object:moving", (event) => {
      if (pinHeld(event.target, event.transform)) return
      clearSizeGuides()
      const guided = event.target ? snapToSheetGuides(event.target, { x: false, y: false }) : { x: false, y: false }
      const locked = event.target ? snapSmartGuides(canvas, event.target, guided) : guided
      if (event.target) snapObjectToGrid(event.target, locked)
      commitTransform(false)
    })
    canvas.on("object:scaling", (event) => {
      if (pinHeld(event.target, event.transform)) return
      clearSmartGuides()
      const hint = snapLayerSize(canvas, event.target, event.transform)
      if (hint && hint !== sizeHint) setStatus(hint)
      sizeHint = hint ?? ""
      commitTransform(false)
    })
    canvas.on("object:rotating", (event) => {
      if (pinHeld(event.target, event.transform)) return
      clearSizeGuides()
      clearSmartGuides()
      commitTransform(false)
    })
    canvas.on("object:modified", (event) => {
      if (syncingRef.current) return
      if (pinHeld(event.target, event.transform)) return
      clearSizeGuides()
      clearSmartGuides()
      sizeHint = ""
      commitTransform(true)
      canvas.requestRenderAll()
    })
    canvas.on("after:render", ({ ctx }) => {
      paintSizeGuides(canvas, ctx)
      paintSmartGuides(canvas, ctx)
      const editing = useTemplateStore.getState()
      if (!editing.maskEdit) return
      const masked = editing.template.elements.find((item) => item.id === editing.selectedId)
      if (!masked || masked.type === "group" || !masked.mask) return
      paintMaskOverlay(ctx, canvas.viewportTransform, masked)
    })
    canvas.on("text:editing:exited", (event) => {
      const target = event.target
      if (!(target instanceof Textbox)) return
      const id = getElementId(target)
      if (!id) return
      updateElement(id, { text: target.text ?? "" })
    })

    const claimMaskPointer = (x: number, y: number, zoom: number) => {
      const state = useTemplateStore.getState()
      if (!state.maskEdit && !state.maskDraw) return false
      const element = state.template.elements.find((item) => item.id === state.selectedId)
      if (!element || element.type === "group" || !element.mask) return false
      if (lockedWithAncestors(state.template.elements).has(element.id)) return false
      if (state.maskDraw && (element.mask.kind === "polygon" || element.mask.kind === "path")) {
        const point = maskNormalized(element.mask, layerLocalPoint(element, x, y))
        state.updateElement(element.id, { mask: { ...element.mask, points: [...(element.mask.points ?? []), point] } })
        return true
      }
      const gesture = hitMask(element, x, y, 14 / Math.max(zoom, 0.05))
      if (!gesture) return false
      maskDragRef.current = {
        id: element.id,
        gesture,
        origin: element.mask,
        startLocal: layerLocalPoint(element, x, y),
        moved: false,
      }
      return true
    }

    canvas.on("mouse:down:before", (opt) => {
      maskClaimRef.current = false
      const point = canvas.getScenePoint(opt.e)
      if (claimMaskPointer(point.x, point.y, canvas.getZoom() || 1)) {
        maskClaimRef.current = true
        return
      }
      const mode = toolRef.current
      if (mode !== "select" && mode !== "hand") return
      const hit = guideAt(point.x, point.y, canvas.getZoom() || 1)
      if (!hit) return
      guideDragRef.current = { id: hit.id, axis: hit.axis, at: hit.at }
    })
    const paintRetouchAt = (id: string, kind: RetouchBrush, designX: number, designY: number) => {
      const element = useTemplateStore.getState().template.elements.find((item) => item.id === id)
      const source = retouchCanvas()
      if (!element || element.type !== "photo" || !source) return
      const local = layerLocalPoint(element, designX, designY)
      const point = photoImagePoint(element, local.x, local.y, source.width, source.height)
      if (!point) return
      const radius = Math.max(10, Math.min(source.width, source.height) * 0.03)
      paintRetouch(kind, point.x, point.y, radius)
      if (retouchFrame) return
      retouchFrame = window.requestAnimationFrame(() => {
        retouchFrame = 0
        const live = retouchCanvas()
        const current = useTemplateStore.getState().template.elements.find((item) => item.id === id)
        if (live && current?.type === "photo") previewPhotoBitmap(canvas, current, live)
      })
    }

    canvas.on("mouse:down", (opt) => {
      if (maskClaimRef.current || guideDragRef.current) {
        const editable = canvas as Canvas & { _currentTransform: unknown; _groupSelector: unknown }
        editable._currentTransform = null
        editable._groupSelector = null
        return
      }
      const pointerEvent = opt.e as MouseEvent
      const mode = toolRef.current
      if (mode === "hand") {
        hand = {
          x: pointerEvent.clientX,
          y: pointerEvent.clientY,
          panX: viewRef.current.x,
          panY: viewRef.current.y,
        }
        canvas.defaultCursor = "grabbing"
        return
      }
      if (mode === "zoom") {
        const factor = pointerEvent.altKey ? 1 / 1.25 : 1.25
        zoomAtRef.current(canvas, host, pointerEvent.clientX, pointerEvent.clientY, viewRef.current.zoom * factor)
        return
      }
      if (mode === "text") {
        const point = canvas.getScenePoint(pointerEvent)
        const underId = opt.target ? getElementId(opt.target) : undefined
        const under = underId
          ? useTemplateStore.getState().template.elements.find((item) => item.id === underId)
          : undefined
        if (under?.type === "text") {
          selectElement(under.id)
          return
        }
        addTextAt(point.x, point.y)
        return
      }
      if (mode === "pencil" || mode === "brush") {
        const point = canvas.getScenePoint(pointerEvent)
        stroke = { kind: mode, points: [{ x: point.x, y: point.y }] }
        return
      }
      if (mode === "shape") {
        const point = canvas.getScenePoint(pointerEvent)
        useTemplateStore.getState().placeMark(point.x, point.y, mode)
        return
      }
      if (mode === "bucket") {
        const id = opt.target ? getElementId(opt.target) : undefined
        useTemplateStore.getState().paintBucket(id)
        return
      }
      const clickedId = opt.target ? getElementId(opt.target) : undefined
      if (mode === "subject") {
        if (!clickedId) {
          setStatus("Click a photo to remove its background.")
          return
        }
        selectElement(clickedId)
        void useTemplateStore.getState().removeBackground(clickedId)
        return
      }
      if (clickedId && (mode === "quick-select" || mode === "wand")) {
        selectElement(clickedId)
        return
      }
      if (clickedId && (mode === "face" || mode === "cleanup")) {
        selectElement(clickedId)
        if (mode === "cleanup") void useTemplateStore.getState().removeBackground(clickedId)
        else void useTemplateStore.getState().applyAutoRetouch("face")
        return
      }
      if (RETOUCH_BRUSHES.has(mode)) {
        const found = clickedId
          ? useTemplateStore.getState().template.elements.find((item) => item.id === clickedId)
          : undefined
        if (!found || found.type !== "photo" || found.role === "wash" || !found.imageUrl) {
          setStatus("Drag on a photo.")
          return
        }
        if (opt.target && objectIsHeld(opt.target)) {
          setStatus("Unlock the layer before editing it.")
          return
        }
        selectElement(found.id)
        const point = canvas.getScenePoint(pointerEvent)
        if (mode === "clone" && pointerEvent.altKey) {
          void openRetouch(found).then((size) => {
            if (!size) return
            const local = layerLocalPoint(found, point.x, point.y)
            const mapped = photoImagePoint(found, local.x, local.y, size.width, size.height)
            if (!mapped) return
            setCloneSource(mapped.x, mapped.y)
            setStatus("Clone source set. Drag to paint it.")
          })
          return
        }
        if (mode === "clone" && !hasCloneSource()) {
          setStatus("Option-click the photo to set the clone source, then drag.")
          return
        }
        retouch = { id: found.id, kind: mode as RetouchBrush, lastX: point.x, lastY: point.y }
        void openRetouch(found).then(() => {
          if (retouch?.id !== found.id) return
          paintRetouchAt(found.id, retouch.kind, point.x, point.y)
        })
        return
      }
      if (mode === "eraser") {
        if (!clickedId) {
          setStatus("Click a layer to erase it.")
          return
        }
        selectElement(clickedId)
        useTemplateStore.getState().deleteSelected()
        return
      }
      if (clickedId && mode === "cookie") {
        selectElement(clickedId)
        useTemplateStore.getState().cyclePhotoShape()
        return
      }
      if (mode === "crop") {
        const hitId = opt.target ? getElementId(opt.target) : undefined
        if (!hitId) return
        const found = useTemplateStore.getState().template.elements.find((item) => item.id === hitId)
        if (!found) return
        selectElement(found.id)
        if (found.type !== "photo") return
        if (opt.target && objectIsHeld(opt.target)) {
          setStatus("Unlock the layer before editing it.")
          return
        }
        crop = { id: found.id, lastX: pointerEvent.clientX, lastY: pointerEvent.clientY, moved: false }
        return
      }
    })

    canvas.on("mouse:dblclick", (opt) => {
      if (useTemplateStore.getState().maskDraw) {
        useTemplateStore.getState().setMaskDraw(false)
        useTemplateStore.getState().setStatus("Point drawing is off.")
        return
      }
      const id = opt.target ? getElementId(opt.target) : undefined
      if (!id) return
      const element = useTemplateStore.getState().template.elements.find((item) => item.id === id)
      if (!element || element.type !== "photo" || element.role === "wash") return
      if (opt.target && objectIsHeld(opt.target)) {
        setStatus("Unlock the layer before editing it.")
        return
      }
      selectElement(element.id)
      useTemplateStore.getState().setTool("crop")
      setStatus("Drag to move the photo inside the frame. Scroll to zoom it.")
    })

    const onMove = (event: MouseEvent) => {
      if (retouch) {
        const point = canvas.getScenePoint(event)
        const dx = point.x - retouch.lastX
        const dy = point.y - retouch.lastY
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 18))
        for (let step = 1; step <= steps; step += 1) {
          paintRetouchAt(retouch.id, retouch.kind, retouch.lastX + (dx * step) / steps, retouch.lastY + (dy * step) / steps)
        }
        retouch.lastX = point.x
        retouch.lastY = point.y
        return
      }
      const drag = maskDragRef.current
      if (drag) {
        const point = canvas.getScenePoint(event)
        const current = useTemplateStore.getState().template.elements.find((item) => item.id === drag.id)
        if (!current || current.type === "group" || !current.mask) return
        const next = moveMask(drag.origin, drag.gesture, drag.startLocal, layerLocalPoint(current, point.x, point.y))
        drag.moved = true
        updateElement(drag.id, { mask: next }, "canvas")
        return
      }
      if (stroke) {
        const point = clientToDesign(canvas, event.clientX, event.clientY)
        const last = stroke.points[stroke.points.length - 1]
        if (Math.hypot(point.x - last.x, point.y - last.y) < 4) return
        stroke.points.push(point)
        return
      }
      if (hand) {
        viewRef.current.x = hand.panX + (event.clientX - hand.x)
        viewRef.current.y = hand.panY + (event.clientY - hand.y)
        const sheet = sheetRef.current
        if (sheet) {
          sheet.style.transform = `translate(calc(-50% + ${viewRef.current.x}px), calc(-50% + ${viewRef.current.y}px))`
        }
        syncRulersRef.current()
        return
      }
      if (!crop) return
      const zoom = canvas.getZoom() || 1
      const dx = (event.clientX - crop.lastX) / zoom
      const dy = (event.clientY - crop.lastY) / zoom
      crop.lastX = event.clientX
      crop.lastY = event.clientY
      if (Math.abs(dx) + Math.abs(dy) < 0.4) return
      crop.moved = true
      const current = useTemplateStore.getState().template.elements.find((item) => item.id === crop?.id)
      if (!current || current.type !== "photo") return
      const next: PhotoElement = {
        ...current,
        panX: (current.panX ?? 0) + dx,
        panY: (current.panY ?? 0) + dy,
      }
      updateElement(next.id, { panX: next.panX, panY: next.panY }, "canvas")
      void refreshPhotoObject(canvas, next)
    }

    const onUp = () => {
      if (retouch) {
        const done = retouch
        retouch = null
        const element = useTemplateStore.getState().template.elements.find((item) => item.id === done.id)
        const url = finishRetouch(element?.type === "photo" && element.role === "cutout")
        if (url && element?.type === "photo") {
          updateElement(done.id, { imageUrl: url, sourceUrl: element.sourceUrl ?? element.imageUrl })
        }
      }
      if (maskDragRef.current) {
        const moved = maskDragRef.current.moved
        maskDragRef.current = null
        if (moved) commitHistory()
      }
      if (stroke) {
        useTemplateStore.getState().placeStroke(stroke.points, stroke.kind)
        stroke = null
      }
      if (crop?.moved) commitHistory()
      crop = null
      if (hand) {
        hand = null
        canvas.defaultCursor = "grab"
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)

    let zoomFrame = 0
    let queuedZoom = viewRef.current.zoom
    const onWheel = (event: WheelEvent) => {
      if (!host.contains(event.target as Node)) return
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
      if (toolRef.current === "crop") {
        const photo = photoInsideEdit()
        if (photo) {
          const photoScale = clampPhotoScale((photo.photoScale ?? 1) * factor)
          const next = { ...photo, photoScale }
          updateElement(photo.id, { photoScale }, "canvas")
          void refreshPhotoObject(canvas, next)
          window.clearTimeout(wheelCommit)
          wheelCommit = window.setTimeout(() => commitHistory(), 180)
          return
        }
      }
      queuedZoom = (zoomFrame ? queuedZoom : viewRef.current.zoom) * factor
      const clientX = event.clientX
      const clientY = event.clientY
      if (zoomFrame) return
      zoomFrame = window.requestAnimationFrame(() => {
        zoomFrame = 0
        zoomAtRef.current(canvas, host, clientX, clientY, queuedZoom)
      })
    }
    host.addEventListener("wheel", onWheel, { passive: false })

    const onHostDown = (event: MouseEvent) => {
      const sheet = sheetRef.current
      if (sheet?.contains(event.target as Node)) return
      const mode = toolRef.current
      if (mode === "pencil" || mode === "brush" || mode === "shape" || mode === "text" || mode === "bucket" || mode === "eraser") {
        setStatus("Click the sheet to use this tool.")
      }
      suppressClearRef.current = true
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      suppressClearRef.current = false
      selectElement(null)
    }
    host.addEventListener("mousedown", onHostDown)

    const hint = document.createElement("div")
    hint.className = "pointer-events-none absolute inset-0 z-10 hidden items-center justify-center bg-[var(--ed-accent)]/15 text-sm font-medium text-[var(--ed-accent-ink)]"
    hint.textContent = "Drop the photo on a frame, or on the sheet"
    host.appendChild(hint)
    const acceptsDrop = (event: DragEvent) => {
      const types = event.dataTransfer?.types
      if (!types) return false
      return Array.from(types).includes("Files") || Array.from(types).includes(PHOTO_DROP_TYPE)
    }
    const hideHint = () => {
      hint.classList.add("hidden")
      hint.classList.remove("flex")
    }
    const showHint = () => {
      hint.classList.remove("hidden")
      hint.classList.add("flex")
    }
    const onDragEnter = (event: DragEvent) => {
      if (!acceptsDrop(event)) return
      event.preventDefault()
      showHint()
    }
    const onDragOver = (event: DragEvent) => {
      if (!acceptsDrop(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
      showHint()
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget && host.contains(event.relatedTarget as Node)) return
      hideHint()
    }
    const onDrop = (event: DragEvent) => {
      if (!acceptsDrop(event)) return
      event.preventDefault()
      hideHint()
      const point = clientToDesign(canvas, event.clientX, event.clientY)
      const replaceId = photoUnderPoint(canvas, point.x, point.y)
      const libraryUrl = event.dataTransfer?.getData(PHOTO_DROP_TYPE)
      if (libraryUrl) {
        useTemplateStore.getState().dropPhotos([{ url: libraryUrl, x: point.x, y: point.y, replaceId }])
        return
      }
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"))
      if (files.length === 0) return
      void placeDroppedFiles(files, point, replaceId)
    }
    host.addEventListener("dragenter", onDragEnter)
    host.addEventListener("dragover", onDragOver)
    host.addEventListener("dragleave", onDragLeave)
    host.addEventListener("drop", onDrop)

    return () => {
      observer.disconnect()
      window.clearTimeout(wheelCommit)
      window.cancelAnimationFrame(zoomFrame)
      window.cancelAnimationFrame(retouchFrame)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      host.removeEventListener("wheel", onWheel)
      host.removeEventListener("mousedown", onHostDown)
      host.removeEventListener("dragenter", onDragEnter)
      host.removeEventListener("dragover", onDragOver)
      host.removeEventListener("dragleave", onDragLeave)
      host.removeEventListener("drop", onDrop)
      hint.remove()
      canvas.dispose()
      fabricRef.current = null
    }
  }, [addTextAt, applyCanvasTransform, commitHistory, selectElement, setStatus, updateElement])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const previous = previousTemplateRef.current
    if (origin === "canvas") {
      previousTemplateRef.current = template
      return
    }

    const token = ++renderTokenRef.current
    const hidden = hiddenWithAncestors(template.elements, hiddenIds)
    setPhotoCompare(useTemplateStore.getState().showBefore)
    syncingRef.current = true
    const paint = previous
      ? syncTemplateOnCanvas(canvas, previous, template, hidden)
      : renderTemplateOnCanvas(canvas, template, { hiddenIds: hidden, showGuides: true })
    void paint
      .then(() => {
        if (token !== renderTokenRef.current || fabricRef.current !== canvas) return
        previousTemplateRef.current = template
        applyToolMode(canvas, toolRef.current)
        const ids = useTemplateStore.getState().selectedIds
        const active = ids.length > 0 ? ids : useTemplateStore.getState().selectedId ? [useTemplateStore.getState().selectedId as string] : []
        showSelection(canvas, active.filter((id) => id !== BACKGROUND_LAYER_ID))
      })
      .finally(() => {
        if (token === renderTokenRef.current) syncingRef.current = false
      })
  }, [template, origin, hiddenIds])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const elements = useTemplateStore.getState().template.elements
    for (const element of elements) {
      if (element.type !== "photo" || element.role === "wash" || element.role === "cutout") continue
      void refreshPhotoObject(canvas, element)
    }
  }, [hiddenPhotoIds])

  const showBefore = useTemplateStore((state) => state.showBefore)
  const setShowBefore = useTemplateStore((state) => state.setShowBefore)
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    void repaintPhotoCompare(canvas, useTemplateStore.getState().template.elements, showBefore)
  }, [showBefore])

  useEffect(() => {
    const canvas = fabricRef.current
    const host = hostRef.current
    if (!canvas || !host) return
    viewRef.current = { zoom: 1, x: 0, y: 0 }
    applyViewRef.current(canvas, host)
  }, [template.canvas.width, template.canvas.height])

  const viewToken = useTemplateStore((state) => state.viewRequest?.token ?? 0)
  const viewKind = useTemplateStore((state) => state.viewRequest?.kind)
  useEffect(() => {
    const canvas = fabricRef.current
    const host = hostRef.current
    if (!canvas || !host || !viewKind) return
    const bounds = host.getBoundingClientRect()
    const design = designRef.current
    const fitted = fitScale(Math.max(120, bounds.width - 56), Math.max(80, bounds.height - 56), design.width, design.height)
    if (viewKind === "fit") {
      viewRef.current = { zoom: 1, x: 0, y: 0 }
    } else if (viewKind === "actual") {
      viewRef.current = { zoom: clampZoom(1 / Math.max(fitted.scale, 0.0001)), x: 0, y: 0 }
    } else if (viewKind === "fill") {
      const fill = Math.max(bounds.width / Math.max(fitted.width, 1), bounds.height / Math.max(fitted.height, 1))
      viewRef.current = { zoom: clampZoom(fill), x: 0, y: 0 }
    } else {
      const inches = design.width / Math.max(template.canvas.dpi, 1)
      viewRef.current = { zoom: clampZoom((inches * 96) / Math.max(fitted.width, 1)), x: 0, y: 0 }
    }
    applyViewRef.current(canvas, host)
  }, [viewToken, viewKind, template.canvas.dpi])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    applyToolMode(canvas, tool)
    if (tool === "hand" || tool === "zoom") return
    if (selectedId === BACKGROUND_LAYER_ID) {
      suppressClearRef.current = true
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      suppressClearRef.current = false
      return
    }
    const ids = (selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : []).filter((id) => id !== BACKGROUND_LAYER_ID)
    if (sameSelection(canvas, ids)) return
    showSelection(canvas, ids)
  }, [selectedId, selectedIds, tool])

  const theme = useTemplateStore((state) => state.theme)
  useEffect(() => {
    syncRulersRef.current()
  }, [showGrid, guides, theme])

  const startGuideDrag = (event: { clientX: number; clientY: number; preventDefault: () => void }, axis: SheetGuide["axis"]) => {
    event.preventDefault()
    const scene = sceneFromClientRef.current(event.clientX, event.clientY)
    if (!scene) return
    guideDragRef.current = { id: null, axis, at: axis === "x" ? scene.x : scene.y }
    syncRulersRef.current()
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--ed-stage)]">
      <div ref={hostRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={sheetRef}
          className="absolute left-1/2 top-1/2 shadow-[0_8px_28px_rgba(0,0,0,0.28)]"
          style={
            template.background.type === "transparent"
              ? {
                  backgroundColor: "#ffffff",
                  backgroundImage:
                    "linear-gradient(45deg, #d9d9d9 25%, transparent 25%), linear-gradient(-45deg, #d9d9d9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d9d9d9 75%), linear-gradient(-45deg, transparent 75%, #d9d9d9 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
                }
              : undefined
          }
        >
          <canvas ref={canvasElRef} className="block" />
          <canvas ref={gridRef} className="pointer-events-none absolute left-0 top-0 z-10" />
        </div>
        <div className="pointer-events-none absolute left-0 top-0 z-10 grid h-[22px] w-[22px] place-items-center border-b border-r border-[var(--ed-line)] bg-[var(--ed-ruler)] text-[9px] text-[var(--ed-secondary)]">
          in
        </div>
        <canvas
          ref={horizontalRulerRef}
          className="absolute left-[22px] top-0 z-10 h-[22px] cursor-row-resize"
          onPointerDown={(event) => startGuideDrag(event, "y")}
        />
        <canvas
          ref={verticalRulerRef}
          className="absolute left-0 top-[22px] z-10 w-[22px] cursor-col-resize"
          onPointerDown={(event) => startGuideDrag(event, "x")}
        />
        {showBefore ? (
          <button
            type="button"
            onClick={() => setShowBefore(false)}
            className="absolute left-1/2 top-8 z-20 -translate-x-1/2 rounded-full bg-[#111] px-3 py-1 text-xs text-white shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
          >
            Before · click for After
          </button>
        ) : null}
        {subjectBusy ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--ed-app)]/70">
            <div className="rounded-md bg-[var(--ed-surface)] px-4 py-3 text-sm text-[var(--ed-ink)] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              Selecting subject…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type GuideDrag = { id: string | null; axis: SheetGuide["axis"]; at: number }

type MaskDrag = {
  id: string
  gesture: MaskGesture
  origin: LayerMask
  startLocal: { x: number; y: number }
  moved: boolean
}

const RULER = 22

function guideAt(x: number, y: number, zoom: number): SheetGuide | null {
  const threshold = 6 / Math.max(zoom, 0.0001)
  let best: SheetGuide | null = null
  let distance = threshold
  for (const guide of useTemplateStore.getState().guides) {
    const delta = Math.abs((guide.axis === "x" ? x : y) - guide.at)
    if (delta > distance) continue
    distance = delta
    best = guide
  }
  return best
}

function paintSheetGuides(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  designWidth: number,
  designHeight: number,
  guides: SheetGuide[],
  draft: GuideDrag | null,
): void {
  if (!canvas || designWidth < 1 || designHeight < 1) return
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const scaleX = width / designWidth
  const scaleY = height / designHeight
  const lines = guides.filter((guide) => guide.id !== draft?.id)
  if (draft) lines.push({ id: "draft", axis: draft.axis, at: draft.at })
  ctx.lineWidth = 1
  for (const guide of lines) {
    ctx.strokeStyle = guide.id === "draft" ? "rgba(0, 168, 198, 0.95)" : "rgba(0, 140, 168, 0.9)"
    ctx.beginPath()
    if (guide.axis === "x") {
      const x = guide.at * scaleX + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    } else {
      const y = guide.at * scaleY + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
  }
}

function paintRulers(
  horizontal: HTMLCanvasElement | null,
  vertical: HTMLCanvasElement | null,
  view: { hostWidth: number; hostHeight: number; originX: number; originY: number; scale: number; dpi: number },
): void {
  paintRuler(horizontal, "x", view.originX - RULER, Math.max(1, view.hostWidth - RULER), view.scale, view.dpi)
  paintRuler(vertical, "y", view.originY - RULER, Math.max(1, view.hostHeight - RULER), view.scale, view.dpi)
}

function editorColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function paintRuler(
  canvas: HTMLCanvasElement | null,
  axis: "x" | "y",
  origin: number,
  length: number,
  scale: number,
  dpi: number,
): void {
  if (!canvas) return
  const width = axis === "x" ? length : RULER
  const height = axis === "x" ? RULER : length
  const bitmap = sheetBitmap(width, height)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(bitmap.ratio, 0, 0, bitmap.ratio, 0, 0)
  ctx.fillStyle = editorColor("--ed-ruler", "#ececec")
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = editorColor("--ed-line", "#c4c4c4")
  ctx.beginPath()
  if (axis === "x") {
    ctx.moveTo(0, height - 0.5)
    ctx.lineTo(width, height - 0.5)
  } else {
    ctx.moveTo(width - 0.5, 0)
    ctx.lineTo(width - 0.5, height)
  }
  ctx.stroke()

  const pxPerInch = Math.max(scale * dpi, 0.01)
  const { major, divisions } = rulerStep(pxPerInch)
  const startInch = -origin / pxPerInch
  const endInch = (length - origin) / pxPerInch
  const minor = major / divisions
  const first = Math.floor(startInch / minor) * minor
  ctx.strokeStyle = editorColor("--ed-secondary", "#6d6d6d")
  ctx.fillStyle = editorColor("--ed-text", "#333")
  ctx.font = "10px sans-serif"
  ctx.lineWidth = 1
  for (let inch = first; inch <= endInch + minor; inch += minor) {
    const screen = origin + inch * pxPerInch
    if (screen < -1 || screen > length + 1) continue
    const majorTick = Math.abs(inch / major - Math.round(inch / major)) < 0.001
    const mark = majorTick ? 12 : 6
    ctx.beginPath()
    if (axis === "x") {
      ctx.moveTo(screen + 0.5, RULER)
      ctx.lineTo(screen + 0.5, RULER - mark)
    } else {
      ctx.moveTo(RULER, screen + 0.5)
      ctx.lineTo(RULER - mark, screen + 0.5)
    }
    ctx.stroke()
    if (!majorTick) continue
    const label = formatInch(inch)
    if (axis === "x") {
      ctx.textBaseline = "top"
      ctx.textAlign = "left"
      ctx.fillText(label, screen + 3, 2)
    } else {
      ctx.save()
      ctx.translate(9, screen - 3)
      ctx.rotate(-Math.PI / 2)
      ctx.textBaseline = "middle"
      ctx.textAlign = "left"
      ctx.fillText(label, 0, 0)
      ctx.restore()
    }
  }
}

function rulerStep(pxPerInch: number): { major: number; divisions: number } {
  const majors = [0.25, 0.5, 1, 2, 3, 6, 12, 24]
  let major = 24
  for (const candidate of majors) {
    if (candidate * pxPerInch >= 56) {
      major = candidate
      break
    }
  }
  let divisions = 2
  for (const count of [8, 4, 2]) {
    if ((major * pxPerInch) / count >= 7) {
      divisions = count
      break
    }
  }
  return { major, divisions }
}

function paintSheetGrid(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  designWidth: number,
  dpi: number,
  visible: boolean,
): void {
  if (!canvas) return
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const bitmap = sheetBitmap(safeWidth, safeHeight)
  canvas.style.width = `${safeWidth}px`
  canvas.style.height = `${safeHeight}px`
  if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(bitmap.ratio, 0, 0, bitmap.ratio, 0, 0)
  ctx.clearRect(0, 0, safeWidth, safeHeight)
  if (!visible || designWidth < 1 || dpi < 1) return
  const scale = safeWidth / designWidth
  const step = gridInches(scale * dpi)
  const gap = step * dpi * scale
  if (gap < 4) return
  for (let x = 0; x <= safeWidth + 0.5; x += gap) {
    const major = Math.abs(x / (dpi * scale) - Math.round(x / (dpi * scale))) < 0.001
    ctx.strokeStyle = major ? "rgba(70, 70, 70, 0.45)" : "rgba(70, 70, 70, 0.22)"
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, safeHeight)
    ctx.stroke()
  }
  for (let y = 0; y <= safeHeight + 0.5; y += gap) {
    const major = Math.abs(y / (dpi * scale) - Math.round(y / (dpi * scale))) < 0.001
    ctx.strokeStyle = major ? "rgba(70, 70, 70, 0.45)" : "rgba(70, 70, 70, 0.22)"
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(safeWidth, y + 0.5)
    ctx.stroke()
  }
}

function gridInches(pxPerInch: number): number {
  for (const step of [0.125, 0.25, 0.5, 1, 2]) {
    if (step * pxPerInch >= 14) return step
  }
  return 2
}

function snapObjectToGrid(object: FabricObject, locked: { x: boolean; y: boolean }): void {
  const state = useTemplateStore.getState()
  if (!state.snapToGrid || (locked.x && locked.y)) return
  const dpi = state.template.canvas.dpi || 300
  const zoom = object.canvas?.getZoom() || 1
  const step = gridInches(zoom * dpi) * dpi
  if (step < 1) return
  const width = object.getScaledWidth()
  const height = object.getScaledHeight()
  const x = (object.left ?? 0) - width / 2
  const y = (object.top ?? 0) - height / 2
  object.set({
    left: locked.x ? object.left : Math.round(x / step) * step + width / 2,
    top: locked.y ? object.top : Math.round(y / step) * step + height / 2,
  })
  object.setCoords()
}

function formatInch(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  if (Math.abs(rounded) < 0.001) return "0"
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function sameSelection(canvas: Canvas, ids: string[]): boolean {
  const active = canvas
    .getActiveObjects()
    .map((object) => getElementId(object))
    .filter((id): id is string => Boolean(id && id !== "__fold-guide"))
  if (active.length !== ids.length) return false
  const wanted = new Set(ids)
  return active.every((id) => wanted.has(id))
}

function showSelection(canvas: Canvas, ids: string[]): void {
  const objects = ids
    .map((id) => findObjectByElementId(canvas, id))
    .filter((object): object is NonNullable<typeof object> => Boolean(object))
  if (objects.length > 1) {
    const selection = new ActiveSelection(objects, { canvas })
    canvas.setActiveObject(selection)
    canvas.requestRenderAll()
    return
  }
  selectElementOnCanvas(canvas, ids[0] ?? null)
}

const MAX_BITMAP_EDGE = 8192
const MAX_BITMAP_PIXELS = 24_000_000

function maxSheetZoom(fittedWidth: number, fittedHeight: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const maxCssEdge = MAX_BITMAP_EDGE / dpr
  const maxCssPixels = MAX_BITMAP_PIXELS / (dpr * dpr)
  const edgeZoom = Math.min(maxCssEdge / Math.max(fittedWidth, 1), maxCssEdge / Math.max(fittedHeight, 1))
  const areaZoom = Math.sqrt(maxCssPixels / Math.max(fittedWidth * fittedHeight, 1))
  return Math.min(16, edgeZoom, areaZoom)
}

function clampZoom(value: number, max = 16): number {
  const ceiling = Math.min(16, Math.max(max, 0.05))
  return Math.min(ceiling, Math.max(Math.min(0.2, ceiling), value))
}

function sheetBitmap(cssWidth: number, cssHeight: number): { width: number; height: number; ratio: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  let width = Math.max(1, Math.round(cssWidth * dpr))
  let height = Math.max(1, Math.round(cssHeight * dpr))
  const edge = Math.min(1, MAX_BITMAP_EDGE / Math.max(width, height))
  const area = Math.min(1, Math.sqrt(MAX_BITMAP_PIXELS / Math.max(width * height, 1)))
  const scale = Math.min(edge, area)
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))
  return { width, height, ratio: width / Math.max(cssWidth, 1) }
}

function clientToDesign(canvas: Canvas, clientX: number, clientY: number): { x: number; y: number } {
  const element = canvas.upperCanvasEl ?? canvas.getElement()
  const rect = element.getBoundingClientRect()
  const zoom = canvas.getZoom() || 1
  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  }
}

function photoUnderPoint(canvas: Canvas, x: number, y: number): string | null {
  const found = canvas.searchPossibleTargets(canvas.getObjects(), new Point(x, y))
  const id = found.target ? getElementId(found.target) : undefined
  if (!id || id === "__fold-guide") return null
  const element = useTemplateStore.getState().template.elements.find((item) => item.id === id)
  if (!element || element.type !== "photo" || element.role === "wash") return null
  return element.id
}

async function placeDroppedFiles(
  files: File[],
  point: { x: number; y: number },
  replaceId: string | null,
): Promise<void> {
  const drops = []
  for (let index = 0; index < files.length; index += 1) {
    const image = await readDroppedImage(files[index])
    const sheet = useTemplateStore.getState().template.canvas
    const longEdge = Math.round(sheet.width * 0.28)
    const width = image.aspect >= 1 ? longEdge : Math.round(longEdge * image.aspect)
    const height = image.aspect >= 1 ? Math.round(longEdge / image.aspect) : longEdge
    drops.push({
      url: image.url,
      x: point.x + index * Math.round(sheet.width * 0.03),
      y: point.y + index * Math.round(sheet.height * 0.04),
      width,
      height,
      replaceId: index === 0 ? replaceId : null,
    })
  }
  useTemplateStore.getState().dropPhotos(drops)
}

function readDroppedImage(file: File): Promise<{ url: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const maxEdge = 1800
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve({ url: String(reader.result), aspect: image.naturalWidth / Math.max(image.naturalHeight, 1) })
          return
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve({
          url: canvas.toDataURL("image/jpeg", 0.9),
          aspect: canvas.width / Math.max(canvas.height, 1),
        })
      }
      image.onerror = () => reject(new Error("Could not read the dropped photo"))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function clampPhotoScale(value: number): number {
  return Math.min(4, Math.max(0.4, value))
}
