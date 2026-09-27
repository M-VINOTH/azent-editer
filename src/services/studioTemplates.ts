import type { AlbumTemplate } from "../models/template"
import { importPsdFile } from "./psdImportService"

const FILES = [
  "1.psd",
  "1 (1).psd",
  "1 (2).psd",
  "2.psd",
  "3.psd",
  "3 (1).psd",
  "4.psd",
  "4 (1).psd",
  "5.psd",
  "5 (1).psd",
  "6.psd",
  "7.psd",
  "7 (1).psd",
  "7 (2).psd",
  "07.psd",
  "8.psd",
  "8 (1).psd",
  "8 (2).psd",
  "9.psd",
  "10.psd",
  "10 (1).psd",
  "10 (2).psd",
  "14.psd",
  "15.psd",
  "18.psd",
  "19.psd",
]

export interface StudioTemplate {
  id: string
  name: string
  file: string
}

export const STUDIO_TEMPLATES: StudioTemplate[] = FILES.map((file) => ({
  id: `studio:${file}`,
  name: file.replace(/\.psd$/i, ""),
  file,
}))

export async function loadStudioTemplate(file: string): Promise<AlbumTemplate> {
  const entry = STUDIO_TEMPLATES.find((item) => item.file === file)
  const response = await fetch(`/templates/${encodeURIComponent(file)}`)
  if (!response.ok) throw new Error(`Could not open ${file}`)
  const blob = await response.blob()
  const psd = new File([blob], file, { type: "application/vnd.adobe.photoshop" })
  const template = await importPsdFile(psd)
  template.name = entry?.name ?? template.name
  template.recipeId = entry?.id ?? `studio:${file}`
  return template
}
