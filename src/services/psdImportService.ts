import { initializeCanvas, readPsd, type Color, type Layer } from "ag-psd"
import type { AlbumTemplate, BlendMode, PhotoElement, TemplateElement, TextElement } from "../models/template"
import { createId } from "../utils/geometry"

let canvasReady = false

function ensurePsdCanvas(): void {
  if (canvasReady) return
  initializeCanvas(
    (width, height) => {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, width)
      canvas.height = Math.max(1, height)
      return canvas
    },
    (width, height) => new ImageData(Math.max(1, width), Math.max(1, height)),
  )
  canvasReady = true
}

export async function importPsdFile(file: File): Promise<AlbumTemplate> {
  ensurePsdCanvas()
  const buffer = await file.arrayBuffer()
  const psd = readPsd(buffer, { skipCompositeImageData: true, skipThumbnail: true, skipLinkedFilesData: true })
  const elements: TemplateElement[] = []
  const order = { z: 1 }
  collectLayers(psd.children, elements, order)
  if (elements.length === 0 && psd.canvas && psd.canvas.width > 1) {
    elements.push(photoFromCanvas("Composite", psd.canvas, 0, 0, psd.canvas.width, psd.canvas.height, 1, 1))
  }
  const name = file.name.replace(/\.psd$/i, "") || "Imported PSD"
  return {
    id: createId("psd"),
    name,
    version: "1.0",
    canvas: {
      width: Math.max(1, psd.width),
      height: Math.max(1, psd.height),
      unit: "px",
      dpi: 300,
    },
    background: { type: "color", value: "#ffffff" },
    elements,
  }
}

function collectLayers(layers: Layer[] | undefined, into: TemplateElement[], order: { z: number }): void {
  if (!layers) return
  for (const layer of layers) {
    if (layer.hidden) continue
    if (layer.children?.length) {
      collectLayers(layer.children, into, order)
      continue
    }
    const element = layerElement(layer, order.z)
    if (!element) continue
    into.push(element)
    order.z += 1
  }
}

function layerElement(layer: Layer, zIndex: number): TemplateElement | null {
  const left = layer.left ?? 0
  const top = layer.top ?? 0
  const width = Math.max(0, (layer.right ?? left) - left)
  const height = Math.max(0, (layer.bottom ?? top) - top)
  const name = layer.name?.trim() || "Layer"
  if (layer.canvas && width >= 2 && height >= 2) {
    return photoFromCanvas(name, layer.canvas, left, top, width, height, opacityOf(layer.opacity), zIndex, blendOf(layer.blendMode))
  }
  const text = layer.text?.text?.replace(/\r/g, "\n").trim()
  if (text) return textElement(layer, text, left, top, width, height, zIndex)
  return null
}

function textElement(layer: Layer, text: string, left: number, top: number, width: number, height: number, zIndex: number): TextElement {
  const style = layer.text?.style
  const fontSize = style?.fontSize && style.fontSize > 0 ? style.fontSize : Math.max(48, height * 0.6)
  return {
    id: createId("text"),
    type: "text",
    x: left,
    y: top,
    width: Math.max(width, fontSize),
    height: Math.max(height, fontSize * 1.3),
    rotation: 0,
    zIndex,
    text,
    name: layer.name?.trim() || text,
    fontFamily: fontName(style?.font) ?? "Playfair Display",
    fontSize,
    fontWeight: style?.fauxBold ? "700" : "400",
    textAlign: "left",
    color: colorToHex(style?.fillColor),
  }
}

function photoFromCanvas(
  name: string,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
  zIndex: number,
  blendMode: BlendMode = "normal",
): PhotoElement {
  return {
    id: createId("photo"),
    type: "photo",
    name,
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    shape: "rectangle",
    imageUrl: canvasToPng(source),
    objectFit: "contain",
    opacity,
    blendMode,
    role: "cutout",
    shadow: false,
  }
}

function canvasToPng(source: HTMLCanvasElement): string {
  const maxEdge = 2200
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height, 1))
  if (scale >= 0.999) return source.toDataURL("image/png")
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, Math.round(source.width * scale))
  copy.height = Math.max(1, Math.round(source.height * scale))
  copy.getContext("2d")?.drawImage(source, 0, 0, copy.width, copy.height)
  return copy.toDataURL("image/png")
}

function opacityOf(opacity: number | undefined): number {
  if (opacity == null) return 1
  const value = opacity > 1 ? opacity / 255 : opacity
  return Math.max(0, Math.min(1, value))
}

function blendOf(mode: string | undefined): BlendMode {
  const normalized = mode?.toLowerCase().replace(/\s+/g, "-")
  if (normalized === "soft-light" || mode === "soft light") return "soft-light"
  if (normalized === "hard-light" || mode === "hard light") return "hard-light"
  if (normalized === "color-burn" || mode === "color burn") return "color-burn"
  if (normalized === "color-dodge" || mode === "color dodge") return "color-dodge"
  if (
    normalized === "darken" ||
    normalized === "multiply" ||
    normalized === "lighten" ||
    normalized === "screen" ||
    normalized === "overlay" ||
    normalized === "difference" ||
    normalized === "exclusion" ||
    normalized === "hue" ||
    normalized === "saturation" ||
    normalized === "color" ||
    normalized === "luminosity"
  ) {
    return normalized
  }
  return "normal"
}

function colorToHex(color: Color | undefined): string {
  if (!color) return "#1a1a1a"
  if ("r" in color) return hex(color.r, color.g, color.b)
  if ("fr" in color) return hex(color.fr, color.fg, color.fb)
  return "#1a1a1a"
}

function hex(r: number, g: number, b: number): string {
  const channel = (value: number) => {
    const byte = value <= 1 ? Math.round(value * 255) : Math.round(value)
    return Math.max(0, Math.min(255, byte)).toString(16).padStart(2, "0")
  }
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function fontName(font: { name?: string } | undefined): string | undefined {
  const name = font?.name?.trim()
  return name || undefined
}
