import { useEffect, useRef, useState, type PointerEvent } from "react"
import type { PhotoElement } from "../../models/template"
import { useTemplateStore } from "../../store/templateStore"

type RefineTool = "crop" | "remove" | "restore"

export function SelectionRefine() {
  const refineId = useTemplateStore((state) => state.refineId)
  const template = useTemplateStore((state) => state.template)
  const element = template.elements.find((item) => item.id === refineId)
  if (!refineId || !element || element.type !== "photo" || !element.imageUrl) return null
  return <RefineSession key={element.id} element={element} imageUrl={element.imageUrl} />
}

function RefineSession({ element, imageUrl }: { element: PhotoElement; imageUrl: string }) {
  const closeSelectionRefine = useTemplateStore((state) => state.closeSelectionRefine)
  const applySelectionRefine = useTemplateStore((state) => state.applySelectionRefine)
  const viewRef = useRef<HTMLCanvasElement>(null)
  const plates = useRef<{ color: HTMLCanvasElement; mask: HTMLCanvasElement; undo: ImageData[] } | null>(null)
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean } | null>(null)
  const [tool, setTool] = useState<RefineTool>("crop")
  const [brush, setBrush] = useState(28)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toolRef = useRef(tool)
  const brushRef = useRef(brush)
  toolRef.current = tool
  brushRef.current = brush

  useEffect(() => {
    let cancel = false
    const sourceUrl = element.sourceUrl ?? imageUrl
    void Promise.all([loadHtml(sourceUrl), loadHtml(imageUrl)])
      .then(([source, current]) => {
        if (cancel) return
        const fitted = fitEdge(source.width, source.height, 1400)
        const color = document.createElement("canvas")
        color.width = fitted.width
        color.height = fitted.height
        color.getContext("2d")?.drawImage(source, 0, 0, fitted.width, fitted.height)
        const mask = document.createElement("canvas")
        mask.width = fitted.width
        mask.height = fitted.height
        const maskCtx = mask.getContext("2d")
        if (!maskCtx) return
        if (sourceUrl === imageUrl) {
          maskCtx.fillStyle = "#fff"
          maskCtx.fillRect(0, 0, fitted.width, fitted.height)
        } else {
          maskCtx.drawImage(current, 0, 0, fitted.width, fitted.height)
          const pixels = maskCtx.getImageData(0, 0, fitted.width, fitted.height)
          for (let index = 0; index < pixels.data.length; index += 4) {
            const alpha = pixels.data[index + 3]
            pixels.data[index] = 255
            pixels.data[index + 1] = 255
            pixels.data[index + 2] = 255
            pixels.data[index + 3] = alpha
          }
          maskCtx.putImageData(pixels, 0, 0)
        }
        plates.current = { color, mask, undo: [] }
        const view = viewRef.current
        if (view) {
          view.width = fitted.width
          view.height = fitted.height
        }
        paintView(viewRef.current, plates.current)
        setReady(true)
      })
      .catch(() => {
        if (!cancel) setError("Could not open this photo.")
      })
    return () => {
      cancel = true
    }
  }, [element.sourceUrl, imageUrl])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectionRefine()
      if (event.key === "Enter") apply()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const remember = () => {
    const plate = plates.current
    const ctx = plate?.mask.getContext("2d")
    if (!plate || !ctx) return
    plate.undo.push(ctx.getImageData(0, 0, plate.mask.width, plate.mask.height))
    if (plate.undo.length > 20) plate.undo.shift()
  }

  const undo = () => {
    const plate = plates.current
    const ctx = plate?.mask.getContext("2d")
    const previous = plate?.undo.pop()
    if (!plate || !ctx || !previous) return
    ctx.putImageData(previous, 0, 0)
    paintView(viewRef.current, plate)
  }

  const apply = () => {
    const plate = plates.current
    if (!plate) return
    const comp = document.createElement("canvas")
    comp.width = plate.color.width
    comp.height = plate.color.height
    const ctx = comp.getContext("2d")
    if (!ctx) return
    ctx.drawImage(plate.color, 0, 0)
    ctx.globalCompositeOperation = "destination-in"
    ctx.drawImage(plate.mask, 0, 0)
    applySelectionRefine(element.id, comp.toDataURL("image/png"))
  }

  const pointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = viewRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / Math.max(rect.width, 1),
      y: ((event.clientY - rect.top) * canvas.height) / Math.max(rect.height, 1),
    }
  }

  const onDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointer(event)
    const plate = plates.current
    if (!point || !plate) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // A pointer that is already gone should not cancel the stroke.
    }
    remember()
    drag.current = { x: point.x, y: point.y, lastX: point.x, lastY: point.y, moved: false }
    if (toolRef.current !== "crop") paintBrush(plate, point.x, point.y, point.x, point.y)
    paintView(viewRef.current, plate, toolRef.current === "crop" ? { x: point.x, y: point.y, w: 0, h: 0 } : { x: point.x, y: point.y, radius: brushRef.current })
  }

  const onMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointer(event)
    const plate = plates.current
    const stroke = drag.current
    if (!point || !plate) return
    if (!stroke) {
      paintView(viewRef.current, plate, toolRef.current === "crop" ? undefined : { x: point.x, y: point.y, radius: brushRef.current })
      return
    }
    stroke.moved = true
    if (toolRef.current === "crop") {
      paintView(viewRef.current, plate, { x: stroke.x, y: stroke.y, w: point.x - stroke.x, h: point.y - stroke.y })
      return
    }
    paintBrush(plate, stroke.lastX, stroke.lastY, point.x, point.y)
    stroke.lastX = point.x
    stroke.lastY = point.y
    paintView(viewRef.current, plate, { x: point.x, y: point.y, radius: brushRef.current })
  }

  const onUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointer(event)
    const plate = plates.current
    const stroke = drag.current
    drag.current = null
    if (!point || !plate || !stroke) return
    if (toolRef.current === "crop" && stroke.moved) {
      const x = Math.min(stroke.x, point.x)
      const y = Math.min(stroke.y, point.y)
      const w = Math.abs(point.x - stroke.x)
      const h = Math.abs(point.y - stroke.y)
      const ctx = plate.mask.getContext("2d")
      if (ctx && w > 4 && h > 4) {
        ctx.save()
        ctx.globalCompositeOperation = "destination-in"
        ctx.fillStyle = "#fff"
        ctx.fillRect(x, y, w, h)
        ctx.restore()
      }
    }
    paintView(viewRef.current, plate)
  }

  const paintBrush = (plate: { mask: HTMLCanvasElement }, x0: number, y0: number, x1: number, y1: number) => {
    const ctx = plate.mask.getContext("2d")
    if (!ctx) return
    const radius = brushRef.current
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = radius * 2
    if (toolRef.current === "remove") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.strokeStyle = "#000"
      ctx.fillStyle = "#000"
    } else {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = "#fff"
      ctx.fillStyle = "#fff"
    }
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x1, y1, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  return (
    <div className="fixed inset-0 z-40 flex bg-[#2b2b2b]/80">
      <aside className="flex w-[220px] flex-col gap-3 bg-[var(--ed-panel)] p-4 text-sm text-[var(--ed-ink)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ed-secondary)]">Crop & select</h2>
        <ToolButton active={tool === "crop"} onClick={() => setTool("crop")} label="Crop" detail="Drag a box. Everything outside it is removed." />
        <ToolButton active={tool === "remove"} onClick={() => setTool("remove")} label="Remove" detail="Paint the background away." />
        <ToolButton active={tool === "restore"} onClick={() => setTool("restore")} label="Restore" detail="Paint the person back from the original photo." />
        {tool !== "crop" ? (
          <label className="mt-2 block text-xs text-[var(--ed-secondary)]">
            Brush {brush}
            <input type="range" min={6} max={120} value={brush} onChange={(event) => setBrush(Number(event.target.value))} className="mt-1 w-full" />
          </label>
        ) : null}
        <div className="mt-auto flex flex-col gap-2">
          <button type="button" onClick={undo} className="rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-3 py-2 text-sm">
            Undo
          </button>
          <button type="button" onClick={closeSelectionRefine} className="rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-3 py-2 text-sm">
            Cancel
          </button>
          <button type="button" disabled={!ready} onClick={apply} className="rounded-md bg-[var(--ed-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            Apply
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 items-center justify-center p-6">
        {error ? <p className="text-sm text-white">{error}</p> : null}
        <canvas
          ref={viewRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="max-h-full max-w-full cursor-crosshair bg-[repeating-conic-gradient(#d7d7d7_0%_25%,#f4f4f4_0%_50%)] bg-[length:24px_24px] shadow-2xl"
        />
      </div>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  detail,
}: {
  active: boolean
  onClick: () => void
  label: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left ${active ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)]" : "border-[var(--ed-line)] bg-[var(--ed-surface)]"}`}
    >
      <span className="block font-medium">{label}</span>
      <span className="mt-0.5 block text-[11px] leading-4 text-[var(--ed-secondary)]">{detail}</span>
    </button>
  )
}

