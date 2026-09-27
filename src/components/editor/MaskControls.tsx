import type { LayerMask, TemplateElement } from "../../models/template"
import { useTemplateStore } from "../../store/templateStore"
import { createMask, type MaskPreset } from "../../utils/layerMask"

const PRESETS: { id: MaskPreset; label: string }[] = [
  { id: "rectangle", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "polygon", label: "Polygon" },
  { id: "custom", label: "Custom" },
  { id: "vector", label: "Vector" },
  { id: "png", label: "PNG" },
]

export function MaskControls({ element }: { element: TemplateElement }) {
  const updateElement = useTemplateStore((state) => state.updateElement)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const maskEdit = useTemplateStore((state) => state.maskEdit)
  const maskDraw = useTemplateStore((state) => state.maskDraw)
  const setMaskEdit = useTemplateStore((state) => state.setMaskEdit)
  const setMaskDraw = useTemplateStore((state) => state.setMaskDraw)
  if (element.type === "group") return null
  const mask = element.mask

  function apply(next: LayerMask | undefined, message: string) {
    updateElement(element.id, { mask: next })
    setStatus(message)
  }

  function choose(preset: MaskPreset) {
    const next = createMask(preset, element.width, element.height)
    apply(next, preset === "png" ? "Choose a PNG to use as the mask." : "Mask added. Edit mask to move, resize, or rotate it.")
    setMaskEdit(true)
    setMaskDraw(preset === "polygon" || preset === "custom" || preset === "vector")
  }

  function patch(partial: Partial<LayerMask>) {
    if (!mask) return
    updateElement(element.id, { mask: { ...mask, ...partial } })
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">Mask</p>
      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => choose(preset.id)}
            className={`rounded-md border px-1 py-1.5 text-[11px] ${
              mask && presetMatches(mask, preset.id)
                ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]"
                : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const below = clippingTarget(element.id)
            updateElement(element.id, { clipping: !element.clipping })
            setStatus(
              element.clipping
                ? "Clipping mask removed."
                : below
                  ? "Clipped to the layer below."
                  : "Clipping is on. Put a layer underneath to see it.",
            )
          }}
          className={`rounded-md border px-1 py-1.5 text-[11px] ${
            element.clipping
              ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]"
              : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
          }`}
        >
          Clip
        </button>
      </div>
      {mask ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setMaskEdit(!maskEdit)
                if (maskEdit) setMaskDraw(false)
                setStatus(maskEdit ? "Editing the layer." : "Drag the mask to move it. Corners resize it. The top handle rotates it.")
              }}
              className={`rounded-md border px-2 py-1.5 text-[11px] ${
                maskEdit ? "border-[var(--ed-accent)] bg-[var(--ed-accent)] text-white" : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
              }`}
            >
              {maskEdit ? "Editing mask" : "Edit mask"}
            </button>
            <button
              type="button"
              onClick={() => patch({ inverted: !mask.inverted })}
              className={`rounded-md border px-2 py-1.5 text-[11px] ${
                mask.inverted ? "border-[var(--ed-accent)] bg-[var(--ed-accent-wash)] text-[var(--ed-accent-ink)]" : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
              }`}
            >
              {mask.inverted ? "Inverted" : "Invert"}
            </button>
          </div>
          {mask.kind === "polygon" || mask.kind === "path" ? (
            <button
              type="button"
              onClick={() => {
                setMaskEdit(true)
                setMaskDraw(!maskDraw)
                setStatus(maskDraw ? "Point drawing is off." : "Click the sheet to add mask points. Double-click to finish.")
              }}
              className={`w-full rounded-md border px-2 py-1.5 text-[11px] ${
                maskDraw ? "border-[var(--ed-accent)] bg-[var(--ed-accent)] text-white" : "border-[var(--ed-line)] text-[var(--ed-secondary)]"
              }`}
            >
              {maskDraw ? "Adding points" : "Add points"}
            </button>
          ) : null}
          {mask.kind === "png" ? (
            <label className="block text-[11px] text-[var(--ed-secondary)]">
              PNG mask
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="mt-1 block w-full text-[11px]"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    if (typeof reader.result === "string") patch({ imageUrl: reader.result })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </label>
          ) : null}
          {mask.kind === "rounded" ? (
            <label className="block text-[11px] text-[var(--ed-secondary)]">
              Corner radius
              <input
                type="range"
                min={0}
                max={Math.round(Math.min(mask.width, mask.height) / 2)}
                value={Math.round(mask.cornerRadius ?? 0)}
                onChange={(event) => patch({ cornerRadius: Number(event.target.value) })}
                className="w-full"
              />
            </label>
          ) : null}
          <label className="block text-[11px] text-[var(--ed-secondary)]">
            Feather {Math.round(mask.feather)}
            <input
              type="range"
              min={0}
              max={80}
              value={Math.round(mask.feather)}
              onChange={(event) => patch({ feather: Number(event.target.value) })}
              className="w-full"
            />
          </label>
          <div className="grid grid-cols-2 gap-1">
            <NumberBox label="Mask X" value={mask.x} onChange={(x) => patch({ x })} />
            <NumberBox label="Mask Y" value={mask.y} onChange={(y) => patch({ y })} />
            <NumberBox label="Mask W" value={mask.width} onChange={(width) => patch({ width: Math.max(24, width) })} />
            <NumberBox label="Mask H" value={mask.height} onChange={(height) => patch({ height: Math.max(24, height) })} />
          </div>
          <NumberBox label="Mask rotation" value={mask.rotation} onChange={(rotation) => patch({ rotation })} />
          <button
            type="button"
            onClick={() => {
              apply(undefined, "Mask removed.")
              setMaskEdit(false)
              setMaskDraw(false)
            }}
            className="text-[11px] text-[var(--ed-muted)] underline"
          >
            Remove mask
          </button>
        </div>
      ) : (
        <p className="text-[11px] leading-4 text-[var(--ed-muted)]">
          A mask hides part of this layer. Clip uses the layer underneath as the mask.
        </p>
      )}
    </div>
  )
}

function clippingTarget(id: string): boolean {
  const elements = useTemplateStore.getState().template.elements.filter((item) => item.type !== "group")
  const ordered = [...elements].sort((a, b) => a.zIndex - b.zIndex)
  const index = ordered.findIndex((item) => item.id === id)
  return index > 0
}

function presetMatches(mask: LayerMask, preset: MaskPreset): boolean {
  if (preset === "custom") return mask.kind === "path" && mask.smooth === true
  if (preset === "vector") return mask.kind === "path" && !mask.smooth
  if (preset === "polygon") return mask.kind === "polygon"
  return mask.kind === preset
}

function NumberBox({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-[11px] text-[var(--ed-secondary)]">
      {label}
      <input
        type="number"
        value={Math.round(value)}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="mt-0.5 w-full rounded border border-[var(--ed-line)] bg-[var(--ed-surface)] px-1.5 py-1 text-[12px] text-[var(--ed-ink)]"
      />
    </label>
  )
}
