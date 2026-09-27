export const DESIGN_WIDTH = 12000
export const DESIGN_HEIGHT = 6000
export const DESIGN_DPI = 300
export const ALBUM_WIDTH_IN = 36
export const ALBUM_HEIGHT_IN = 12
export const CANVAS_UNIT = "px" as const

export const EXPORT_MAX_WIDTH = 4800

export interface DesignRect {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface ViewportScale {
  scale: number
  width: number
  height: number
}
