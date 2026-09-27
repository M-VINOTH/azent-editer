export interface CanvasSpec {
  width: number
  height: number
  unit: "px"
  dpi: number
}

export interface ColorBackground {
  type: "color"
  value: string
}

export interface ImageBackground {
  type: "image"
  assetId: string
  url: string
  opacity?: number
}

export interface TransparentBackground {
  type: "transparent"
}

export type Background = ColorBackground | ImageBackground | TransparentBackground

export const PHOTO_SHAPES = [
  "rectangle",
  "rounded",
  "circle",
  "oval",
  "arch",
  "polaroid",
  "organic",
  "diagonal-left",
  "diagonal-right",
] as const

export type PhotoShape = (typeof PHOTO_SHAPES)[number]

export const BLEND_MODES = [
  "normal",
  "darken",
  "multiply",
  "color-burn",
  "lighten",
  "screen",
  "color-dodge",
  "overlay",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const

export type BlendMode = (typeof BLEND_MODES)[number]

export interface MaskPoint {
  x: number
  y: number
}

export type MaskKind = "rectangle" | "rounded" | "circle" | "polygon" | "path" | "png"

/** A mask clips the layer. Its box is in the layer's own coordinates. */
export interface LayerMask {
  kind: MaskKind
  /** Polygon and path points, from 0 to 1 inside the mask box. */
  points?: MaskPoint[]
  /** Path points join with a smooth curve. Polygon points stay straight. */
  smooth?: boolean
  cornerRadius?: number
  imageUrl?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  feather: number
  inverted: boolean
}
export type ObjectFit = "cover" | "contain"
export type TextAlign = "left" | "center" | "right"
export const PHOTO_ROLES = ["slot", "wash", "cutout"] as const
export type PhotoRole = (typeof PHOTO_ROLES)[number]

export interface PhotoBorder {
  width: number
  color: string
}

export interface PhotoElement {
  id: string
  type: "photo"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  /** Label from an imported file, when the layer already has a name. */
  name?: string
  /** Set when this layer is nested inside another layer. */
  parentId?: string
  /** A locked layer stays where it is until it is unlocked. */
  locked?: boolean
  shape: PhotoShape
  cornerRadius?: number
  imageUrl?: string
  /** Original photo, kept so a manual selection can restore pixels the automatic cut removed. */
  sourceUrl?: string
  objectFit: ObjectFit
  opacity?: number
  blendMode?: BlendMode
  role?: PhotoRole
  border?: PhotoBorder
  /** Flat print frames skip the editor drop shadow. */
  shadow?: boolean
  /** Slide the photo inside the frame, in design pixels. */
  panX?: number
  panY?: number
  /** Scale of the picture inside the frame. 1 matches the frame. */
  photoScale?: number
  flipX?: boolean
  flipY?: boolean
  /** Tone controls, in percent points around 0. Blur is in pixels. */
  brightness?: number
  exposure?: number
  contrast?: number
  highlights?: number
  shadows?: number
  saturate?: number
  vibrance?: number
  /** White balance. Temperature warms or cools. Tint shifts green or magenta. */
  temperature?: number
  tint?: number
  sharpness?: number
  blur?: number
  vignette?: number
  /** Curves, as lifts for the shadow, midtone, and highlight ranges. */
  curveShadows?: number
  curveMidtones?: number
  curveHighlights?: number
  /** Levels. Black and white pull the endpoints in. Gamma bends the middle. */
  levelsBlack?: number
  levelsGamma?: number
  levelsWhite?: number
  /** HSL hue rotation, in degrees. */
  hue?: number
  /** Color balance for the midtones. */
  balanceCyanRed?: number
  balanceMagentaGreen?: number
  balanceYellowBlue?: number
  /** Softens fine grain. */
  noise?: number
  mask?: LayerMask
  /** Clip this layer to the artwork of the layer below it. */
  clipping?: boolean
}

export interface TextElement {
  id: string
  type: "text"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  name?: string
  parentId?: string
  locked?: boolean
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  textAlign: TextAlign
  color: string
  flipX?: boolean
  flipY?: boolean
  mask?: LayerMask
  clipping?: boolean
}

export interface DecorationElement {
  id: string
  type: "decoration"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  name?: string
  parentId?: string
  locked?: boolean
  assetId: string
  assetUrl: string
  /** Set on shape layers so the frame can be changed after it is placed. */
  shape?: PhotoShape
  fill?: string
  opacity: number
  blendMode?: BlendMode
  flipX?: boolean
  flipY?: boolean
  mask?: LayerMask
  clipping?: boolean
}

export interface GroupElement {
  id: string
  type: "group"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  name: string
  parentId?: string
  locked?: boolean
}

export type TemplateElement = PhotoElement | TextElement | DecorationElement | GroupElement
export type TemplateElementType = TemplateElement["type"]

export interface EditSheet {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface AlbumTemplate {
  id: string
  name: string
  version: string
  canvas: CanvasSpec
  background: Background
  elements: TemplateElement[]
  /** Scratch sheets beside the album. Layers can be dragged here and back onto the frame. */
  boards?: EditSheet[]
  recipeId?: string
  themeId?: string
}

export const FONT_OPTIONS = [
  "Playfair Display",
  "Cormorant Garamond",
  "Great Vibes",
  "Georgia",
  "Times New Roman",
  "Inter",
] as const

export const FONT_WEIGHTS = ["400", "500", "600", "700"] as const

export const PHOTO_SHAPE_LABELS: Record<PhotoShape, string> = {
  rectangle: "Rectangle",
  rounded: "Rounded",
  circle: "Circle",
  oval: "Oval",
  arch: "Arch",
  polaroid: "Polaroid",
  organic: "Organic",
  "diagonal-left": "Diagonal Left",
  "diagonal-right": "Diagonal Right",
}

export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  normal: "Normal",
  darken: "Darken",
  multiply: "Multiply",
  "color-burn": "Color Burn",
  lighten: "Lighten",
  screen: "Screen",
  "color-dodge": "Color Dodge",
  overlay: "Overlay",
  "soft-light": "Soft Light",
  "hard-light": "Hard Light",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity",
}

export const PHOTO_ROLE_LABELS: Record<PhotoRole, string> = {
  slot: "Slot",
  wash: "Wash",
  cutout: "Cutout",
}
