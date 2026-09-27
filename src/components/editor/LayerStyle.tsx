import { useEffect, useRef, useState } from "react"
import type { PhotoElement, PhotoShape, TemplateElement } from "../../models/template"
import {
  BLEND_MODES,
  BLEND_MODE_LABELS,
  FONT_OPTIONS,
  PHOTO_SHAPES,
  PHOTO_SHAPE_LABELS,
} from "../../models/template"
import { BACKGROUND_LAYER_ID, useTemplateStore } from "../../store/templateStore"
import { lockedWithAncestors } from "../../utils/geometry"
import { shapeSvgUrl } from "../../utils/shapeGraphic"
import { MaskControls } from "./MaskControls"

const PHOTO_RATIOS: { id: string; label: string; ratio: number }[] = [
  { id: "free", label: "Unconstrained", ratio: 0 },
  { id: "current", label: "Original Ratio", ratio: 0 },
  { id: "photo", label: "Match Photo", ratio: 0 },
  { id: "1:1", label: "1:1 Square", ratio: 1 },
  { id: "4:5", label: "4:5 (8×10)", ratio: 4 / 5 },
  { id: "5:4", label: "5:4", ratio: 5 / 4 },
  { id: "5:7", label: "5:7", ratio: 5 / 7 },
  { id: "7:5", label: "7:5", ratio: 7 / 5 },
  { id: "2:3", label: "2:3 (4×6)", ratio: 2 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
]

export function LayerStyle() {
  const template = useTemplateStore((state) => state.template)
  const selectedId = useTemplateStore((state) => state.selectedId)
  const updateElement = useTemplateStore((state) => state.updateElement)
  const setBackground = useTemplateStore((state) => state.setBackground)
  const layerFocus = useTemplateStore((state) => state.layerFocus)
  const element = template.elements.find((item) => item.id === selectedId)
  const background = selectedId === BACKGROUND_LAYER_ID || !element
  const locked = Boolean(element && lockedWithAncestors(template.elements).has(element.id))

  return (
    <div className="editor-scroll min-h-[240px] flex-1 overflow-y-auto border-t border-[var(--ed-line-soft)] bg-[var(--ed-surface)] px-3 py-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ed-secondary)]">Style</h3>
      {locked ? (
        <p className="mt-3 text-xs leading-5 text-[var(--ed-muted)]">Unlock this layer to change its size, color, or other settings.</p>
      ) : null}
      <fieldset disabled={locked} className={locked ? "pointer-events-none opacity-60" : undefined}>
      {element ? <NameField id={element.id} name={element.name ?? ""} /> : null}
      {element ? <MaskControls element={element} /> : null}
      {element?.type === "group" ? (
        <p className="mt-3 text-xs leading-5 text-[var(--ed-muted)]">Layers in this group hide and lock together.</p>
      ) : null}
      {background ? (
        <div className="mt-3">
          <FieldLabel>Background</FieldLabel>
          {template.background.type === "transparent" ? (
            <p className="text-xs text-[var(--ed-muted)]">Transparent</p>
          ) : template.background.type === "color" ? (
            <input
              type="color"
              value={template.background.value}
              onChange={(event) => setBackground({ type: "color", value: event.target.value })}
              className="h-9 w-full cursor-pointer rounded border border-[var(--ed-line)] bg-transparent"
            />
          ) : (
            <p className="text-xs text-[var(--ed-muted)]">This spread uses a photo background.</p>
          )}
          <p className="mt-3 text-xs leading-5 text-[var(--ed-muted)]">Select a layer to change its frame, stroke, and tone.</p>
        </div>
      ) : null}
      {element?.type === "photo" ? (
        <PhotoStyle
          key={`${element.id}-${layerFocus ?? "all"}`}
          element={element}
          part={element.role !== "wash" && element.role !== "cutout" ? (layerFocus === "photo" ? "photo" : "frame") : "all"}
          onChange={(patch) => updateElement(element.id, patch)}
        />
      ) : null}
      {element?.type === "text" ? (
        <TextStyle element={element} onChange={(patch) => updateElement(element.id, patch)} />
      ) : null}
      {element?.type === "decoration" ? (
        <DecorationStyle element={element} onChange={(patch) => updateElement(element.id, patch)} />
      ) : null}
      </fieldset>
    </div>
  )
}

function NameField({ id, name }: { id: string; name: string }) {
  const renameLayer = useTemplateStore((state) => state.renameLayer)
  const [value, setValue] = useState(name)
  useEffect(() => setValue(name), [id, name])
  return (
    <label className="mt-3 block">
      <FieldLabel>Name</FieldLabel>
      <input
        value={value}
        placeholder="Layer name"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => renameLayer(id, value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="w-full rounded-md border border-[var(--ed-line)] px-2 py-1.5 text-sm"
      />
    </label>
  )
}

function PhotoStyle({
  element,
  part,
  onChange,
}: {
  element: PhotoElement
  part: "frame" | "photo" | "all"
  onChange: (patch: Partial<PhotoElement>) => void
}) {
  const showFrame = part !== "photo"
  const showPhoto = part !== "frame"
  const archMax = Math.max(1, element.width / 2)
  const archRadius = element.cornerRadius ?? Math.min(archMax, element.height * 0.38)
  const archPercent = Math.round((archRadius / archMax) * 100)
  const [ratioId, setRatioId] = useState("free")
  const [photoRatio, setPhotoRatio] = useState(0)
  const locked =
    ratioId === "current"
      ? element.width / Math.max(element.height, 1)
      : ratioId === "photo"
        ? photoRatio
        : (PHOTO_RATIOS.find((item) => item.id === ratioId)?.ratio ?? 0)

  function resize(width: number, height: number) {
    onChange({
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    })
  }

  function chooseRatio(id: string) {
    setRatioId(id)
    if (id === "free" || id === "current") return
    if (id === "photo") {
      const source = element.sourceUrl || element.imageUrl
      if (!source) return
      const image = new Image()
      image.onload = () => {
        const ratio = image.naturalWidth / Math.max(image.naturalHeight, 1)
        setPhotoRatio(ratio)
        resize(element.width, element.width / ratio)
      }
      image.src = source
      return
    }
    const ratio = PHOTO_RATIOS.find((item) => item.id === id)?.ratio ?? 0
    if (ratio > 0) resize(element.width, element.width / ratio)
  }

  return (
    <div className="mt-3 space-y-3">
      {showPhoto && element.role !== "wash" && element.imageUrl ? <CutoutActions elementId={element.id} /> : null}
      {showPhoto ? (
      <div>
        <FieldLabel>Photo in frame</FieldLabel>
        <div className="grid grid-cols-2 gap-1">
          <Toggle on={(element.objectFit ?? "cover") === "cover"} onClick={() => onChange({ objectFit: "cover" })}>
            Fill
          </Toggle>
          <Toggle on={element.objectFit === "contain"} onClick={() => onChange({ objectFit: "contain" })}>
            Fit
          </Toggle>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[var(--ed-muted)]">
          Fill covers the frame. Fit shows the whole photo.
        </p>
      </div>
      ) : null}
      {showFrame ? (
      <>
      <TransformFields
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        linked={locked > 0}
        onToggleLink={() => chooseRatio(locked > 0 ? "free" : "current")}
        onWidth={(width) => resize(width, locked > 0 ? width / locked : element.height)}
        onHeight={(height) => resize(locked > 0 ? height * locked : element.width, height)}
        onX={(x) => onChange({ x })}
        onY={(y) => onChange({ y })}
        onAngle={(rotation) => onChange({ rotation })}
      />
      <div>
        <FieldLabel>Ratio</FieldLabel>
        <select
          value={ratioId}
          onChange={(event) => chooseRatio(event.target.value)}
          className="w-full rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1.5 text-sm"
        >
          {PHOTO_RATIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel>Shape</FieldLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {PHOTO_SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => onChange({ shape })}
              className={`flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[10px] ${
                element.shape === shape
                  ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]"
                  : "border-[var(--ed-line-soft)] bg-[var(--ed-surface)] text-[var(--ed-secondary)] hover:border-[var(--ed-line)]"
              }`}
            >
              <ShapeSwatch shape={shape} />
              {styleShapeLabel(shape)}
            </button>
          ))}
        </div>
      </div>
      {element.shape === "arch" ? (
        <Slider
          label="Top curve"
          min={0}
          max={100}
          value={archPercent}
          suffix="%"
          onChange={(percent) => onChange({ cornerRadius: (percent / 100) * archMax })}
        />
      ) : null}
      {element.shape === "rounded" ? (
        <Slider
          label="Corner radius"
          min={0}
          max={Math.round(Math.min(element.width, element.height) / 2)}
          value={Math.round(element.cornerRadius ?? Math.min(element.width, element.height) * 0.08)}
          onChange={(cornerRadius) => onChange({ cornerRadius })}
        />
      ) : null}
      <FieldLabel>Appearance</FieldLabel>
      <Slider
        label="Opacity"
        min={0}
        max={100}
        value={Math.round((element.opacity ?? 1) * 100)}
        suffix="%"
        onChange={(percent) => onChange({ opacity: percent / 100 })}
      />
      <div>
        <FieldLabel>Blend mode</FieldLabel>
        <select
          value={element.blendMode ?? "normal"}
          onChange={(event) => onChange({ blendMode: event.target.value as PhotoElement["blendMode"] })}
          className="w-full rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1.5 text-sm"
        >
          {BLEND_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {BLEND_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>
      {element.shape !== "polaroid" ? (
        <div className="grid grid-cols-[1fr_52px] gap-2">
          <Slider
            label="Stroke"
            min={0}
            max={80}
            value={Math.round(element.border?.width ?? 0)}
            onChange={(width) => onChange({ border: { width, color: element.border?.color ?? "#FFFFFF" } })}
          />
          <label className="block">
            <FieldLabel>Color</FieldLabel>
            <input
              type="color"
              value={element.border?.color ?? "#FFFFFF"}
              onChange={(event) =>
                onChange({ border: { width: element.border?.width ?? 24, color: event.target.value } })
              }
              className="h-8 w-full cursor-pointer rounded border border-[var(--ed-line)] bg-transparent"
            />
          </label>
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-xs text-[var(--ed-text)]">
        <input
          type="checkbox"
          checked={element.shadow === true || (element.shadow !== false && (element.shape === "polaroid" || (element.border?.width ?? 0) > 0))}
          onChange={(event) => onChange({ shadow: event.target.checked })}
        />
        Drop Shadow
      </label>
      <div className="grid grid-cols-2 gap-1">
        <Toggle on={Boolean(element.flipX)} onClick={() => onChange({ flipX: !element.flipX })}>
          Flip Horizontal
        </Toggle>
        <Toggle on={Boolean(element.flipY)} onClick={() => onChange({ flipY: !element.flipY })}>
          Flip Vertical
        </Toggle>
      </div>
      </>
      ) : null}
      {showPhoto ? (
      <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">Adjust</p>
      <Slider label="Brightness" min={-80} max={80} value={element.brightness ?? 0} onChange={(brightness) => onChange({ brightness })} />
      <Slider label="Exposure" min={-100} max={100} value={element.exposure ?? 0} onChange={(exposure) => onChange({ exposure })} />
      <Slider label="Contrast" min={-80} max={80} value={element.contrast ?? 0} onChange={(contrast) => onChange({ contrast })} />
      <Slider label="Highlights" min={-100} max={100} value={element.highlights ?? 0} onChange={(highlights) => onChange({ highlights })} />
      <Slider label="Shadows" min={-100} max={100} value={element.shadows ?? 0} onChange={(shadows) => onChange({ shadows })} />
      <Slider label="Saturation" min={-100} max={100} value={element.saturate ?? 0} onChange={(saturate) => onChange({ saturate })} />
      <Slider label="Vibrance" min={-100} max={100} value={element.vibrance ?? 0} onChange={(vibrance) => onChange({ vibrance })} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">White balance</p>
      <Slider label="Temperature" min={-100} max={100} value={element.temperature ?? 0} onChange={(temperature) => onChange({ temperature })} />
      <Slider label="Tint" min={-100} max={100} value={element.tint ?? 0} onChange={(tint) => onChange({ tint })} />
      <Slider label="Sharpness" min={0} max={100} value={element.sharpness ?? 0} onChange={(sharpness) => onChange({ sharpness })} />
      <Slider label="Blur" min={0} max={24} value={element.blur ?? 0} onChange={(blur) => onChange({ blur })} />
      <Slider label="Noise reduction" min={0} max={100} value={element.noise ?? 0} onChange={(noise) => onChange({ noise })} />
      <Slider label="Vignette" min={-100} max={100} value={element.vignette ?? 0} onChange={(vignette) => onChange({ vignette })} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">Curves</p>
      <Slider label="Curve shadows" min={-100} max={100} value={element.curveShadows ?? 0} onChange={(curveShadows) => onChange({ curveShadows })} />
      <Slider label="Curve midtones" min={-100} max={100} value={element.curveMidtones ?? 0} onChange={(curveMidtones) => onChange({ curveMidtones })} />
      <Slider label="Curve highlights" min={-100} max={100} value={element.curveHighlights ?? 0} onChange={(curveHighlights) => onChange({ curveHighlights })} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">Levels</p>
      <Slider label="Black point" min={0} max={100} value={element.levelsBlack ?? 0} onChange={(levelsBlack) => onChange({ levelsBlack })} />
      <Slider label="Gamma" min={-100} max={100} value={element.levelsGamma ?? 0} onChange={(levelsGamma) => onChange({ levelsGamma })} />
      <Slider label="White point" min={0} max={100} value={element.levelsWhite ?? 0} onChange={(levelsWhite) => onChange({ levelsWhite })} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">HSL</p>
      <Slider label="Hue" min={-180} max={180} value={element.hue ?? 0} onChange={(hue) => onChange({ hue })} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">Color balance</p>
      <Slider label="Cyan / Red" min={-100} max={100} value={element.balanceCyanRed ?? 0} onChange={(balanceCyanRed) => onChange({ balanceCyanRed })} />
      <Slider label="Magenta / Green" min={-100} max={100} value={element.balanceMagentaGreen ?? 0} onChange={(balanceMagentaGreen) => onChange({ balanceMagentaGreen })} />
      <Slider label="Yellow / Blue" min={-100} max={100} value={element.balanceYellowBlue ?? 0} onChange={(balanceYellowBlue) => onChange({ balanceYellowBlue })} />
      <RetouchActions id={element.id} hasPhoto={Boolean(element.imageUrl)} />
      </>
      ) : null}
    </div>
  )
}

function RetouchActions({ id, hasPhoto }: { id: string; hasPhoto: boolean }) {
  const setTool = useTemplateStore((state) => state.setTool)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const applyAutoRetouch = useTemplateStore((state) => state.applyAutoRetouch)
  const removeBackground = useTemplateStore((state) => state.removeBackground)
  const actions: { label: string; run: () => void }[] = [
    { label: "Skin", run: () => void applyAutoRetouch("skin") },
    { label: "Face", run: () => void applyAutoRetouch("face") },
    { label: "Cleanup", run: () => void removeBackground(id) },
    { label: "Heal", run: () => { setTool("heal"); setStatus("Healing — drag on the spot you want to repair.") } },
    { label: "Blemish", run: () => { setTool("blemish"); setStatus("Blemish — drag over a mark on the skin.") } },
    { label: "Teeth", run: () => { setTool("teeth"); setStatus("Teeth — drag across the teeth only.") } },
    { label: "Eyes", run: () => { setTool("eye"); setStatus("Eyes — drag across an eye to lift contrast.") } },
    { label: "Red eye", run: () => { setTool("redeye"); setStatus("Red eye — drag across the red pupil.") } },
    { label: "Object", run: () => { setTool("object"); setStatus("Object removal — drag over the object to fill it from the surrounding photo.") } },
    { label: "Clone", run: () => { setTool("clone"); setStatus("Clone — Option-click a source, then drag to paint it.") } },
  ]
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">Retouch</p>
      <div className="grid grid-cols-3 gap-1">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={!hasPhoto}
            onClick={action.run}
            className="rounded-md border border-[var(--ed-line)] px-1 py-1.5 text-[11px] text-[var(--ed-secondary)] disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-4 text-[var(--ed-muted)]">
        Brush paints on the sheet. Eraser removes a layer. The buttons above edit the photo itself.
      </p>
    </div>
  )
}

function TextStyle({
  element,
  onChange,
}: {
  element: Extract<TemplateElement, { type: "text" }>
  onChange: (patch: Partial<Extract<TemplateElement, { type: "text" }>>) => void
}) {
  return (
    <div className="mt-3 space-y-3">
      <TransformFields
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        onResize={(width, height) => onChange({ width, height })}
        onWidth={(width) => onChange({ width })}
        onHeight={(height) => onChange({ height })}
        onX={(x) => onChange({ x: Math.round(x) })}
        onY={(y) => onChange({ y: Math.round(y) })}
        onAngle={(rotation) => onChange({ rotation })}
      />
      <div>
        <FieldLabel>Text</FieldLabel>
        <textarea
          value={element.text}
          rows={2}
          onChange={(event) => onChange({ text: event.target.value })}
          className="w-full resize-y rounded-md border border-[var(--ed-line)] px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <FieldLabel>Font</FieldLabel>
        <select
          value={element.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
          className="w-full rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1.5 text-sm"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>
      <Slider label="Size" min={12} max={400} value={Math.round(element.fontSize)} onChange={(fontSize) => onChange({ fontSize })} />
      <label className="block">
        <FieldLabel>Color</FieldLabel>
        <input
          type="color"
          value={element.color}
          onChange={(event) => onChange({ color: event.target.value })}
          className="h-8 w-full cursor-pointer rounded border border-[var(--ed-line)] bg-transparent"
        />
      </label>
      <div className="grid grid-cols-3 gap-1">
        {(["left", "center", "right"] as const).map((align) => (
          <Toggle key={align} on={element.textAlign === align} onClick={() => onChange({ textAlign: align })}>
            {align}
          </Toggle>
        ))}
      </div>
    </div>
  )
}

function DecorationStyle({
  element,
  onChange,
}: {
  element: Extract<TemplateElement, { type: "decoration" }>
  onChange: (patch: Partial<Extract<TemplateElement, { type: "decoration" }>>) => void
}) {
  const isShape = Boolean(element.shape) || element.assetId.startsWith("shape-")
  const shape = element.shape ?? "rectangle"
  const fill = element.fill ?? "#111111"
  const applyShape = (nextShape: PhotoShape, nextFill = fill) => {
    onChange({
      shape: nextShape,
      fill: nextFill,
      assetId: element.assetId.startsWith("shape-") ? element.assetId : "shape-layer",
      assetUrl: shapeSvgUrl(nextShape, nextFill, element.width, element.height),
    })
  }
  return (
    <div className="mt-3 space-y-3">
      <TransformFields
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        onResize={(width, height) => onChange({ width, height })}
        onWidth={(width) => onChange({ width })}
        onHeight={(height) => onChange({ height })}
        onX={(x) => onChange({ x: Math.round(x) })}
        onY={(y) => onChange({ y: Math.round(y) })}
        onAngle={(rotation) => onChange({ rotation })}
      />
      {isShape ? (
        <>
          <div>
            <FieldLabel>Shape</FieldLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {PHOTO_SHAPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applyShape(item)}
                  className={`flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[10px] ${
                    shape === item ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]" : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
                  }`}
                >
                  <ShapeSwatch shape={item} />
                  {styleShapeLabel(item)}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <FieldLabel>Fill</FieldLabel>
            <input
              type="color"
              value={fill}
              onChange={(event) => applyShape(shape, event.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-[var(--ed-line)] bg-transparent"
            />
          </label>
        </>
      ) : null}
      <Slider
        label="Opacity"
        min={0}
        max={100}
        value={Math.round(element.opacity * 100)}
        suffix="%"
        onChange={(percent) => onChange({ opacity: percent / 100 })}
      />
      <div>
        <FieldLabel>Blend mode</FieldLabel>
        <select
          value={element.blendMode ?? "normal"}
          onChange={(event) => onChange({ blendMode: event.target.value as PhotoElement["blendMode"] })}
          className="w-full rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1.5 text-sm"
        >
          {BLEND_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {BLEND_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Toggle on={Boolean(element.flipX)} onClick={() => onChange({ flipX: !element.flipX })}>
          Flip Horizontal
        </Toggle>
        <Toggle on={Boolean(element.flipY)} onClick={() => onChange({ flipY: !element.flipY })}>
          Flip Vertical
        </Toggle>
      </div>
    </div>
  )
}

function styleShapeLabel(shape: PhotoShape): string {
  if (shape === "rounded") return "Rounded Rectangle"
  if (shape === "oval") return "Ellipse"
  return PHOTO_SHAPE_LABELS[shape]
}

function ShapeSwatch({ shape }: { shape: PhotoShape }) {
  const clip =
    shape === "diagonal-left"
      ? "polygon(18% 0, 100% 0, 100% 100%, 0 100%)"
      : shape === "diagonal-right"
        ? "polygon(0 0, 82% 0, 100% 100%, 0 100%)"
        : shape === "organic"
          ? "polygon(20% 18%, 55% 4%, 92% 28%, 84% 70%, 48% 96%, 8% 62%)"
          : undefined
  const radius =
    shape === "circle" || shape === "oval"
      ? "999px"
      : shape === "rounded"
        ? "5px"
        : shape === "arch"
          ? "999px 999px 0 0"
          : shape === "polaroid"
            ? "2px"
            : "0"
  return (
    <span
      className="block h-6 w-8 border border-current bg-[var(--ed-surface)]"
      style={{
        borderRadius: radius,
        clipPath: clip,
        transform: shape === "oval" ? "scaleX(0.8)" : undefined,
        borderBottomWidth: shape === "polaroid" ? 4 : undefined,
      }}
    />
  )
}

function Slider({
  label,
  min,
  max,
  value,
  suffix = "",
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-[var(--ed-muted)]">
        {label}
        <span className="normal-case tracking-normal text-[var(--ed-secondary)]">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  )
}

function CutoutActions({ elementId }: { elementId: string }) {
  const removeBackground = useTemplateStore((state) => state.removeBackground)
  const openSelectionRefine = useTemplateStore((state) => state.openSelectionRefine)
  const subjectBusy = useTemplateStore((state) => state.subjectBusy)
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={subjectBusy}
        onClick={() => void removeBackground(elementId)}
        className="w-full rounded-md bg-[var(--ed-accent)] px-3 py-2 text-left text-sm font-medium text-white disabled:opacity-60"
      >
        <span className="block">{subjectBusy ? "Selecting subject…" : "Remove Background"}</span>
        <span className="mt-0.5 block text-[11px] font-normal text-white/80">Keeps the person and clears the photo behind them.</span>
      </button>
      <button
        type="button"
        disabled={subjectBusy}
        onClick={() => openSelectionRefine(elementId)}
        className="w-full rounded-md border border-[var(--ed-accent)] bg-[var(--ed-surface)] px-3 py-2 text-left text-sm font-medium text-[var(--ed-accent-ink)] disabled:opacity-60"
      >
        <span className="block">Crop & select</span>
        <span className="mt-0.5 block text-[11px] font-normal text-[var(--ed-accent-ink)]">Drag a box or paint to correct what stays.</span>
      </button>
    </div>
  )
}

function TransformFields({
  x,
  y,
  width,
  height,
  rotation,
  linked = false,
  onToggleLink,
  onResize,
  onWidth,
  onHeight,
  onX,
  onY,
  onAngle,
}: {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  linked?: boolean
  onToggleLink?: () => void
  onResize?: (width: number, height: number) => void
  onWidth: (value: number) => void
  onHeight: (value: number) => void
  onX: (value: number) => void
  onY: (value: number) => void
  onAngle: (value: number) => void
}) {
  const [localLinked, setLocalLinked] = useState(false)
  const ratioRef = useRef(width / Math.max(height, 1))
  const controlled = onToggleLink !== undefined
  const isLinked = controlled ? linked : localLinked

  function toggleLink() {
    if (onToggleLink) {
      onToggleLink()
      return
    }
    ratioRef.current = width / Math.max(height, 1)
    setLocalLinked((value) => !value)
  }

  function changeWidth(next: number) {
    if (!controlled && isLinked && onResize) {
      onResize(Math.max(1, Math.round(next)), Math.max(1, Math.round(next / ratioRef.current)))
      return
    }
    onWidth(next)
  }

  function changeHeight(next: number) {
    if (!controlled && isLinked && onResize) {
      onResize(Math.max(1, Math.round(next * ratioRef.current)), Math.max(1, Math.round(next)))
      return
    }
    onHeight(next)
  }

  return (
    <div>
      <FieldLabel>Transform</FieldLabel>
      <div className="grid grid-cols-[1fr_28px_1fr] items-end gap-1">
        <SizeField label="W" value={width} onChange={changeWidth} />
        <button
          type="button"
          title={isLinked ? "Unconstrained" : "Constrain proportions"}
          aria-pressed={isLinked}
          onClick={toggleLink}
          className={`mb-0.5 grid h-8 w-7 place-items-center rounded border ${
            isLinked ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]" : "border-[var(--ed-line)] text-[var(--ed-muted)]"
          }`}
        >
          <LinkMark linked={isLinked} />
        </button>
        <SizeField label="H" value={height} onChange={changeHeight} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <SizeField label="X" value={x} allowAny onChange={onX} />
        <SizeField label="Y" value={y} allowAny onChange={onY} />
      </div>
      <div className="mt-2">
        <SizeField label="Angle" value={rotation} allowAny onChange={onAngle} />
      </div>
    </div>
  )
}

function LinkMark({ linked }: { linked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {linked ? (
        <path
          d="M5.2 8.8 3.6 10.4a2.2 2.2 0 0 1-3.1-3.1L2.1 5.7M8.8 5.2l1.6-1.6a2.2 2.2 0 0 1 3.1 3.1L12 8.3M5 9l4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4.2 6.2 2.8 7.6a2 2 0 0 1-2.8-2.8L1.4 3.4M9.8 7.8l1.4 1.4a2 2 0 0 1-2.8 2.8L7 10.6M2 2l2 2M10 10l2 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function SizeField({
  label,
  value,
  allowAny = false,
  onChange,
}: {
  label: string
  value: number
  allowAny?: boolean
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(Math.round(value)))
  useEffect(() => setText(String(Math.round(value))), [value])

  function commit() {
    const next = Number(text)
    if (!Number.isFinite(next) || (!allowAny && next < 1)) {
      setText(String(Math.round(value)))
      return
    }
    if (Math.round(next) === Math.round(value)) return
    onChange(next)
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[var(--ed-muted)]">{label}</span>
      <input
        type="number"
        min={allowAny ? undefined : 1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="w-full rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1.5 text-sm"
      />
    </label>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <span className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-[var(--ed-muted)]">{children}</span>
}

function Toggle({ children, on, onClick }: { children: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs capitalize ${
        on ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]" : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
      }`}
    >
      {children}
    </button>
  )
}
