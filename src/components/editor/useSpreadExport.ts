import { useState } from "react"
import { downloadBlob, exportTemplatePng, exportTemplatePsd, slugify } from "../../services/exportService"
import { useTemplateStore } from "../../store/templateStore"

export function useSpreadExport() {
  const template = useTemplateStore((state) => state.template)
  const exportJson = useTemplateStore((state) => state.exportJson)
  const loadFromJson = useTemplateStore((state) => state.loadFromJson)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const [busy, setBusy] = useState<"png" | "psd" | "photoshop" | null>(null)

  const saveJson = () => {
    const blob = new Blob([exportJson()], { type: "application/json" })
    downloadBlob(blob, `${slugify(template.name)}.json`)
    setStatus("Saved template JSON")
  }

  const loadJson = async (file: File) => {
    try {
      const raw = await file.text()
      loadFromJson(raw)
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load template")
      return false
    }
  }

  const loadPsd = async (file: File) => {
    setBusy("psd")
    setStatus("Opening PSD…")
    try {
      const { importPsdFile } = await import("../../services/psdImportService")
      const template = await importPsdFile(file)
      useTemplateStore.getState().loadTemplate(
        template,
        template.elements.length > 0
          ? `Opened ${file.name} · ${template.elements.length} layers`
          : `Opened ${file.name}, but it had no layers to edit`,
      )
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open that PSD")
      return false
    } finally {
      setBusy(null)
    }
  }

  const exportPng = async () => {
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

  return { busy, saveJson, loadJson, loadPsd, exportPng, exportPsd, openInPhotoshop }
}
