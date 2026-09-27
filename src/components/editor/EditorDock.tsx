import { PHOTO_DROP_TYPE, SAMPLE_DECORATIONS, SAMPLE_PHOTOS } from "../../models/asset"
import { PHOTO_SHAPE_LABELS, PHOTO_SHAPES } from "../../models/template"
import { BACKGROUND_LAYER_ID, useTemplateStore } from "../../store/templateStore"
import { useSpreadExport } from "./useSpreadExport"

const LOOKS: { name: string; patch: { brightness?: number; contrast?: number; saturate?: number; blur?: number } }[] = [
  { name: "Soft", patch: { brightness: 6, contrast: -8, saturate: -6, blur: 0 } },
  { name: "Dramatic", patch: { brightness: -4, contrast: 22, saturate: -8, blur: 0 } },
  { name: "Fade", patch: { brightness: 12, contrast: -16, saturate: -22, blur: 0 } },
  { name: "Warm", patch: { brightness: 4, contrast: 4, saturate: 18, blur: 0 } },
  { name: "Cool", patch: { brightness: 0, contrast: 8, saturate: -12, blur: 0 } },
  { name: "Matte", patch: { brightness: 8, contrast: -12, saturate: -8, blur: 0 } },
]

const FILTERS = [
  { name: "Clear", patch: { blur: 0, contrast: 0 } },
  { name: "Soft focus", patch: { blur: 2, contrast: -4 } },
  { name: "Strong blur", patch: { blur: 8 } },
  { name: "Crisp", patch: { blur: 0, contrast: 18 } },
  { name: "Black and white", patch: { saturate: -100, contrast: 8, blur: 0 } },
]

export function EditorDock() {
  const dock = useTemplateStore((state) => state.dockPanel)
  const toggleDock = useTemplateStore((state) => state.toggleDock)
  const tool = useTemplateStore((state) => state.tool)
  const status = useTemplateStore((state) => state.statusMessage)
  const sheet = dock === "photos" || dock === "effects" || dock === "filters" || dock === "styles"

  return (
    <div className="border-t border-[var(--ed-line)] bg-[var(--ed-panel)]">
      {sheet ? (
        <div className="h-[168px] border-b border-[var(--ed-line-soft)] bg-[var(--ed-surface)]">
          {dock === "photos" ? <PhotoBin /> : null}
          {dock === "effects" ? <LookBin title="Effects" looks={LOOKS} /> : null}
          {dock === "filters" ? <LookBin title="Filters" looks={FILTERS} /> : null}
          {dock === "styles" ? <LookBin title="Styles" looks={LOOKS} /> : null}
        </div>
      ) : null}

      <div className="flex h-[58px] items-center gap-3 border-b border-[var(--ed-line-soft)] px-3">
        <div className="w-16 shrink-0 text-xs text-[var(--ed-secondary)]">{toolLabel(tool)}</div>
        <GridButton />
        <SnapButton kind="grid" />
        <SnapButton kind="guides" />
        <SnapButton kind="objects" />
        <ToolOptions />
        <p className="ml-auto max-w-[340px] truncate text-xs text-[var(--ed-muted)]">{status ?? "Ready"}</p>
      </div>

      <div className="flex h-12 items-end gap-1 overflow-x-auto px-2">
        <DockButton id="photos" label="Photo Bin" active={dock === "photos"} onClick={() => toggleDock("photos")} />
        <DockButton id="options" label="Tool Options" active={dock === "options"} onClick={() => toggleDock("options")} />
        <UndoRedo />
        <DockButton id="library" label="Library" active={dock === "library"} onClick={() => toggleDock("library")} />
        <HomeButton />
        <FullScreenButton />
        <CompareButton />
        <PreviewButton />
        <DockButton id="layers" label="Layers" active onClick={() => undefined} />
        <DockButton id="effects" label="Effects" active={dock === "effects"} onClick={() => toggleDock("effects")} />
        <DockButton id="filters" label="Filters" active={dock === "filters"} onClick={() => toggleDock("filters")} />
        <DockButton id="styles" label="Styles" active={dock === "styles"} onClick={() => toggleDock("styles")} />
        <DockButton id="graphics" label="Graphics" active={dock === "graphics"} onClick={() => toggleDock("graphics")} />
        <DockButton id="more" label="More" active={dock === "more"} onClick={() => toggleDock("more")} />
      </div>
    </div>
  )
}

