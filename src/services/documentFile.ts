import { slugify } from "./exportService"
import { exportTemplatePsd } from "./psdExportService"
import type { AlbumTemplate } from "../models/template"
import { useTemplateStore } from "../store/templateStore"

export type SavePhase = "idle" | "saving" | "saved" | "error"

export type SaveStatus = {
  name: string | null
  phase: SavePhase
}

type WritableTemplate = {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

type TemplateFileHandle = {
  name: string
  createWritable(): Promise<WritableTemplate>
  getFile(): Promise<File>
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<TemplateFileHandle>
  showOpenFilePicker?: (options: {
    multiple?: boolean
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<TemplateFileHandle[]>
}

const PSD_TYPE = {
  description: "Photoshop document",
  accept: { "application/vnd.adobe.photoshop": [".psd"] },
}

let handle: TemplateFileHandle | null = null
let snapshot: AlbumTemplate | null = null
let dirty = false
let timer = 0
let writing = false
let watching = false
let hold = false
const listeners = new Set<(status: SaveStatus) => void>()
let status: SaveStatus = { name: null, phase: "idle" }

function notify(next: SaveStatus) {
  status = next
  for (const listener of listeners) listener(status)
}

export function subscribeSaveStatus(listener: (status: SaveStatus) => void): () => void {
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

export function canChooseTemplateFile(): boolean {
  const host = window as FilePickerWindow
  return typeof host.showSaveFilePicker === "function"
}

function suggestedFileName(name: string): string {
  return `${slugify(name)}.psd`
}

export async function chooseTemplateFile(name: string): Promise<{ ok: true; name: string } | { ok: false; reason: "cancel" | "unsupported" }> {
  const pick = (window as FilePickerWindow).showSaveFilePicker
  if (!pick) return { ok: false, reason: "unsupported" }
  try {
    const next = await pick({
      suggestedName: suggestedFileName(name),
      types: [PSD_TYPE],
    })
    await flush()
    handle = next
    notify({ name: next.name, phase: "saving" })
    return { ok: true, name: next.name }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, reason: "cancel" }
    throw error
  }
}

export async function pickTemplateToOpen(): Promise<{ file: File; adopt: () => void } | null> {
  const pick = (window as FilePickerWindow).showOpenFilePicker
  if (!pick) return null
  const [picked] = await pick({
    multiple: false,
    types: [
      PSD_TYPE,
      { description: "Azent template", accept: { "application/json": [".json"] } },
    ],
  })
  const file = await picked.getFile()
  const psd = file.name.toLowerCase().endsWith(".psd")
  return {
    file,
    adopt: () => {
      if (!psd) return
      dirty = false
      snapshot = null
      handle = picked
      notify({ name: picked.name, phase: "saved" })
    },
  }
}

export async function saveDocumentNow(): Promise<void> {
  if (!handle) return
  snapshot = useTemplateStore.getState().template
  dirty = true
  await flush()
}

export function holdAutosave(paused: boolean): void {
  hold = paused
}

export function startAutosave(): void {
  if (watching) return
  watching = true
  useTemplateStore.subscribe((state, previous) => {
    if (hold || !handle || state.template === previous.template) return
    if (state.origin === "canvas" && state.historyIndex === previous.historyIndex) return
    snapshot = state.template
    dirty = true
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      void flush()
    }, 800)
  })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush()
  })
}

async function flush(): Promise<void> {
  window.clearTimeout(timer)
  timer = 0
  if (!handle || !dirty || !snapshot || writing) return
  const template = snapshot
  const file = handle
  dirty = false
  writing = true
  notify({ name: file.name, phase: "saving" })
  try {
    const blob = await exportTemplatePsd(template)
    const writable = await file.createWritable()
    await writable.write(blob)
    await writable.close()
    if (handle === file) notify({ name: file.name, phase: dirty ? "saving" : "saved" })
  } catch (error) {
    if (handle === file) notify({ name: file.name, phase: "error" })
    useTemplateStore.getState().setStatus(error instanceof Error ? error.message : "Could not save the PSD.")
  } finally {
    writing = false
    if (dirty) await flush()
  }
}
