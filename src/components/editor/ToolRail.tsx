import type { EditorTool } from "../../store/templateStore"
import { useTemplateStore } from "../../store/templateStore"
import { ToolGlyph } from "./ToolGlyph"

interface ToolItem {
  id: EditorTool
  label: string
  hint: string
  icon: string
  quick?: boolean
}

const GROUPS: { title: string; tools: ToolItem[] }[] = [
  {
    title: "View",
    tools: [
      { id: "zoom", label: "Zoom", hint: "Zoom — click to zoom in, Option-click to zoom out.", icon: "zoom", quick: true },
      { id: "hand", label: "Hand", hint: "Hand — drag the gray area to pan the sheet.", icon: "hand", quick: true },
    ],
  },
  {
    title: "Select",
    tools: [
      { id: "select", label: "Move", hint: "Move — drag, scale, and rotate the selected layer.", icon: "move", quick: true },
      { id: "marquee", label: "Marquee", hint: "Marquee — drag a box around a layer to select it.", icon: "marquee", quick: true },
      { id: "quick-select", label: "Quick", hint: "Quick selection — click the layer you want.", icon: "quick" },
      { id: "wand", label: "Wand", hint: "Magic wand — click a layer to select it.", icon: "wand" },
    ],
  },
  {
    title: "Enhance",
    tools: [
      { id: "redeye", label: "Red eye", hint: "Red eye — drag across the red pupil.", icon: "redeye" },
      { id: "heal", label: "Heal", hint: "Healing — drag on a spot to repair it from the surrounding photo.", icon: "heal" },
      { id: "blemish", label: "Blemish", hint: "Blemish — drag over a mark on the skin.", icon: "heal" },
      { id: "skin", label: "Skin", hint: "Skin — drag to smooth skin. The Skin button smooths the whole photo.", icon: "sponge" },
      { id: "teeth", label: "Teeth", hint: "Teeth — drag across the teeth to whiten them.", icon: "sponge" },
      { id: "eye", label: "Eyes", hint: "Eyes — drag across an eye to lift contrast.", icon: "redeye" },
      { id: "face", label: "Face", hint: "Face enhancement — click a photo to smooth skin and lift clarity.", icon: "subject" },
      { id: "clone", label: "Clone", hint: "Clone — Option-click a source, then drag to paint it.", icon: "clone" },
      { id: "blur", label: "Blur", hint: "Blur — drag on a photo to soften that spot.", icon: "blur" },
      { id: "sponge", label: "Sponge", hint: "Sponge — drag on a photo to add saturation there.", icon: "sponge" },
      { id: "cleanup", label: "Cleanup", hint: "Background cleanup — click a photo to remove the background.", icon: "subject" },
      { id: "object", label: "Object", hint: "Object removal — drag over an object to fill it from the surrounding photo.", icon: "eraser" },
    ],
  },
  {
    title: "Draw",
    tools: [
      { id: "brush", label: "Brush", hint: "Brush — drag to paint. The mark follows the cursor. Finish near the start to fill the shape.", icon: "brush" },
      { id: "eraser", label: "Eraser", hint: "Eraser — click a layer to delete it.", icon: "eraser" },
      { id: "bucket", label: "Bucket", hint: "Paint bucket — click the sheet to fill the background, or click type to recolor it.", icon: "bucket" },
      { id: "shape", label: "Shape", hint: "Shape — choose rectangle, circle, oval, or another frame, then click the sheet.", icon: "shape" },
      { id: "text", label: "Type", hint: "Type — click the sheet to place text. Double-click type to edit it.", icon: "type", quick: true },
      { id: "pencil", label: "Pencil", hint: "Pencil — drag on the sheet to draw.", icon: "pencil" },
    ],
  },
  {
    title: "Modify",
    tools: [
      { id: "crop", label: "Crop", hint: "Crop — drag inside a photo to slide it in the frame.", icon: "crop", quick: true },
      { id: "subject", label: "Subject", hint: "Select Subject — click a photo to remove the background and keep the person.", icon: "subject", quick: true },
      { id: "cookie", label: "Cookie", hint: "Cookie cutter — click a photo to cycle its frame shape.", icon: "cookie" },
    ],
  },
]

