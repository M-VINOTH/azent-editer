import { useEffect, useRef, useState } from "react"
import {
  canChooseTemplateFile,
  chooseTemplateFile,
  holdAutosave,
  pickTemplateToOpen,
  saveDocumentNow,
  subscribeSaveStatus,
  type SaveStatus,
} from "../../services/documentFile"
import { STUDIO_TEMPLATES, loadStudioTemplate } from "../../services/studioTemplates"
import { readRecents, rememberRecent, type RecentTemplate } from "../../services/recentTemplates"
import type { WorkspaceMode } from "../../store/templateStore"
import { useTemplateStore } from "../../store/templateStore"
import { useSpreadExport } from "./useSpreadExport"

const PLAIN_TEMPLATE = { name: "Untitled", width: 10800, height: 3600, dpi: 300 }

const MODES: { id: WorkspaceMode; label: string }[] = [
  { id: "quick", label: "Quick" },
  { id: "guided", label: "Guided" },
  { id: "advanced", label: "Advanced" },
]

export function WorkspaceBar() {
  const mode = useTemplateStore((state) => state.workspaceMode)
  const setMode = useTemplateStore((state) => state.setWorkspaceMode)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const loadTemplate = useTemplateStore((state) => state.loadTemplate)
  const name = useTemplateStore((state) => state.template.name)
  const setName = useTemplateStore((state) => state.setTemplateName)
  const { busy, loadJson, loadPsd, exportPng, exportPsd, openInPhotoshop } = useSpreadExport()
  const fileRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<"file" | "share" | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recents, setRecents] = useState<RecentTemplate[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const newTemplate = useTemplateStore((state) => state.newTemplate)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ name: null, phase: "idle" })

  useEffect(() => subscribeSaveStatus(setSaveStatus), [])

  const close = () => {
    setMenu(null)
    setRecentOpen(false)
  }

  const keepFile = async (name: string): Promise<"ready" | "cancel" | "memory"> => {
    if (!canChooseTemplateFile()) return "memory"
    const chosen = await chooseTemplateFile(name)
    if (!chosen.ok) return chosen.reason === "cancel" ? "cancel" : "memory"
    return "ready"
  }

  const startPlain = async (options = PLAIN_TEMPLATE) => {
    setGalleryOpen(false)
    setNewTemplateOpen(false)
    close()
    const kept = await keepFile(options.name)
    if (kept === "cancel") {
      setStatus("New file was not created. Choose a folder and try again.")
      return
    }
    newTemplate(options)
    setRecents(rememberRecent({ kind: "plain", ...options }))
    if (kept === "memory") {
      setStatus("This browser cannot save to a folder you choose. The sheet stays in this window until you export it.")
      return
    }
    await saveDocumentNow()
  }

  const openStudio = async (file: string, name: string) => {
    setGalleryOpen(false)
    close()
    const kept = await keepFile(name)
    if (kept === "cancel") {
      setStatus("Template was not created. Choose a folder and try again.")
      return
    }
    setStatus(`Opening ${name}… Large templates can take a minute.`)
    try {
      const template = await loadStudioTemplate(file)
      loadTemplate(
        template,
        template.elements.length > 0
          ? `Opened ${template.name} · ${template.elements.length} layers`
          : `Opened ${template.name}, but it had no layers to edit`,
      )
      setRecents(rememberRecent({ kind: "studio", file, name: template.name }))
      if (kept === "memory") {
        setStatus("This browser cannot save to a folder you choose. The sheet stays in this window until you export it.")
        return
      }
      await saveDocumentNow()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Could not open ${name}`)
    }
  }

  const saveAs = async () => {
    const current = useTemplateStore.getState().template.name
    const chosen = await chooseTemplateFile(current)
    if (!chosen.ok) {
      if (chosen.reason === "unsupported") setStatus("This browser cannot save to a folder you choose.")
      return
    }
    await saveDocumentNow()
    setStatus(`Edits are saved to ${chosen.name}`)
  }

  const openFromDisk = async () => {
    try {
      holdAutosave(true)
      const picked = await pickTemplateToOpen()
      if (!picked) {
        fileRef.current?.click()
        return
      }
      await saveDocumentNow()
      const psd = picked.file.name.toLowerCase().endsWith(".psd")
      if (psd) {
        const opened = await loadPsd(picked.file)
        if (opened) {
          picked.adopt()
          await saveDocumentNow()
        }
        return
      }
      await loadJson(picked.file)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setStatus(error instanceof Error ? error.message : "Could not open that file")
    } finally {
      holdAutosave(false)
    }
  }

  return (
    <header className="relative flex h-11 items-center border-b border-[var(--ed-line)] bg-[var(--ed-panel)] px-2 text-sm text-[var(--ed-text)]">
      <div className="flex items-center gap-1">
        <MenuButton label="File" open={menu === "file"} onClick={() => { setRecentOpen(false); setMenu(menu === "file" ? null : "file") }} />
      </div>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-end gap-5">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className={`pb-2 pt-3 text-sm ${
              mode === item.id ? "border-b-2 border-[var(--ed-accent)] font-medium text-[var(--ed-accent)]" : "text-[var(--ed-secondary)] hover:text-[var(--ed-hover)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeSwitch />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-40 truncate bg-transparent text-right text-xs text-[var(--ed-secondary)] outline-none"
          aria-label="Spread name"
        />
        {saveStatus.name ? (
          <span className="max-w-[180px] truncate text-[11px] text-[var(--ed-muted)]" title={saveStatus.name}>
            {saveStatus.phase === "saving" ? "Saving…" : saveStatus.phase === "error" ? "Save failed" : "Saved"} · {saveStatus.name}
          </span>
        ) : null}
        <MenuButton label="Share" open={menu === "share"} onClick={() => setMenu(menu === "share" ? null : "share")} />
      </div>

      {menu ? (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 cursor-default" onClick={close} />
          <div className="absolute top-11 z-30 min-w-[220px] rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] py-1 shadow-lg" style={{ left: menu === "share" ? undefined : 8, right: menu === "share" ? 8 : undefined }}>
            {menu === "file" ? (
              <>
                <Item label="New File" onClick={() => { close(); setGalleryOpen(true) }} />
                <Item label="Save As…" onClick={() => { close(); void saveAs() }} />
                <Item
                  label={busy === "psd" ? "Opening file…" : "Open from File"}
                  disabled={busy !== null}
                  onClick={() => { close(); void openFromDisk() }}
                />
                <Item
                  label="Open recent"
                  onClick={() => {
                    setRecents(readRecents())
                    setRecentOpen((open) => !open)
                  }}
                />
              </>
            ) : null}
            {menu === "share" ? (
              <>
                <Item label={busy === "png" ? "Exporting PNG…" : "Export PNG"} disabled={busy !== null} onClick={() => { close(); void exportPng() }} />
                <Item label={busy === "psd" ? "Exporting PSD…" : "Export PSD"} disabled={busy !== null} onClick={() => { close(); void exportPsd() }} />
                <Item label={busy === "photoshop" ? "Opening Photoshop…" : "Open in Photoshop"} disabled={busy !== null} onClick={() => { close(); void openInPhotoshop() }} />
              </>
            ) : null}
          </div>
          {menu === "file" && recentOpen ? <RecentMenu recents={recents} onPlain={startPlain} onStudio={(file, name) => void openStudio(file, name)} /> : null}
        </>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".json,.psd,application/json,application/vnd.adobe.photoshop"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          if (file.name.toLowerCase().endsWith(".psd")) void loadPsd(file)
          else void loadJson(file)
        }}
      />
      {galleryOpen ? (
        <CreateGallery
          onClose={() => setGalleryOpen(false)}
          onPlain={() => startPlain()}
          onCustom={() => setNewTemplateOpen(true)}
          onStudio={(file, name) => void openStudio(file, name)}
        />
      ) : null}
      {newTemplateOpen ? (
        <NewTemplateDialog
          onClose={() => setNewTemplateOpen(false)}
          onCreate={(options) => startPlain(options)}
        />
      ) : null}
    </header>
  )
}

function NewTemplateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (options: { name: string; width: number; height: number; dpi: number }) => void
}) {
  const [name, setName] = useState("Untitled")
  const [unit, setUnit] = useState<"in" | "px">("in")
  const [width, setWidth] = useState("36")
  const [height, setHeight] = useState("12")
  const [dpi, setDpi] = useState("300")
  const widthValue = Number(width)
  const heightValue = Number(height)
  const dpiValue = Number(dpi)
  const valid = widthValue > 0 && heightValue > 0 && dpiValue > 0
  const pixelWidth = unit === "in" ? Math.round(widthValue * dpiValue) : Math.round(widthValue)
  const pixelHeight = unit === "in" ? Math.round(heightValue * dpiValue) : Math.round(heightValue)
  const tooLarge = pixelWidth > 30000 || pixelHeight > 30000

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-[380px] rounded-lg border border-[var(--ed-line)] bg-[var(--ed-surface)] p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid || tooLarge) return
          onCreate({ name, width: pixelWidth, height: pixelHeight, dpi: Math.round(dpiValue) })
        }}
      >
        <h2 className="text-sm font-semibold text-[var(--ed-ink)]">New template</h2>
        <p className="mt-1 text-xs text-[var(--ed-muted)]">Set the sheet size and resolution. The canvas is stored in pixels.</p>
        <label className="mt-4 block text-[11px] uppercase tracking-[0.14em] text-[var(--ed-muted)]">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--ed-line)] px-2 py-1.5 text-sm normal-case tracking-normal text-[var(--ed-ink)]"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-[var(--ed-muted)]">
            Width
            <input
              type="number"
              min={0.1}
              step="any"
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--ed-line)] px-2 py-1.5 text-sm normal-case tracking-normal text-[var(--ed-ink)]"
            />
          </label>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-[var(--ed-muted)]">
            Height
            <input
              type="number"
              min={0.1}
              step="any"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--ed-line)] px-2 py-1.5 text-sm normal-case tracking-normal text-[var(--ed-ink)]"
            />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-[var(--ed-muted)]">
            Units
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as "in" | "px")}
              className="mt-1 w-full rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1.5 text-sm normal-case tracking-normal text-[var(--ed-ink)]"
            >
              <option value="in">Inches</option>
              <option value="px">Pixels</option>
            </select>
          </label>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-[var(--ed-muted)]">
            Resolution
            <input
              type="number"
              min={1}
              step={1}
              value={dpi}
              onChange={(event) => setDpi(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--ed-line)] px-2 py-1.5 text-sm normal-case tracking-normal text-[var(--ed-ink)]"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-[var(--ed-secondary)]">
          {valid ? `${pixelWidth} × ${pixelHeight} px at ${Math.round(dpiValue)} dpi` : "Enter a width, height, and DPI."}
          {tooLarge ? " Size is too large for the sheet." : ""}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-[var(--ed-secondary)]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || tooLarge}
            className="rounded-md bg-[var(--ed-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

