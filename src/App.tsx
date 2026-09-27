import { useEffect } from "react"
import { AlbumCanvas } from "./components/editor/AlbumCanvas"
import { AssetPanel } from "./components/editor/AssetPanel"
import { EditorDock } from "./components/editor/EditorDock"
import { LayersPanel } from "./components/editor/LayersPanel"
import { GuidedPanel, ToolRail } from "./components/editor/ToolRail"
import { PropertiesPanel } from "./components/editor/PropertiesPanel"
import { SelectionRefine } from "./components/editor/SelectionRefine"
import { WorkspaceBar } from "./components/editor/WorkspaceBar"
import type { EditorTool } from "./store/templateStore"
import { startAutosave } from "./services/documentFile"
import { startSessionKeep } from "./services/editorSession"
import { useTemplateStore } from "./store/templateStore"

const TOOL_KEYS: Partial<Record<string, { tool: EditorTool; status: string }>> = {
  v: { tool: "select", status: "Move — drag, scale, and rotate the selected layer." },
  h: { tool: "hand", status: "Hand — drag the gray area to pan the sheet." },
  z: { tool: "zoom", status: "Zoom — click to zoom in, Option-click to zoom out." },
  c: { tool: "crop", status: "Crop — drag inside a photo to slide it in the frame." },
  t: { tool: "text", status: "Type — click the sheet to place text. Double-click type to edit it." },
  m: { tool: "marquee", status: "Marquee — drag a box around a layer to select it." },
  w: { tool: "wand", status: "Magic wand — click a layer to select it." },
  b: { tool: "brush", status: "Brush — drag on the sheet to paint." },
  e: { tool: "eraser", status: "Eraser — click a layer to delete it." },
}

export default function App() {
  const undo = useTemplateStore((state) => state.undo)
  const redo = useTemplateStore((state) => state.redo)
  const deleteSelected = useTemplateStore((state) => state.deleteSelected)
  const duplicateSelected = useTemplateStore((state) => state.duplicateSelected)
  const groupSelected = useTemplateStore((state) => state.groupSelected)
  const ungroupSelected = useTemplateStore((state) => state.ungroupSelected)
  const copySelected = useTemplateStore((state) => state.copySelected)
  const pasteClipboard = useTemplateStore((state) => state.pasteClipboard)
  const setTool = useTemplateStore((state) => state.setTool)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const bringForward = useTemplateStore((state) => state.bringForward)
  const sendBackward = useTemplateStore((state) => state.sendBackward)
  const bringToFront = useTemplateStore((state) => state.bringToFront)
  const sendToBack = useTemplateStore((state) => state.sendToBack)
  const workspaceMode = useTemplateStore((state) => state.workspaceMode)
  const dockPanel = useTemplateStore((state) => state.dockPanel)
  const fullScreen = useTemplateStore((state) => state.fullScreen)
  const setFullScreen = useTemplateStore((state) => state.setFullScreen)

  useEffect(() => {
    startAutosave()
    startSessionKeep()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      if (typing) return
      if (useTemplateStore.getState().refineId) return
      if (event.key === "Escape" && useTemplateStore.getState().fullScreen) {
        event.preventDefault()
        setFullScreen(false)
        return
      }

      const key = event.key.toLowerCase()
      const mod = event.metaKey || event.ctrlKey

      if (mod && key === "a") {
        event.preventDefault()
        event.stopPropagation()
        const state = useTemplateStore.getState()
        const ids = state.template.elements.map((element) => element.id)
        state.selectMany(ids)
        setTool("select")
        setStatus(ids.length > 0 ? `Selected all ${ids.length} layers` : "No layers to select")
        return
      }
      if (mod && key === "c") {
        event.preventDefault()
        event.stopPropagation()
        copySelected()
        return
      }
      if (mod && key === "v") {
        event.preventDefault()
        event.stopPropagation()
        pasteClipboard()
        return
      }
      if (mod && key === "z") {
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === "d") {
        event.preventDefault()
        event.stopPropagation()
        duplicateSelected()
        return
      }
      if (mod && key === "g") {
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) ungroupSelected()
        else groupSelected()
        return
      }
      if (event.key === "]") {
        event.preventDefault()
        event.stopPropagation()
        if (mod) bringToFront()
        else bringForward()
        return
      }
      if (event.key === "[") {
        event.preventDefault()
        event.stopPropagation()
        if (mod) sendToBack()
        else sendBackward()
        return
      }
      if (!mod && !event.altKey) {
        const shortcut = TOOL_KEYS[key]
        if (shortcut) {
          event.preventDefault()
          setTool(shortcut.tool)
          setStatus(shortcut.status)
          return
        }
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        event.stopPropagation()
        deleteSelected()
      }
    }

    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    copySelected,
    pasteClipboard,
    setTool,
    setStatus,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    setFullScreen,
  ])

  return (
    <div className="relative flex h-full flex-col bg-[var(--ed-app)] text-ink">
      {fullScreen ? null : <WorkspaceBar />}
      <div className="flex min-h-0 flex-1">
        {fullScreen ? null : workspaceMode === "guided" ? <GuidedPanel /> : <ToolRail />}
        <AlbumCanvas />
        {fullScreen ? null : dockPanel === "library" || dockPanel === "graphics" ? <AssetPanel /> : null}
        {fullScreen ? null : dockPanel === "more" ? <PropertiesPanel /> : null}
        {fullScreen ? null : <LayersPanel />}
      </div>
      {fullScreen ? null : <EditorDock />}
      {fullScreen ? (
        <button
          type="button"
          onClick={() => setFullScreen(false)}
          className="absolute right-3 top-3 z-30 rounded border border-[var(--ed-line)] bg-[var(--ed-surface)] px-3 py-1.5 text-xs text-[var(--ed-ink)] shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:border-[var(--ed-accent)]"
        >
          Exit full screen
        </button>
      ) : null}
      <SelectionRefine />
    </div>
  )
}
