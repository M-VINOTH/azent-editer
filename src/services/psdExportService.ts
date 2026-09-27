import type { Layer, Psd } from "ag-psd"
import {
  ALBUM_WIDTH_IN,
  EXPORT_MAX_WIDTH,
} from "../models/canvas"
import type {
  AlbumTemplate,
  Background,
  DecorationElement,
  PhotoElement,
  TemplateElement,
  TextElement,
} from "../models/template"
import { sortByZIndex } from "../utils/geometry"
import { loadHtmlImage, rasterizePhotoElement } from "../utils/photoRaster"
import { toCanvasBlendMode, toPsdBlendMode } from "../utils/photoShape"
import { withLayerMask } from "../utils/layerMask"
import type { PSDExportService } from "./futureContracts"

export type { PSDExportService }

interface RasterLayer {
  name: string
  canvas: HTMLCanvasElement
  left: number
  top: number
  opacity: number
  blendMode?: string
  clipping?: boolean
}

function exportMetrics(template: AlbumTemplate) {
  const scale = EXPORT_MAX_WIDTH / template.canvas.width
  return {
    scale,
    width: Math.round(template.canvas.width * scale),
    height: Math.round(template.canvas.height * scale),
    ppi: Math.round(EXPORT_MAX_WIDTH / ALBUM_WIDTH_IN),
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not create a 2D canvas context for PSD export.")
  return ctx
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return loadHtmlImage(url)
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  boxW: number,
  boxH: number,
  nativeW: number,
  nativeH: number,
  fit: "cover" | "contain",
): void {
  const scale =
    fit === "contain" ? Math.min(boxW / nativeW, boxH / nativeH) : Math.max(boxW / nativeW, boxH / nativeH)
  const drawW = nativeW * scale
  const drawH = nativeH * scale
  ctx.drawImage(image, (boxW - drawW) / 2, (boxH - drawH) / 2, drawW, drawH)
}

function applyRotation(
  source: HTMLCanvasElement,
  rotation: number,
): { canvas: HTMLCanvasElement; shiftX: number; shiftY: number } {
  if (!rotation) return { canvas: source, shiftX: 0, shiftY: 0 }

  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const width = Math.ceil(source.width * cos + source.height * sin)
  const height = Math.ceil(source.width * sin + source.height * cos)
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)
  ctx.translate(width / 2, height / 2)
  ctx.rotate(rad)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return {
    canvas,
    shiftX: (width - source.width) / 2,
    shiftY: (height - source.height) / 2,
  }
}

function layerFromRaster(
  name: string,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  rotation: number,
  opacity = 1,
  blendMode?: string,
  clipping = false,
): RasterLayer {
  const { canvas, shiftX, shiftY } = applyRotation(source, rotation)
  return {
    name,
    canvas,
    left: Math.round(x - shiftX),
    top: Math.round(y - shiftY),
    opacity,
    blendMode,
    clipping,
  }
}

async function rasterBackground(
  background: Background,
  width: number,
  height: number,
): Promise<RasterLayer> {
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)
  ctx.clearRect(0, 0, width, height)
  if (background.type === "transparent") {
    return { name: "BACKGROUND", canvas, left: 0, top: 0, opacity: 0 }
  }
  ctx.fillStyle = background.type === "color" ? background.value : "#F5EFE6"
  ctx.fillRect(0, 0, width, height)

  if (background.type === "image") {
    try {
      const image = await loadImage(background.url)
      ctx.globalAlpha = background.opacity ?? 1
      drawFittedImage(ctx, image, width, height, image.naturalWidth, image.naturalHeight, "cover")
      ctx.globalAlpha = 1
    } catch {
      // keep the beige fallback
    }
  }

  return { name: "BACKGROUND", canvas, left: 0, top: 0, opacity: 1 }
}

async function rasterPhoto(element: PhotoElement, scale: number): Promise<RasterLayer> {
  const width = Math.max(1, Math.round(element.width * scale))
  const height = Math.max(1, Math.round(element.height * scale))
  let image: HTMLImageElement | null = null
  if (element.imageUrl) {
    try {
      image = await loadImage(element.imageUrl)
    } catch {
      image = null
    }
  }
  const canvas = rasterizePhotoElement(element, image, width, height)
  await withLayerMask(canvas, element)
  const role = element.role === "wash" ? "WASH" : element.role === "cutout" ? "CUTOUT" : "PHOTO"
  return layerFromRaster(
    `${role} / ${element.id}`,
    canvas,
    element.x * scale,
    element.y * scale,
    element.rotation,
    element.opacity ?? 1,
    element.blendMode,
    Boolean(element.clipping),
  )
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split("\n")
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push("")
      continue
    }
    let current = words[0]
    for (const word of words.slice(1)) {
      const next = `${current} ${word}`
      if (ctx.measureText(next).width <= maxWidth) current = next
      else {
        lines.push(current)
        current = word
      }
    }
    lines.push(current)
  }
  return lines
}