function GridButton() {
  const showGrid = useTemplateStore((state) => state.showGrid)
  const setShowGrid = useTemplateStore((state) => state.setShowGrid)
  return <SnapChip label="Grid" on={showGrid} onClick={() => setShowGrid(!showGrid)} />
}

function SnapButton({ kind }: { kind: "grid" | "guides" | "objects" }) {
  const snapToGrid = useTemplateStore((state) => state.snapToGrid)
  const snapToGuides = useTemplateStore((state) => state.snapToGuides)
  const snapToObjects = useTemplateStore((state) => state.snapToObjects)
  const setSnapToGrid = useTemplateStore((state) => state.setSnapToGrid)
  const setSnapToGuides = useTemplateStore((state) => state.setSnapToGuides)
  const setSnapToObjects = useTemplateStore((state) => state.setSnapToObjects)
  const options = {
    grid: { on: snapToGrid, set: setSnapToGrid, label: "Snap grid" },
    guides: { on: snapToGuides, set: setSnapToGuides, label: "Snap guides" },
    objects: { on: snapToObjects, set: setSnapToObjects, label: "Snap objects" },
  }[kind]
  return <SnapChip label={options.label} on={options.on} onClick={() => options.set(!options.on)} />
}

function SnapChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-xs ${on ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]" : "border-[var(--ed-line)] bg-[var(--ed-surface)] text-[var(--ed-text)] hover:border-[var(--ed-accent)]"}`}
    >
      {label}
    </button>
  )
}

function ToolOptions() {
  const tool = useTemplateStore((state) => state.tool)
  const selectedId = useTemplateStore((state) => state.selectedId)
  const scrollAll = useTemplateStore((state) => state.scrollAll)
  const setScrollAll = useTemplateStore((state) => state.setScrollAll)
  const requestView = useTemplateStore((state) => state.requestView)
  const flip = useTemplateStore((state) => state.flipSelected)
  const rotate = useTemplateStore((state) => state.rotateSelected)
  const align = useTemplateStore((state) => state.alignSelected)
  const duplicate = useTemplateStore((state) => state.duplicateSelected)
  const remove = useTemplateStore((state) => state.deleteSelected)
  const forward = useTemplateStore((state) => state.bringForward)
  const back = useTemplateStore((state) => state.sendBackward)
  const resetLook = useTemplateStore((state) => state.resetPhotoLook)
  const cycle = useTemplateStore((state) => state.cyclePhotoShape)

  if (tool === "hand" || tool === "zoom") {
    return (
      <div className="flex items-center gap-2">
        <OptionButton label="1:1" onClick={() => requestView("actual")} />
        <OptionButton label="Fit Screen" onClick={() => requestView("fit")} />
        <OptionButton label="Fill Screen" onClick={() => requestView("fill")} />
        <OptionButton label="Print Size" onClick={() => requestView("print")} />
        {tool === "hand" ? (
          <label className="ml-2 flex items-center gap-1.5 text-xs text-[var(--ed-secondary)]">
            <input type="checkbox" checked={scrollAll} onChange={(event) => setScrollAll(event.target.checked)} />
            Scroll All Windows
          </label>
        ) : null}
      </div>
    )
  }

  if (tool === "select") {
    return (
      <div className="flex items-center gap-1">
        <InsidePhotoControls />
        <OptionButton label="Flip H" disabled={!selectedId} onClick={() => flip("x")} />
        <OptionButton label="Flip V" disabled={!selectedId} onClick={() => flip("y")} />
        <OptionButton label="Rotate" disabled={!selectedId} onClick={() => rotate(90)} />
        <OptionButton label="Center" disabled={!selectedId} onClick={() => align("center")} />
        <OptionButton label="Forward" disabled={!selectedId} onClick={forward} />
        <OptionButton label="Back" disabled={!selectedId} onClick={back} />
        <OptionButton label="Duplicate" disabled={!selectedId} onClick={duplicate} />
        <OptionButton label="Delete" disabled={!selectedId} onClick={remove} />
      </div>
    )
  }

  if (tool === "crop") {
    return (
      <div className="flex items-center gap-1">
        <InsidePhotoControls />
        <span className="px-1 text-xs text-[var(--ed-secondary)]">Drag the photo · scroll to zoom</span>
      </div>
    )
  }

  if (tool === "cookie") {
    return <OptionButton label="Next shape" disabled={!selectedId} onClick={cycle} />
  }

  if (tool === "shape") {
    return <ShapeKindOptions />
  }

  if (tool === "redeye" || tool === "heal" || tool === "blur" || tool === "sponge" || tool === "blemish" || tool === "skin" || tool === "teeth" || tool === "eye" || tool === "object") {
    return (
      <div className="flex items-center gap-2">
        <span className="px-1 text-xs text-[var(--ed-secondary)]">Drag on the photo</span>
        <OptionButton label="Reset tone" disabled={!selectedId} onClick={resetLook} />
      </div>
    )
  }

  return <p className="text-xs text-[var(--ed-muted)]">{hintFor(tool)}</p>
}

