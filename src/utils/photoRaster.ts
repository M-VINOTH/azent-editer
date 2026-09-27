import type { PhotoElement } from "../models/template"
import { clipPhotoShape, polaroidInsets } from "./photoShape"

export function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${url}`))
    image.src = url
  })
}

function photoFilter(element: PhotoElement): string {
  const brightness = element.brightness ?? 0
  const contrast = element.contrast ?? 0
  const saturate = element.saturate ?? 0
  const blur = element.blur ?? 0
  if (!brightness && !contrast && !saturate && !blur) return "none"
  return `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturate}%) blur(${Math.max(0, blur)}px)`
}

function clipRadius(element: PhotoElement, width: number, height: number): number {
  if (element.shape !== "arch") return cornerRadius(element, width, height)
  const scale = width / Math.max(element.width, 1)
  if (element.cornerRadius == null) return Math.min(width / 2, height * 0.38)
  return Math.min(width / 2, Math.max(0, element.cornerRadius * scale))
}

function cornerRadius(element: PhotoElement, width: number, height: number): number {
  if (element.shape === "circle" || element.shape === "oval") return Math.min(width, height) / 2
  const source = element.cornerRadius ?? Math.min(element.width, element.height) * 0.08
  return Math.min(source * (width / Math.max(element.width, 1)), width / 2, height / 2)
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  fit: "cover" | "contain",
  panX = 0,
  panY = 0,
  flipX = false,
  flipY = false,
  photoScale = 1,
): void {
  const scale =
    (fit === "contain"
      ? Math.min(boxW / image.naturalWidth, boxH / image.naturalHeight)
      : Math.max(boxW / image.naturalWidth, boxH / image.naturalHeight)) * photoScale
  const drawW = image.naturalWidth * scale
  const drawH = image.naturalHeight * scale
  const limitX = Math.abs(drawW - boxW) / 2
  const limitY = Math.abs(drawH - boxH) / 2
  const dx = boxX + (boxW - drawW) / 2 + Math.min(limitX, Math.max(-limitX, panX))
  const dy = boxY + (boxH - drawH) / 2 + Math.min(limitY, Math.max(-limitY, panY))
  ctx.save()
  ctx.translate(boxX + boxW / 2, boxY + boxH / 2)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.translate(-(boxX + boxW / 2), -(boxY + boxH / 2))
  ctx.drawImage(image, dx, dy, drawW, drawH)
  ctx.restore()
}

function drawPlaceholderLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#8a7a68"
  ctx.font = `600 ${Math.max(18, Math.min(width, height) * 0.08)}px Inter, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("PHOTO SLOT", x + width / 2, y + height / 2)
}

function drawCutoutPlaceholder(
  ctx: CanvasRenderingContext2D,
  element: PhotoElement,
  width: number,
  height: number,
): void {
  clipPhotoShape(ctx, element.shape, width, height, clipRadius(element, width, height))
  ctx.strokeStyle = "rgba(255,255,255,0.72)"
  ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.012)
  ctx.setLineDash([Math.max(10, width * 0.03), Math.max(8, width * 0.018)])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "rgba(42,33,24,0.55)"
  ctx.font = `600 ${Math.max(18, Math.min(width, height) * 0.07)}px Inter, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("CUTOUT", width / 2, height / 2)
}

function fillClippedPhoto(
  ctx: CanvasRenderingContext2D,
  element: PhotoElement,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  showLabel: boolean,
  hidePicture = false,
): void {
  const isCutout = element.role === "cutout"
  const radius = clipRadius(element, width, height)
  const clipShape = element.shape === "polaroid" ? "rectangle" : element.shape
  const roundFrame = element.shape === "circle" || element.shape === "oval"
  const borderWidth =
    element.border && element.border.width > 0
      ? Math.max(1, element.border.width * (width / Math.max(element.width, 1)))
      : 0
  const frameInset = roundFrame ? (borderWidth > 0 ? borderWidth / 2 + 1 : 1) : 0

  ctx.save()
  ctx.translate(x, y)
  clipPhotoShape(ctx, clipShape, width, height, radius, frameInset)
  ctx.clip()
  if (!isCutout) {
    ctx.fillStyle = element.role === "wash" ? "rgba(245,239,230,0.2)" : "#ddd2c3"
    ctx.fillRect(0, 0, width, height)
  }
  if (image && !hidePicture) {
    const panX = ((element.panX ?? 0) * width) / Math.max(element.width, 1)
    const panY = ((element.panY ?? 0) * height) / Math.max(element.height, 1)
    ctx.filter = photoFilter(element)
    drawFittedImage(
      ctx,
      image,
      0,
      0,
      width,
      height,
      isCutout ? (element.objectFit ?? "contain") : element.objectFit,
      panX,
      panY,
      element.flipX,
      element.flipY,
      element.photoScale ?? 1,
    )
    ctx.filter = "none"
  } else if (!hidePicture && showLabel && element.role !== "wash" && !isCutout) {
    ctx.fillStyle = "#efe6d8"
    ctx.fillRect(0, 0, width, height)
    drawPlaceholderLabel(ctx, 0, 0, width, height)
  }
  ctx.restore()

  if (isCutout && !image && !hidePicture) {
    ctx.save()
    ctx.translate(x, y)
    drawCutoutPlaceholder(ctx, element, width, height)
    ctx.restore()
  }

  if (element.role !== "wash" && borderWidth > 0 && element.shape !== "polaroid" && element.border) {
    ctx.save()
    ctx.translate(x, y)
    clipPhotoShape(ctx, element.shape, width, height, radius, frameInset)
    ctx.strokeStyle = element.border.color
    ctx.lineWidth = borderWidth
    ctx.stroke()
    ctx.restore()
  }
}

export function rasterizePhotoElement(
  element: PhotoElement,
  image: HTMLImageElement | null,
  pixelWidth: number,
  pixelHeight: number,
  hidePicture = false,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(pixelWidth))
  canvas.height = Math.max(1, Math.round(pixelHeight))
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  const width = canvas.width
  const height = canvas.height
  const showLabel = element.role !== "wash" && element.role !== "cutout"

  if (element.role === "cutout") {
    fillClippedPhoto(ctx, element, image, 0, 0, width, height, showLabel, hidePicture)
    return canvas
  }

  if (element.shape === "polaroid") {
    const radius = Math.min(width, height) * 0.035
    ctx.fillStyle = "#fbf7f1"
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, radius)
    ctx.fill()
    const inset = polaroidInsets(width, height)
    fillClippedPhoto(
      ctx,
      { ...element, shape: "rectangle" },
      image,
      inset.left,
      inset.top,
      width - inset.left - inset.right,
      height - inset.top - inset.bottom,
      showLabel,
      hidePicture,
    )
    return canvas
  }

  fillClippedPhoto(ctx, element, image, 0, 0, width, height, showLabel, hidePicture)
  return canvas
}
