import type { ChangeEvent, ReactNode } from "react"
import type {
  Background,
  DecorationElement,
  PhotoElement,
  TemplateElement,
  TextElement,
} from "../../models/template"
import {
  BLEND_MODES,
  BLEND_MODE_LABELS,
  FONT_OPTIONS,
  FONT_WEIGHTS,
  PHOTO_ROLES,
  PHOTO_ROLE_LABELS,
  PHOTO_SHAPES,
  PHOTO_SHAPE_LABELS,
} from "../../models/template"
import { useTemplateStore } from "../../store/templateStore"
import { lockedWithAncestors } from "../../utils/geometry"

export function PropertiesPanel() {
  const template = useTemplateStore((state) => state.template)
  const selectedId = useTemplateStore((state) => state.selectedId)
  const updateElement = useTemplateStore((state) => state.updateElement)
  const setBackground = useTemplateStore((state) => state.setBackground)
  const element = template.elements.find((item) => item.id === selectedId)
  const locked = Boolean(element && lockedWithAncestors(template.elements).has(element.id))

  return (
    <aside className="flex w-[280px] min-w-[280px] flex-col border-l border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Properties
        </h2>
      </div>
      <div className="editor-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {!element ? (
          <BackgroundProperties background={template.background} onChange={setBackground} />
        ) : (
          <fieldset disabled={locked} className={locked ? "pointer-events-none opacity-60" : undefined}>
            {locked ? <p className="mb-3 text-xs leading-5 text-[var(--ed-muted)]">Unlock this layer to edit it.</p> : null}
            <ElementProperties
              element={element}
              onChange={(patch) => updateElement(element.id, patch)}
            />
          </fieldset>
        )}
      </div>
    </aside>
  )
}

function BackgroundProperties({
  background,
  onChange,
}: {
  background: Background
  onChange: (background: Background) => void
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">No element selected. Edit the spread background.</p>
      <Section label="Background">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() =>
              onChange({
                type: "color",
                value: background.type === "color" ? background.value : "#F5EFE6",
              })
            }
            className={`rounded-md border px-2 py-1 text-xs ${
              background.type === "color" ? "border-gold bg-gold/15 text-gold-strong" : "border-line"
            }`}
          >
            Color
          </button>
          <button
            type="button"
            disabled={background.type !== "image"}
            className={`rounded-md border px-2 py-1 text-xs ${
              background.type === "image" ? "border-gold bg-gold/15 text-gold-strong" : "border-line"
            }`}
          >
            Image
          </button>
        </div>
        {background.type === "color" ? (
          <div className="mt-3">
            <input
              type="color"
              value={background.value}
              onChange={(event) => onChange({ type: "color", value: event.target.value })}
              className="h-9 w-full cursor-pointer rounded border border-line bg-transparent"
            />
          </div>
        ) : background.type === "image" ? (
          <div className="mt-3">
            <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">
              Image Opacity
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={background.opacity ?? 1}
              onChange={(event) =>
                onChange({ ...background, opacity: Number(event.target.value) })
              }
              className="w-full"
            />
            <div className="text-xs text-muted">{Math.round((background.opacity ?? 1) * 100)}%</div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Transparent</p>
        )}
      </Section>
    </div>
  )
}

function ElementProperties({
  element,
  onChange,
}: {
  element: TemplateElement
  onChange: (patch: Partial<TemplateElement>) => void
}) {
  return (
    <div className="space-y-5">
      <Section label="Type">
        <div className="text-sm capitalize">{element.type}</div>
      </Section>

      <Section label="Position">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={element.x} onChange={(x) => onChange({ x })} />
          <NumberField label="Y" value={element.y} onChange={(y) => onChange({ y })} />
        </div>
      </Section>

      <Section label="Size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width" value={element.width} min={1} onChange={(width) => onChange({ width })} />
          <NumberField
            label="Height"
            value={element.height}
            min={1}
            onChange={(height) => onChange({ height })}
          />
        </div>
      </Section>

      <Section label="Transform">
        <NumberField
          label="Rotation"
          value={element.rotation}
          step={0.5}
          onChange={(rotation) => onChange({ rotation })}
        />
      </Section>

      {element.type === "photo" ? (
        <PhotoFields element={element} onChange={onChange} />
      ) : null}
      {element.type === "text" ? (
        <TextFields element={element} onChange={onChange} />
      ) : null}
      {element.type === "decoration" ? (
        <DecorationFields element={element} onChange={onChange} />
      ) : null}
    </div>
  )
}

