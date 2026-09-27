import { slugify } from "./exportService"
import { rememberSessionFile, readSessionFile, sessionWasRestored } from "./editorSession"
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
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
}

type DirectoryHandle = {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<TemplateFileHandle>
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
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
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandle>
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
  return typeof host.showDirectoryPicker === "function" || typeof host.showSaveFilePicker === "function"
}

function suggestedFileName(name: string): string {
  return `${slugify(name)}.psd`
}

/** Ask once, while the folder picker click is still active, so later edits can write without another prompt. */
async function grantWrite(file: {
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
}): Promise<boolean> {
  if (!file.queryPermission || !file.requestPermission) return true
  const mode = { mode: "readwrite" as const }
  try {
    if ((await file.queryPermission(mode)) === "granted") return true
    return (await file.requestPermission(mode)) === "granted"
  } catch {
    return false
  }
}

async function canWrite(file: TemplateFileHandle): Promise<boolean> {
  if (!file.queryPermission) return true
  return (await file.queryPermission({ mode: "readwrite" })) === "granted"
}

function nameOptions(fileName: string, copyOnly: boolean): string[] {
  const base = fileName.replace(/\.psd$/i, "")
  const names: string[] = []
  if (!copyOnly) names.push(`${base}.psd`)
  names.push(`${base} copy.psd`)
  for (let index = 2; index < 50; index += 1) names.push(`${base} copy ${index}.psd`)
  return names
}

async function createUnusedFile(directory: DirectoryHandle, names: string[]): Promise<TemplateFileHandle> {
  for (const candidate of names) {
    try {
      await directory.getFileHandle(candidate)
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        return directory.getFileHandle(candidate, { create: true })
      }
      throw error
    }
  }
  const fallback = names[0]?.replace(/\.psd$/i, "") ?? "template"
  return directory.getFileHandle(`${fallback} ${Date.now()}.psd`, { create: true })
}

async function createInFolder(
  pickDirectory: NonNullable<FilePickerWindow["showDirectoryPicker"]>,
  fileName: string,
  copyOnly: boolean,
): Promise<TemplateFileHandle> {
  const directory = await pickDirectory({ mode: "readwrite" })
  await grantWrite(directory)
  const created = await createUnusedFile(directory, nameOptions(fileName, copyOnly))
  await grantWrite(created)
  return created
}

export async function chooseTemplateFile(name: string): Promise<{ ok: true; name: string } | { ok: false; reason: "cancel" | "unsupported" }> {
  const host = window as FilePickerWindow
  if (!host.showDirectoryPicker && !host.showSaveFilePicker) return { ok: false, reason: "unsupported" }
  try {
    const next = host.showDirectoryPicker
      ? await createInFolder(host.showDirectoryPicker, suggestedFileName(name), false)
      : await host.showSaveFilePicker!({
          suggestedName: suggestedFileName(name),
          types: [PSD_TYPE],
        })
    if (!host.showDirectoryPicker) await grantWrite(next)
    await flush()
    assignHandle(next)
    notify({ name: next.name, phase: "saving" })
    return { ok: true, name: next.name }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, reason: "cancel" }
    throw error
  }
}

export async function pickTemplateToOpen(): Promise<{ file: File; adopt: () => void } | null> {
  const host = window as FilePickerWindow
  const pick = host.showOpenFilePicker
  if (!pick) return null
  const [picked] = await pick({
    multiple: false,
    types: [
      PSD_TYPE,
      { description: "Azent template", accept: { "application/json": [".json"] } },
    ],
  })
  const psd = picked.name.toLowerCase().endsWith(".psd")
  const copy = psd && host.showDirectoryPicker ? await createInFolder(host.showDirectoryPicker, picked.name, true) : null
  const file = await picked.getFile()
  return {
    file,
    adopt: () => {
      if (!copy) return
      dirty = false
      snapshot = null
      assignHandle(copy)
      notify({ name: copy.name, phase: "saved" })
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

function assignHandle(file: TemplateFileHandle): void {
  handle = file
  rememberSessionFile(file)
}

export async function restoreDocumentFile(): Promise<void> {
  if (!sessionWasRestored()) return
  const file = await readSessionFile<TemplateFileHandle>()
  if (!file?.name || typeof file.createWritable !== "function") return
  handle = file
  const allowed = await canWrite(file)
  if (allowed) {
    notify({ name: file.name, phase: "saved" })
    useTemplateStore.getState().setStatus(`Restored your last session. Edits keep saving to ${file.name}.`)
    return
  }
  notify({ name: file.name, phase: "idle" })
  useTemplateStore.getState().setStatus(`Restored your last session. Click once to keep saving to ${file.name}.`)
  const ask = () => {
    document.removeEventListener("pointerdown", ask, true)
    void grantWrite(file).then((ok) => {
      if (!ok || handle !== file) return
      notify({ name: file.name, phase: "saved" })
      void saveDocumentNow()
    })
  }
  document.addEventListener("pointerdown", ask, true)
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
  let allowed = false
  try {
    allowed = await canWrite(file)
    if (!allowed) {
      dirty = true
      if (handle === file) notify({ name: file.name, phase: "error" })
      return
    }
    const blob = await exportTemplatePsd(template)
    const writable = await file.createWritable()
    await writable.write(blob)
    await writable.close()
    if (handle === file) notify({ name: file.name, phase: dirty ? "saving" : "saved" })
  } catch (error) {
    dirty = true
    if (handle === file) notify({ name: file.name, phase: "error" })
    useTemplateStore.getState().setStatus(error instanceof Error ? error.message : "Could not save the PSD.")
  } finally {
    writing = false
    if (dirty && allowed) await flush()
  }
}
