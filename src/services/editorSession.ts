import type { AlbumTemplate } from "../models/template"
import { useTemplateStore, type SheetGuide } from "../store/templateStore"
import { validateTemplate } from "../utils/validation"

type SessionDesign = {
  template: AlbumTemplate
  guides: SheetGuide[]
  selectedId: string | null
}

type SessionFile = {
  name: string
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>
}

const DB_NAME = "azent-editor-session"
const STORE = "session"

let databasePromise: Promise<IDBDatabase> | null = null
let started = false
let keep = false
let timer = 0

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return databasePromise
}

function putValue(key: string, value: unknown): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, "readwrite")
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function readValue<T>(key: string): Promise<T | null> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, "readonly")
        const request = tx.objectStore(STORE).get(key)
        request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
        request.onerror = () => reject(request.error)
      }),
  )
}

function currentDesign(): SessionDesign {
  const state = useTemplateStore.getState()
  return {
    template: state.template,
    guides: state.guides.filter((guide) => (guide.axis === "x" || guide.axis === "y") && Number.isFinite(guide.at)),
    selectedId: state.selectedId,
  }
}

function rememberDesign(design: SessionDesign): void {
  keep = true
  void putValue("design", design).catch(() => {
    useTemplateStore.getState().setStatus("This session could not be stored in the browser.")
  })
}

export function sessionWasRestored(): boolean {
  return keep
}

export async function restoreEditorSession(): Promise<void> {
  try {
    const design = await readValue<SessionDesign>("design")
    if (!design?.template || !validateTemplate(design.template).ok) return
    const guides = Array.isArray(design.guides) ? design.guides : []
    useTemplateStore.getState().restoreSession(design.template, guides, design.selectedId ?? null)
    keep = true
  } catch {
    useTemplateStore.getState().setStatus("The last editing session could not be restored.")
  }
}

export function rememberSessionFile(file: SessionFile): void {
  void putValue("file", file).catch(() => undefined)
}

export async function readSessionFile<T>(): Promise<T | null> {
  try {
    return await readValue<T>("file")
  } catch {
    return null
  }
}

export function startSessionKeep(): void {
  if (started) return
  started = true
  useTemplateStore.subscribe((state, previous) => {
    if (state.template === previous.template && state.guides === previous.guides && state.selectedId === previous.selectedId) return
    if (state.origin === "canvas" && state.historyIndex === previous.historyIndex && state.guides === previous.guides) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => rememberDesign(currentDesign()), 400)
  })
  const flush = () => {
    if (!keep) return
    window.clearTimeout(timer)
    timer = 0
    rememberDesign(currentDesign())
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
  window.addEventListener("pagehide", flush)
}
