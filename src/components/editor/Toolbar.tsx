import { useRef, useState } from "react"
import { downloadBlob, exportTemplatePng, exportTemplatePsd, slugify } from "../../services/exportService"
import { useTemplateStore } from "../../store/templateStore"

const TOOLS = [
  { id: "select", label: "Move" },
  { id: "crop", label: "Crop" },
  { id: "text", label: "Type" },
  { id: "photo", label: "Add Photo Slot" },
  { id: "decoration", label: "Add Decoration" },
] as const

export function Toolbar() {
  const tool = useTemplateStore((state) => state.tool)
  const selectedId = useTemplateStore((state) => state.selectedId)
  const historyIndex = useTemplateStore((state) => state.historyIndex)
  const history = useTemplateStore((state) => state.history)
  const setTool = useTemplateStore((state) => state.setTool)
  const addPhotoSlot = useTemplateStore((state) => state.addPhotoSlot)
  const addDecoration = useTemplateStore((state) => state.addDecoration)
  const deleteSelected = useTemplateStore((state) => state.deleteSelected)
  const bringForward = useTemplateStore((state) => state.bringForward)
  const sendBackward = useTemplateStore((state) => state.sendBackward)
  const duplicateSelected = useTemplateStore((state) => state.duplicateSelected)
  const undo = useTemplateStore((state) => state.undo)
  const redo = useTemplateStore((state) => state.redo)
  const exportJson = useTemplateStore((state) => state.exportJson)
  const loadFromJson = useTemplateStore((state) => state.loadFromJson)
  const template = useTemplateStore((state) => state.template)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"png" | "psd" | "photoshop" | null>(null)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const saveJson = () => {
    const blob = new Blob([exportJson()], { type: "application/json" })
    downloadBlob(blob, `${slugify(template.name)}.json`)
    setStatus("Saved template JSON")
  }

  const loadJson = async (file: File) => {
    try {
      const raw = await file.text()
      loadFromJson(raw)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load template")
    }
  }

  const exportPreview = async () => {
    setBusy("png")
    setStatus("Exporting PNG preview…")
    try {
      const blob = await exportTemplatePng(template)
      downloadBlob(blob, `${slugify(template.name)}-preview.png`)
      setStatus("Exported PNG preview")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "PNG export failed")
    } finally {
      setBusy(null)
    }
  }

  const exportPsd = async () => {
    setBusy("psd")
    setStatus("Exporting PSD…")
    try {
      const blob = await exportTemplatePsd(template)
      downloadBlob(blob, `${slugify(template.name)}.psd`)
      setStatus("Exported layered PSD")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "PSD export failed")
    } finally {
      setBusy(null)
    }
  }

  const openInPhotoshop = async () => {
    setBusy("photoshop")
    setStatus("Opening the spread in Photoshop…")
    try {
      const blob = await exportTemplatePsd(template)
      const filename = `${slugify(template.name)}.psd`
      const response = await fetch("/api/open-photoshop", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-filename": filename,
        },
        body: blob,
      })
      const result = (await response.json()) as {
        ok: boolean
        app?: string
        error?: string
        path?: string
        warning?: string
      }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not open Photoshop")
      }
      const saved = result.path ? ` Saved ${result.path}` : ""
      setStatus(result.warning ? `${result.warning}${saved}` : `Opened in ${result.app}.${saved}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open Photoshop")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-12 items-center gap-1 overflow-x-auto border-b border-line bg-panel-2 px-3">
      {TOOLS.map((item) => (
        <ToolButton
          key={item.id}
          active={tool === item.id}
          onClick={() => {
            if (item.id === "photo") addPhotoSlot()
            else if (item.id === "decoration") addDecoration()
            else if (item.id === "text") {
              setTool("text")
              setStatus("Type — click the spread to place text. Double-click type to edit it.")
            } else if (item.id === "crop") {
              setTool("crop")
              setStatus("Crop — drag inside a photo to reposition it in the frame.")
            } else {
              setTool("select")
              setStatus("Move — drag, scale, and rotate the selected layer.")
            }
          }}
        >
          {item.label}
        </ToolButton>
      ))}

      <Divider />

      <ToolButton disabled={!selectedId} onClick={deleteSelected}>
        Delete
      </ToolButton>
      <ToolButton disabled={!selectedId} onClick={bringForward}>
        Forward
      </ToolButton>
      <ToolButton disabled={!selectedId} onClick={sendBackward}>
        Backward
      </ToolButton>
      <ToolButton disabled={!selectedId} onClick={duplicateSelected}>
        Duplicate
      </ToolButton>

      <Divider />

      <ToolButton disabled={!canUndo} onClick={undo}>
        Undo
      </ToolButton>
      <ToolButton disabled={!canRedo} onClick={redo}>
        Redo
      </ToolButton>

      <div className="ml-auto flex items-center gap-1">
        <ToolButton onClick={saveJson}>Save</ToolButton>
        <ToolButton onClick={() => fileRef.current?.click()}>Load</ToolButton>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void loadJson(file)
            event.target.value = ""
          }}
        />
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void exportPreview()}
          className="rounded-md bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold-strong hover:bg-gold/25 disabled:opacity-50"
        >
          {busy === "png" ? "Exporting PNG…" : "Export PNG"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void exportPsd()}
          className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-[#2a2118] hover:bg-gold-strong disabled:opacity-50"
        >
          {busy === "psd" ? "Exporting PSD…" : "Export PSD"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void openInPhotoshop()}
          className="rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-strong hover:bg-gold/20 disabled:opacity-50"
        >
          {busy === "photoshop" ? "Opening…" : "Open in Photoshop"}
        </button>
      </div>
    </div>
  )
}

function ToolButton({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium ${
        active
          ? "bg-gold/15 text-gold-strong"
          : "text-ink/90 hover:bg-[var(--ed-surface)]/5"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-line" />
}