function PhotoFields({
  element,
  onChange,
}: {
  element: PhotoElement
  onChange: (patch: Partial<PhotoElement>) => void
}) {
  return (
    <>
      <Section label="Photo">
        <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">Role</label>
        <div className="grid grid-cols-3 gap-1">
          {PHOTO_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() =>
                onChange({
                  role,
                  opacity: role === "wash" ? (element.opacity ?? 0.22) : 1,
                  blendMode: role === "wash" ? "multiply" : "normal",
                  objectFit: role === "cutout" ? "contain" : role === "slot" ? "cover" : element.objectFit,
                })
              }
              className={`rounded-md border px-2 py-1 text-xs capitalize ${
                (element.role ?? "slot") === role
                  ? "border-gold bg-gold/15 text-gold-strong"
                  : "border-line"
              }`}
            >
              {PHOTO_ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">Shape</label>
        <select
          value={element.shape}
          onChange={(event) =>
            onChange({ shape: event.target.value as PhotoElement["shape"] })
          }
          className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
        >
          {PHOTO_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {PHOTO_SHAPE_LABELS[shape]}
            </option>
          ))}
        </select>
        {element.shape === "rounded" ? (
          <div className="mt-2">
            <NumberField
              label="Corner Radius"
              value={element.cornerRadius ?? 180}
              min={0}
              onChange={(cornerRadius) => onChange({ cornerRadius })}
            />
          </div>
        ) : null}
        <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">
          Frame crop
        </label>
        <p className="text-xs text-muted">Double-click a frame, or choose Drag inside, then drag to slide the photo. Scroll to zoom it.</p>
        <button
          type="button"
          onClick={() => onChange({ panX: 0, panY: 0, photoScale: 1 })}
          className="mt-2 text-xs text-gold-strong hover:underline"
        >
          Reset crop
        </button>
        <div className="mt-3">
          <NumberField
            label="Photo zoom %"
            value={Math.round((element.photoScale ?? 1) * 100)}
            min={40}
            onChange={(percent) => onChange({ photoScale: Math.min(4, Math.max(0.4, percent / 100)) })}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onChange({ flipX: !element.flipX })}
            className={`rounded-md border px-2 py-1 text-xs ${
              element.flipX ? "border-gold bg-gold/15 text-gold-strong" : "border-line"
            }`}
          >
            Flip H
          </button>
          <button
            type="button"
            onClick={() => onChange({ flipY: !element.flipY })}
            className={`rounded-md border px-2 py-1 text-xs ${
              element.flipY ? "border-gold bg-gold/15 text-gold-strong" : "border-line"
            }`}
          >
            Flip V
          </button>
        </div>
        <select
          value={element.objectFit}
          onChange={(event) =>
            onChange({ objectFit: event.target.value as PhotoElement["objectFit"] })
          }
          className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
        >
          <option value="cover">Fill</option>
          <option value="contain">Fit</option>
        </select>
        <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">
          Opacity
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={element.opacity ?? 1}
          onChange={(event) => onChange({ opacity: Number(event.target.value) })}
          className="w-full"
        />
        <div className="text-xs text-muted">{Math.round((element.opacity ?? 1) * 100)}%</div>
        <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">
          Blend
        </label>
        <select
          value={element.blendMode ?? "normal"}
          onChange={(event) =>
            onChange({ blendMode: event.target.value as PhotoElement["blendMode"] })
          }
          className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
        >
          {BLEND_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {BLEND_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        {element.shape !== "polaroid" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberField
              label="Border"
              value={element.border?.width ?? 0}
              min={0}
              onChange={(width) =>
                onChange({
                  border: { width, color: element.border?.color ?? "#FFFFFF" },
                })
              }
            />
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">
                Border Color
              </span>
              <input
                type="color"
                value={element.border?.color ?? "#FFFFFF"}
                onChange={(event) =>
                  onChange({
                    border: { width: element.border?.width ?? 32, color: event.target.value },
                  })
                }
                className="h-9 w-full cursor-pointer rounded border border-line bg-transparent"
              />
            </label>
          </div>
        ) : null}
        {element.imageUrl ? (
          <button
            type="button"
            onClick={() => onChange({ imageUrl: undefined })}
            className="mt-3 text-xs text-gold-strong hover:underline"
          >
            Clear photo (keep slot)
          </button>
        ) : (
          <p className="mt-3 text-xs text-muted">Empty slot — assign a photo from Assets.</p>
        )}
      </Section>
    </>
  )
}