async function rasterText(element: TextElement, scale: number): Promise<RasterLayer> {
  const width = Math.max(1, Math.round(element.width * scale))
  const height = Math.max(1, Math.round(element.height * scale))
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)
  const fontSize = Math.max(8, element.fontSize * scale)
  ctx.fillStyle = element.color
  ctx.font = `${element.fontWeight} ${fontSize}px ${element.fontFamily}, serif`
  ctx.textAlign = element.textAlign
  ctx.textBaseline = "middle"

  const pad = Math.max(4, fontSize * 0.1)
  const lines = wrapLines(ctx, element.text, width - pad * 2)
  const lineHeight = fontSize * 1.2
  const blockHeight = lines.length * lineHeight
  const startY = (height - blockHeight) / 2 + lineHeight / 2
  const x =
    element.textAlign === "left" ? pad : element.textAlign === "right" ? width - pad : width / 2

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight)
  })
  await withLayerMask(canvas, element)

  const label = element.text.trim().slice(0, 40) || element.id
  return layerFromRaster(
    `TEXT / ${label}`,
    canvas,
    element.x * scale,
    element.y * scale,
    element.rotation,
    1,
    undefined,
    Boolean(element.clipping),
  )
}

async function rasterDecoration(element: DecorationElement, scale: number): Promise<RasterLayer> {
  const width = Math.max(1, Math.round(element.width * scale))
  const height = Math.max(1, Math.round(element.height * scale))
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)

  try {
    const image = await loadImage(element.assetUrl)
    ctx.drawImage(image, 0, 0, width, height)
  } catch {
    ctx.fillStyle = "rgba(196, 165, 116, 0.25)"
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  await withLayerMask(canvas, element)

  return layerFromRaster(
    `DECORATION / ${element.assetId || element.id}`,
    canvas,
    element.x * scale,
    element.y * scale,
    element.rotation,
    element.opacity,
    element.blendMode,
    Boolean(element.clipping),
  )
}

async function rasterElement(element: TemplateElement, scale: number): Promise<RasterLayer | null> {
  if (element.type === "group") return null
  if (element.type === "photo") return rasterPhoto(element, scale)
  if (element.type === "text") return rasterText(element, scale)
  return rasterDecoration(element, scale)
}

function toPsdLayer(layer: RasterLayer): Layer {
  return {
    name: layer.name,
    blendMode: toPsdBlendMode(layer.blendMode),
    opacity: layer.opacity,
    hidden: false,
    clipping: Boolean(layer.clipping),
    left: layer.left,
    top: layer.top,
    right: layer.left + layer.canvas.width,
    bottom: layer.top + layer.canvas.height,
    canvas: layer.canvas,
  }
}

function composite(width: number, height: number, layers: RasterLayer[]): HTMLCanvasElement {
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)
  for (const layer of layers) {
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.globalCompositeOperation = toCanvasBlendMode(layer.blendMode)
    ctx.drawImage(layer.canvas, layer.left, layer.top)
    ctx.restore()
  }
  return canvas
}

/**
 * Builds a layered PSD from AlbumTemplate JSON.
 * Coordinates stay in the 12000×6000 design space internally; the PSD is a
 * high-quality scaled document (same scale as PNG preview) with print size 12×36 in.
 */
export async function exportTemplatePsd(template: AlbumTemplate): Promise<Blob> {
  const { scale, width, height, ppi } = exportMetrics(template)
  const layers: RasterLayer[] = [await rasterBackground(template.background, width, height)]

  for (const element of sortByZIndex(template.elements, "asc")) {
    const layer = await rasterElement(element, scale)
    if (layer) layers.push(layer)
  }

  const psd: Psd = {
    width,
    height,
    channels: 3,
    bitsPerChannel: 8,
    children: layers.map(toPsdLayer),
    canvas: composite(width, height, layers),
    imageResources: {
      resolutionInfo: {
        horizontalResolution: ppi,
        horizontalResolutionUnit: "PPI",
        widthUnit: "Inches",
        verticalResolution: ppi,
        verticalResolutionUnit: "PPI",
        heightUnit: "Inches",
      },
    },
  }

  const { writePsd } = await import("ag-psd")
  const buffer = writePsd(psd, { trimImageData: true })
  return new Blob([new Uint8Array(buffer)], { type: "image/vnd.adobe.photoshop" })
}

export const psdExportService: PSDExportService = {
  exportPsd: (templateJson) => exportTemplatePsd(templateJson as AlbumTemplate),
}