function CreateGallery({
  onClose,
  onPlain,
  onCustom,
  onStudio,
}: {
  onClose: () => void
  onPlain: () => void
  onCustom: () => void
  onStudio: (file: string, name: string) => void
}) {
  const [opening, setOpening] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex h-[min(720px,86vh)] w-[min(960px,100%)] flex-col overflow-hidden rounded-lg border border-[var(--ed-line)] bg-[var(--ed-surface)] shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--ed-line-soft)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ed-ink)]">Create new</h2>
            <p className="mt-0.5 text-xs text-[var(--ed-muted)]">Start from a plain sheet or a layout. Choose a folder. If that name already exists, a copy is created, and edits update the copy.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCustom} className="rounded-md border border-[var(--ed-accent)] px-3 py-1.5 text-sm text-[var(--ed-accent-ink)]">
              Custom size
            </button>
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-[var(--ed-secondary)]">
              Close
            </button>
          </div>
        </div>
        <div className="editor-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={onPlain}
              className="overflow-hidden rounded-md border border-[var(--ed-line-soft)] bg-[var(--ed-surface)] text-left hover:border-[var(--ed-accent)]"
            >
              <span
                className="block aspect-[3/1] w-full border-b border-[var(--ed-line-soft)]"
                style={{
                  backgroundColor: "#fff",
                  backgroundImage:
                    "linear-gradient(45deg, #d9d9d9 25%, transparent 25%), linear-gradient(-45deg, #d9d9d9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d9d9d9 75%), linear-gradient(-45deg, transparent 75%, #d9d9d9 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                }}
              />
              <span className="block truncate px-2.5 py-2 text-xs text-[var(--ed-text)]">Plain</span>
            </button>
            {STUDIO_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={opening !== null}
                onClick={() => {
                  setOpening(template.file)
                  onStudio(template.file, template.name)
                }}
                className="relative overflow-hidden rounded-md border border-[var(--ed-line-soft)] bg-[var(--ed-surface)] text-left hover:border-[var(--ed-accent)] disabled:opacity-60"
              >
                <span className="block aspect-[3/1] w-full bg-[var(--ed-panel)]">
                  <img
                    src={`/template-previews/${encodeURIComponent(`${template.file}.png`)}`}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
                {opening === template.file ? (
                  <span className="absolute inset-0 grid place-items-center bg-[var(--ed-surface)]/75 text-xs text-[var(--ed-text)]">Opening…</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentMenu({
  recents,
  onPlain,
  onStudio,
}: {
  recents: RecentTemplate[]
  onPlain: (options: { name: string; width: number; height: number; dpi: number }) => void
  onStudio: (file: string, name: string) => void
}) {
  return (
    <div className="absolute left-[236px] top-11 z-30 w-[260px] rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] py-1 shadow-lg">
      {recents.length === 0 ? <p className="px-3 py-2 text-sm text-[var(--ed-muted)]">No recent templates</p> : null}
      {recents.map((recent) => (
        <button
          key={recent.kind === "studio" ? recent.file : `plain-${recent.width}x${recent.height}-${recent.dpi}`}
          type="button"
          onClick={() =>
            recent.kind === "studio"
              ? onStudio(recent.file, recent.name)
              : onPlain({ name: recent.name, width: recent.width, height: recent.height, dpi: recent.dpi })
          }
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-[var(--ed-accent-wash)]"
        >
          {recent.kind === "studio" ? (
            <img
              src={`/template-previews/${encodeURIComponent(`${recent.file}.png`)}`}
              alt=""
              className="h-8 w-12 rounded border border-[var(--ed-line-soft)] object-contain bg-[var(--ed-surface)]"
            />
          ) : (
            <span
              className="block h-8 w-12 rounded border border-[var(--ed-line-soft)]"
              style={{
                backgroundColor: "#fff",
                backgroundImage:
                  "linear-gradient(45deg, #d9d9d9 25%, transparent 25%), linear-gradient(-45deg, #d9d9d9 25%, transparent 25%)",
                backgroundSize: "8px 8px",
              }}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--ed-ink)]">{recent.kind === "plain" ? "Plain" : recent.name}</span>
        </button>
      ))}
    </div>
  )
}

function ThemeSwitch() {
  const theme = useTemplateStore((state) => state.theme)
  const setTheme = useTemplateStore((state) => state.setTheme)
  return (
    <div className="flex overflow-hidden rounded border border-[var(--ed-line)]" role="group" aria-label="Editor theme">
      {(["light", "dark"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={theme === item}
          onClick={() => setTheme(item)}
          className={`px-2 py-1 text-xs capitalize ${
            theme === item ? "bg-[var(--ed-accent)] text-white" : "bg-[var(--ed-surface)] text-[var(--ed-secondary)] hover:text-[var(--ed-ink)]"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

function MenuButton({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm ${open ? "bg-[var(--ed-raised)]" : "hover:bg-[var(--ed-raised)]"}`}
    >
      {label}
      <span className="ml-1 text-[9px] text-[var(--ed-muted)]">▾</span>
    </button>
  )
}

function Item({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm text-[var(--ed-ink)] hover:bg-[var(--ed-accent-wash)] disabled:opacity-40"
    >
      {label}
    </button>
  )
}