function TextFields({
  element,
  onChange,
}: {
  element: TextElement
  onChange: (patch: Partial<TextElement>) => void
}) {
  return (
    <Section label="Typography">
      <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">Text</label>
      <textarea
        value={element.text}
        onChange={(event) => onChange({ text: event.target.value })}
        rows={3}
        className="w-full resize-y rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
      />
      <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">Font</label>
      <select
        value={element.fontFamily}
        onChange={(event) => onChange({ fontFamily: event.target.value })}
        className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField
          label="Font Size"
          value={element.fontSize}
          min={8}
          onChange={(fontSize) => onChange({ fontSize })}
        />
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">
            Weight
          </label>
          <select
            value={element.fontWeight}
            onChange={(event) => onChange({ fontWeight: event.target.value })}
            className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
          >
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">
        Alignment
      </label>
      <div className="grid grid-cols-3 gap-1">
        {(["left", "center", "right"] as const).map((align) => (
          <button
            key={align}
            type="button"
            onClick={() => onChange({ textAlign: align })}
            className={`rounded-md border px-2 py-1 text-xs capitalize ${
              element.textAlign === align
                ? "border-gold bg-gold/15 text-gold-strong"
                : "border-line"
            }`}
          >
            {align}
          </button>
        ))}
      </div>
      <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">
        Color
      </label>
      <input
        type="color"
        value={element.color}
        onChange={(event) => onChange({ color: event.target.value })}
        className="h-9 w-full cursor-pointer rounded border border-line bg-transparent"
      />
    </Section>
  )
}

function DecorationFields({
  element,
  onChange,
}: {
  element: DecorationElement
  onChange: (patch: Partial<DecorationElement>) => void
}) {
  return (
    <Section label="Decoration">
      <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">
        Opacity
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={element.opacity}
        onChange={(event) => onChange({ opacity: Number(event.target.value) })}
        className="w-full"
      />
      <div className="text-xs text-muted">{Math.round(element.opacity * 100)}%</div>
      <label className="mb-1 mt-3 block text-[11px] uppercase tracking-[0.14em] text-muted">
        Blend
      </label>
      <select
        value={element.blendMode ?? "normal"}
        onChange={(event) =>
          onChange({ blendMode: event.target.value as DecorationElement["blendMode"] })
        }
        className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
      >
        {BLEND_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {BLEND_MODE_LABELS[mode]}
          </option>
        ))}
      </select>
    </Section>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
        {label}
      </h3>
      {children}
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
}) {
  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    if (!Number.isFinite(next)) return
    if (min !== undefined && next < min) return
    onChange(next)
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={handle}
        className="w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm"
      />
    </label>
  )
}