export function ToolRail() {
  const tool = useTemplateStore((state) => state.tool)
  const mode = useTemplateStore((state) => state.workspaceMode)
  const setTool = useTemplateStore((state) => state.setTool)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const foreground = useTemplateStore((state) => state.foregroundColor)
  const background = useTemplateStore((state) => state.backgroundColor)
  const setForeground = useTemplateStore((state) => state.setForegroundColor)
  const setBackground = useTemplateStore((state) => state.setBackgroundColor)
  const swapColors = useTemplateStore((state) => state.swapColors)

  const groups = GROUPS.map((group) => ({
    ...group,
    tools: mode === "quick" ? group.tools.filter((item) => item.quick) : group.tools,
  })).filter((group) => group.tools.length > 0)

  return (
    <aside className="editor-scroll flex w-[74px] min-w-[74px] flex-col overflow-y-auto border-r border-[var(--ed-line)] bg-[var(--ed-panel)] py-1">
      {groups.map((group) => (
        <div key={group.title} className="mb-1">
          <div className="px-1 pb-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">
            {group.title}
          </div>
          <div className="grid grid-cols-2 gap-0.5 px-1">
            {group.tools.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                onClick={() => {
                  setTool(item.id)
                  setStatus(item.hint)
                }}
                className={`flex h-8 items-center justify-center rounded-[3px] ${
                  tool === item.id
                    ? "bg-[var(--ed-surface)] text-[var(--ed-ink)] shadow-[inset_0_0_0_1px_var(--ed-muted)]"
                    : "text-[var(--ed-text)] hover:bg-[var(--ed-raised)]"
                }`}
              >
                <ToolGlyph name={item.icon} />
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-auto px-2 pb-2 pt-3">
        <div className="px-1 pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ed-muted)]">
          Color
        </div>
        <div className="relative mx-auto h-10 w-10">
          <label className="absolute right-0 top-0 block h-6 w-6 cursor-pointer border border-[var(--ed-line)] shadow-sm" style={{ background: background }} title="Background color">
            <input
              type="color"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              className="sr-only"
            />
          </label>
          <label className="absolute bottom-0 left-0 z-10 block h-6 w-6 cursor-pointer border border-[var(--ed-line)] shadow-sm" style={{ background: foreground }} title="Foreground color">
            <input
              type="color"
              value={foreground}
              onChange={(event) => setForeground(event.target.value)}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            title="Swap colors"
            onClick={swapColors}
            className="absolute -right-1 bottom-0 text-[10px] text-[var(--ed-secondary)]"
          >
            ⇄
          </button>
        </div>
      </div>
    </aside>
  )
}

const GUIDED = [
  { title: "1. Move a layer", tool: "select" as const, detail: "Press V, then drag a photo or a line of type." },
  { title: "2. Crop a photo", tool: "crop" as const, detail: "Press C and drag inside a frame to reposition the picture." },
  { title: "3. Edit the type", tool: "text" as const, detail: "Press T and click the sheet, or double-click existing type." },
  { title: "4. Tone a photo", tool: "sponge" as const, detail: "Drag Sponge, Blur, or Red Eye on a photo." },
  { title: "5. Share the spread", tool: "hand" as const, detail: "Use Share for a PNG, a PSD, or Photoshop." },
]

export function GuidedPanel() {
  const setTool = useTemplateStore((state) => state.setTool)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const setDock = useTemplateStore((state) => state.setDockPanel)

  return (
    <aside className="flex w-[240px] min-w-[240px] flex-col border-r border-[var(--ed-line)] bg-[var(--ed-panel)]">
      <div className="border-b border-[var(--ed-line-soft)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ed-muted)]">
        Guided
      </div>
      <ol className="flex flex-col gap-2 p-3">
        {GUIDED.map((step) => (
          <li key={step.title}>
            <button
              type="button"
              onClick={() => {
                if (step.title.startsWith("5")) setDock("more")
                setTool(step.tool)
                setStatus(step.detail)
              }}
              className="w-full rounded-md border border-[var(--ed-line-soft)] bg-[var(--ed-surface)] px-3 py-2 text-left hover:border-[var(--ed-accent)]"
            >
              <div className="text-sm font-medium text-[var(--ed-ink)]">{step.title}</div>
              <div className="mt-1 text-xs text-[var(--ed-secondary)]">{step.detail}</div>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  )
}