function paintView(
  view: HTMLCanvasElement | null,
  plate: { color: HTMLCanvasElement; mask: HTMLCanvasElement },
  extra?: { x: number; y: number; w?: number; h?: number; radius?: number },
) {
  if (!view) return
  const ctx = view.getContext("2d")
  if (!ctx) return
  const comp = document.createElement("canvas")
  comp.width = plate.color.width
  comp.height = plate.color.height
  const compCtx = comp.getContext("2d")
  if (!compCtx) return
  compCtx.drawImage(plate.color, 0, 0)
  compCtx.globalCompositeOperation = "destination-in"
  compCtx.drawImage(plate.mask, 0, 0)
  ctx.clearRect(0, 0, view.width, view.height)
  ctx.drawImage(comp, 0, 0)
  if (!extra) return
  ctx.save()
  ctx.strokeStyle = "#1473e6"
  ctx.lineWidth = 2
  if (extra.w !== undefined && extra.h !== undefined) {
    const x = Math.min(extra.x, extra.x + extra.w)
    const y = Math.min(extra.y, extra.y + extra.h)
    ctx.strokeRect(x, y, Math.abs(extra.w), Math.abs(extra.h))
  } else {
    ctx.beginPath()
    ctx.arc(extra.x, extra.y, extra.radius ?? 18, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function fitEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function loadHtml(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not open this photo."))
    image.src = url
  })
}