function ShapeKindOptions() {
  const shapeKind = useTemplateStore((state) => state.shapeKind)
  const setShapeKind = useTemplateStore((state) => state.setShapeKind)
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--ed-secondary)]">
      Shape
      <select
        value={shapeKind}
        onChange={(event) => setShapeKind(event.target.value as (typeof PHOTO_SHAPES)[number])}
        className="rounded border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1 text-xs"
      >
        {PHOTO_SHAPES.map((shape) => (
          <option key={shape} value={shape}>
            {PHOTO_SHAPE_LABELS[shape]}
          </option>
        ))}
      </select>
      <span className="text-[var(--ed-muted)]">Pick a shape, then click the sheet. A selected shape updates immediately.</span>
    </label>
  )
}

function PhotoBin() {
  const elements = useTemplateStore((state) => state.template.elements)
  const photos = elements.filter((element) => element.type === "photo")
  const selectedId = useTemplateStore((state) => state.selectedId)
  const select = useTemplateStore((state) => state.selectElement)
  const apply = useTemplateStore((state) => state.applyPhotoAsset)
  const add = useTemplateStore((state) => state.addPhotoSlot)

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ed-muted)]">Photo Bin · drag onto the sheet</div>
      <div className="editor-scroll flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 pb-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            draggable={Boolean(photo.imageUrl)}
            onDragStart={(event) => {
              if (!photo.imageUrl) return
              event.dataTransfer.setData(PHOTO_DROP_TYPE, photo.imageUrl)
              event.dataTransfer.effectAllowed = "copy"
            }}
            onClick={() => select(photo.id)}
            className={`h-[92px] w-[92px] shrink-0 overflow-hidden rounded border bg-[var(--ed-raised)] ${
              selectedId === photo.id ? "border-[var(--ed-accent)]" : "border-[var(--ed-line)]"
            }`}
          >
            {photo.imageUrl ? <img src={photo.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" /> : <span className="text-[10px] text-[var(--ed-muted)]">Empty</span>}
          </button>
        ))}
        {SAMPLE_PHOTOS.slice(0, 8).map((asset) => (
          <button
            key={asset.id}
            type="button"
            draggable
            title={`Drag ${asset.name} onto the sheet`}
            onDragStart={(event) => {
              event.dataTransfer.setData(PHOTO_DROP_TYPE, asset.url)
              event.dataTransfer.effectAllowed = "copy"
            }}
            onClick={() => {
              if (selectedId && photos.some((photo) => photo.id === selectedId)) apply(asset)
              else add(asset.url)
            }}
            className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded border border-[var(--ed-line)] bg-[var(--ed-raised)]"
          >
            <img src={asset.thumbnailUrl ?? asset.url} alt={asset.name} draggable={false} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

function LookBin({
  title,
  looks,
}: {
  title: string
  looks: { name: string; patch: { brightness?: number; contrast?: number; saturate?: number; blur?: number } }[]
}) {
  const apply = useTemplateStore((state) => state.applyPhotoLook)
  const graphics = title === "Styles"
  const addDecoration = useTemplateStore((state) => state.addDecoration)
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ed-muted)]">{title}</div>
      <div className="editor-scroll flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 pb-3">
        {looks.map((look) => (
          <button
            key={look.name}
            type="button"
            onClick={() => apply(look.patch)}
            className="h-[92px] w-[120px] shrink-0 rounded border border-[var(--ed-line-soft)] bg-[var(--ed-surface)] text-sm text-[var(--ed-text)] hover:border-[var(--ed-accent)]"
          >
            {look.name}
          </button>
        ))}
        {graphics
          ? SAMPLE_DECORATIONS.slice(0, 6).map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => addDecoration(asset)}
                className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded border border-[var(--ed-line-soft)] bg-[var(--ed-surface)]"
                title={asset.name}
              >
                <img src={asset.thumbnailUrl ?? asset.url} alt={asset.name} className="h-full w-full object-contain" />
              </button>
            ))
          : null}
      </div>
    </div>
  )
}

