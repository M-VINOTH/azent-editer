import { StaticCanvas } from "fabric"
import { EXPORT_MAX_WIDTH } from "../models/canvas"
import type { AlbumTemplate } from "../models/template"
import { paintWithoutCompare, renderTemplateOnCanvas } from "./canvasService"
import { exportTemplatePsd, psdExportService } from "./psdExportService"

export type { PSDExportService } from "./futureContracts"
export { exportTemplatePsd, psdExportService }

export async function exportTemplatePng(template: AlbumTemplate): Promise<Blob> {
  const scale = EXPORT_MAX_WIDTH / template.canvas.width
  const width = Math.round(template.canvas.width * scale)
  const height = Math.round(template.canvas.height * scale)

  const element = document.createElement("canvas")
  const canvas = new StaticCanvas(element, {
    width,
    height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  })
  canvas.setZoom(scale)

  await paintWithoutCompare(() => renderTemplateOnCanvas(canvas, template, { showGuides: false }))
  canvas.renderAll()

  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: 1,
    enableRetinaScaling: false,
  })

  canvas.dispose()

  const response = await fetch(dataUrl)
  return response.blob()
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "template"
}