function UndoRedo() {
  const undo = useTemplateStore((state) => state.undo)
  const redo = useTemplateStore((state) => state.redo)
  const rotate = useTemplateStore((state) => state.rotateSelected)
  const historyIndex = useTemplateStore((state) => state.historyIndex)
  const history = useTemplateStore((state) => state.history)
  const selectedId = useTemplateStore((state) => state.selectedId)
  return (
    <>
      <DockButton id="undo" label="Undo" active={false} disabled={historyIndex <= 0} onClick={undo} />
      <DockButton id="redo" label="Redo" active={false} disabled={historyIndex >= history.length - 1} onClick={redo} />
      <DockButton id="rotate" label="Rotate" active={false} disabled={!selectedId} onClick={() => rotate(90)} />
    </>
  )
}

function HomeButton() {
  const requestView = useTemplateStore((state) => state.requestView)
  return <DockButton id="home" label="Home" active={false} onClick={() => requestView("fit")} />
}

function FullScreenButton() {
  const setFullScreen = useTemplateStore((state) => state.setFullScreen)
  return <DockButton id="fullscreen" label="Full Screen" active={false} onClick={() => setFullScreen(true)} />
}

function CompareButton() {
  const showBefore = useTemplateStore((state) => state.showBefore)
  const setShowBefore = useTemplateStore((state) => state.setShowBefore)
  return (
    <DockButton
      id="compare"
      label={showBefore ? "Before" : "Compare"}
      active={showBefore}
      onClick={() => setShowBefore(!showBefore)}
    />
  )
}

function PreviewButton() {
  const { busy, exportPng } = useSpreadExport()
  return <DockButton id="preview" label={busy === "png" ? "Preview…" : "Preview"} active={false} disabled={busy !== null} onClick={() => void exportPng()} />
}

function DockButton({
  id,
  label,
  active,
  disabled = false,
  onClick,
}: {
  id: string
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 min-w-[68px] flex-col items-center justify-end px-1 pb-1 text-[10px] disabled:opacity-35 ${
        active ? "border-b-2 border-[var(--ed-accent)] text-[var(--ed-accent)]" : "text-[var(--ed-secondary)] hover:text-[var(--ed-hover)]"
      }`}
      data-dock={id}
    >
      {label}
    </button>
  )
}

function InsidePhotoControls() {
  const selectedId = useTemplateStore((state) => state.selectedId)
  const elements = useTemplateStore((state) => state.template.elements)
  const background = useTemplateStore((state) => state.template.background)
  const update = useTemplateStore((state) => state.updateElement)
  const setBackground = useTemplateStore((state) => state.setBackground)
  const setTool = useTemplateStore((state) => state.setTool)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const tool = useTemplateStore((state) => state.tool)

  const wash = elements.find((element) => element.type === "photo" && element.role === "wash")
  const selected = elements.find((element) => element.id === selectedId)
  const photo =
    selectedId === BACKGROUND_LAYER_ID
      ? wash?.type === "photo"
        ? wash
        : undefined
      : selected?.type === "photo"
        ? selected
        : undefined

  if (selectedId === BACKGROUND_LAYER_ID && !photo && background.type === "transparent") {
    return <span className="text-xs text-[var(--ed-secondary)]">Transparent</span>
  }

  if (selectedId === BACKGROUND_LAYER_ID && !photo && background.type === "color") {
    return (
      <label className="flex items-center gap-2 text-xs text-[var(--ed-secondary)]">
        Color
        <input
          type="color"
          value={background.value}
          onChange={(event) => setBackground({ type: "color", value: event.target.value })}
        />
      </label>
    )
  }

  if (!photo) return null

  const scale = photo.photoScale ?? 1
  const setScale = (next: number) =>
    update(photo.id, { photoScale: Math.min(4, Math.max(0.4, next)) })

  return (
    <>
      <span className="pr-1 text-xs text-[var(--ed-secondary)]">{photo.role === "wash" ? "Background photo" : "Photo"}</span>
      <OptionButton label="−" onClick={() => setScale(scale / 1.15)} />
      <span className="w-10 text-center text-xs text-[var(--ed-text)]">{Math.round(scale * 100)}%</span>
      <OptionButton label="+" onClick={() => setScale(scale * 1.15)} />
      <OptionButton label="Reset" onClick={() => update(photo.id, { photoScale: 1, panX: 0, panY: 0 })} />
      {tool !== "crop" ? (
        <OptionButton
          label="Drag inside"
          onClick={() => {
            setTool("crop")
            setStatus("Drag to move the photo inside the frame. Scroll to zoom it.")
          }}
        />
      ) : null}
    </>
  )
}

function OptionButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2.5 py-1 text-xs text-[var(--ed-text)] hover:border-[var(--ed-accent)] disabled:opacity-35"
    >
      {label}
    </button>
  )
}

function toolLabel(tool: string): string {
  const labels: Record<string, string> = {
    zoom: "Zoom",
    hand: "Hand",
    select: "Move",
    marquee: "Marquee",
    "quick-select": "Quick",
    wand: "Wand",
    redeye: "Red Eye",
    heal: "Heal",
    blemish: "Blemish",
    skin: "Skin",
    teeth: "Teeth",
    eye: "Eyes",
    face: "Face",
    clone: "Clone",
    blur: "Blur",
    sponge: "Sponge",
    cleanup: "Cleanup",
    object: "Object",
    brush: "Brush",
    eraser: "Eraser",
    bucket: "Bucket",
    shape: "Shape",
    text: "Type",
    pencil: "Pencil",
    crop: "Crop",
    subject: "Subject",
    cookie: "Cookie",
  }
  return labels[tool] ?? "Tool"
}

function hintFor(tool: string): string {
  if (tool === "marquee") return "Drag a rectangle on the sheet to select a layer."
  if (tool === "quick-select" || tool === "wand") return "Click a layer on the sheet."
  if (tool === "text") return "Click the sheet to place type. Double-click type to edit it."
  if (tool === "shape") return "Choose a shape below, then click the sheet. Select a shape to change it."
  if (tool === "pencil") return "Drag on the sheet to draw. A click leaves a dot."
  if (tool === "brush") return "Drag to paint. The mark follows the cursor. Finish near the start to fill the shape."
  if (tool === "bucket") return "Click empty sheet to fill the background, or click type to recolor it."
  if (tool === "subject") return "Click a photo. The person stays and the background is removed."
  if (tool === "clone") return "Click a layer to duplicate it."
  return "Choose a tool on the left."
}
