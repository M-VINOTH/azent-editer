import type { AlbumTemplate, TemplateElement } from "../models/template"
import { BLEND_MODES, PHOTO_ROLES, PHOTO_SHAPES, type LayerMask } from "../models/template"
import { PHOTO_GRADE_KEYS } from "./photoGrade"

const PHOTO_SHAPE_SET: ReadonlySet<string> = new Set(PHOTO_SHAPES)
const MASK_KINDS: ReadonlySet<string> = new Set(["rectangle", "rounded", "circle", "polygon", "path", "png"])
const BLEND_MODE_SET: ReadonlySet<string> = new Set(BLEND_MODES)
const PHOTO_ROLE_SET: ReadonlySet<string> = new Set(PHOTO_ROLES)

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

const ELEMENT_TYPES = new Set(["photo", "text", "decoration", "group"])

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function validateElement(element: TemplateElement, index: number): ValidationError[] {
  const errors: ValidationError[] = []
  const path = `elements[${index}]`

  if (!element || typeof element !== "object") {
    return [{ path, message: "Element must be an object." }]
  }

  if (typeof element.id !== "string" || element.id.trim() === "") {
    errors.push({ path: `${path}.id`, message: "Element id is required." })
  }

  if (!ELEMENT_TYPES.has(element.type)) {
    errors.push({
      path: `${path}.type`,
      message: "Element type must be photo, text, decoration, or group.",
    })
  }

  if (!isNumber(element.x)) {
    errors.push({ path: `${path}.x`, message: "x must be numeric." })
  }
  if (!isNumber(element.y)) {
    errors.push({ path: `${path}.y`, message: "y must be numeric." })
  }
  if (!isNumber(element.width) || element.width <= 0) {
    errors.push({ path: `${path}.width`, message: "width must be a positive number." })
  }
  if (!isNumber(element.height) || element.height <= 0) {
    errors.push({ path: `${path}.height`, message: "height must be a positive number." })
  }
  if (!isNumber(element.rotation)) {
    errors.push({ path: `${path}.rotation`, message: "rotation must be numeric." })
  }
  if (!isNumber(element.zIndex)) {
    errors.push({ path: `${path}.zIndex`, message: "zIndex must be numeric." })
  }
  if (element.name !== undefined && typeof element.name !== "string") {
    errors.push({ path: `${path}.name`, message: "name must be a string." })
  }
  if (element.parentId !== undefined && typeof element.parentId !== "string") {
    errors.push({ path: `${path}.parentId`, message: "parentId must be a string." })
  }
  if (element.locked !== undefined && typeof element.locked !== "boolean") {
    errors.push({ path: `${path}.locked`, message: "locked must be a boolean." })
  }
  if (element.type === "group" && typeof element.name !== "string") {
    errors.push({ path: `${path}.name`, message: "Group name is required." })
  }

  if (element.type === "photo") {
    if (!PHOTO_SHAPE_SET.has(element.shape)) {
      errors.push({ path: `${path}.shape`, message: "Photo shape is invalid." })
    }
    if (!["cover", "contain"].includes(element.objectFit)) {
      errors.push({ path: `${path}.objectFit`, message: "objectFit must be cover or contain." })
    }
    if (element.opacity !== undefined && (!isNumber(element.opacity) || element.opacity < 0 || element.opacity > 1)) {
      errors.push({ path: `${path}.opacity`, message: "opacity must be a number between 0 and 1." })
    }
    if (element.blendMode !== undefined && !BLEND_MODE_SET.has(element.blendMode)) {
      errors.push({ path: `${path}.blendMode`, message: "blendMode is invalid." })
    }
    if (element.role !== undefined && !PHOTO_ROLE_SET.has(element.role)) {
      errors.push({ path: `${path}.role`, message: "role must be slot, wash, or cutout." })
    }
    if (element.border) {
      if (!isNumber(element.border.width) || element.border.width < 0) {
        errors.push({ path: `${path}.border.width`, message: "border.width must be a number >= 0." })
      }
      if (typeof element.border.color !== "string") {
        errors.push({ path: `${path}.border.color`, message: "border.color is required." })
      }
    }
    if (element.sourceUrl !== undefined && typeof element.sourceUrl !== "string") {
      errors.push({ path: `${path}.sourceUrl`, message: "sourceUrl must be a string." })
    }
    if (element.shadow !== undefined && typeof element.shadow !== "boolean") {
      errors.push({ path: `${path}.shadow`, message: "shadow must be a boolean." })
    }
    if (element.panX !== undefined && !isNumber(element.panX)) {
      errors.push({ path: `${path}.panX`, message: "panX must be numeric." })
    }
    if (element.panY !== undefined && !isNumber(element.panY)) {
      errors.push({ path: `${path}.panY`, message: "panY must be numeric." })
    }
    if (element.photoScale !== undefined && (!isNumber(element.photoScale) || element.photoScale <= 0)) {
      errors.push({ path: `${path}.photoScale`, message: "photoScale must be a number greater than 0." })
    }
    if (element.flipX !== undefined && typeof element.flipX !== "boolean") {
      errors.push({ path: `${path}.flipX`, message: "flipX must be a boolean." })
    }
    if (element.flipY !== undefined && typeof element.flipY !== "boolean") {
      errors.push({ path: `${path}.flipY`, message: "flipY must be a boolean." })
    }
    for (const key of ["brightness", "contrast", "saturate", "blur", ...PHOTO_GRADE_KEYS] as const) {
      if (element[key] !== undefined && !isNumber(element[key])) {
        errors.push({ path: `${path}.${key}`, message: `${key} must be numeric.` })
      }
    }
    errors.push(...validateMaskFields(element.mask, element.clipping, path))
  }

  if (element.type === "text") {
    if (typeof element.text !== "string") {
      errors.push({ path: `${path}.text`, message: "Text content is required." })
    }
    if (element.flipX !== undefined && typeof element.flipX !== "boolean") {
      errors.push({ path: `${path}.flipX`, message: "flipX must be a boolean." })
    }
    if (element.flipY !== undefined && typeof element.flipY !== "boolean") {
      errors.push({ path: `${path}.flipY`, message: "flipY must be a boolean." })
    }
    if (!isNumber(element.fontSize) || element.fontSize <= 0) {
      errors.push({ path: `${path}.fontSize`, message: "fontSize must be a positive number." })
    }
    errors.push(...validateMaskFields(element.mask, element.clipping, path))
  }

  if (element.type === "decoration") {
    if (typeof element.assetUrl !== "string" || element.assetUrl.trim() === "") {
      errors.push({ path: `${path}.assetUrl`, message: "Decoration assetUrl is required." })
    }
    if (!isNumber(element.opacity) || element.opacity < 0 || element.opacity > 1) {
      errors.push({ path: `${path}.opacity`, message: "opacity must be a number between 0 and 1." })
    }
    if (element.blendMode !== undefined && !BLEND_MODE_SET.has(element.blendMode)) {
      errors.push({ path: `${path}.blendMode`, message: "blendMode is invalid." })
    }
    if (element.flipX !== undefined && typeof element.flipX !== "boolean") {
      errors.push({ path: `${path}.flipX`, message: "flipX must be a boolean." })
    }
    if (element.flipY !== undefined && typeof element.flipY !== "boolean") {
      errors.push({ path: `${path}.flipY`, message: "flipY must be a boolean." })
    }
    if (element.shape !== undefined && !PHOTO_SHAPE_SET.has(element.shape)) {
      errors.push({ path: `${path}.shape`, message: "Shape is invalid." })
    }
    if (element.fill !== undefined && typeof element.fill !== "string") {
      errors.push({ path: `${path}.fill`, message: "fill must be a string." })
    }
    errors.push(...validateMaskFields(element.mask, element.clipping, path))
  }

  return errors
}

function validateMaskFields(mask: LayerMask | undefined, clipping: boolean | undefined, path: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (clipping !== undefined && typeof clipping !== "boolean") {
    errors.push({ path: `${path}.clipping`, message: "clipping must be a boolean." })
  }
  if (mask === undefined) return errors
  if (!mask || typeof mask !== "object") {
    return [...errors, { path: `${path}.mask`, message: "mask must be an object." }]
  }
  if (!MASK_KINDS.has(mask.kind)) {
    errors.push({ path: `${path}.mask.kind`, message: "mask kind is invalid." })
  }
  for (const key of ["x", "y", "width", "height", "rotation", "feather"] as const) {
    if (!isNumber(mask[key])) errors.push({ path: `${path}.mask.${key}`, message: `${key} must be numeric.` })
  }
  if (isNumber(mask.width) && mask.width <= 0) errors.push({ path: `${path}.mask.width`, message: "mask width must be positive." })
  if (isNumber(mask.height) && mask.height <= 0) errors.push({ path: `${path}.mask.height`, message: "mask height must be positive." })
  if (typeof mask.inverted !== "boolean") errors.push({ path: `${path}.mask.inverted`, message: "inverted must be a boolean." })
  if (mask.cornerRadius !== undefined && !isNumber(mask.cornerRadius)) {
    errors.push({ path: `${path}.mask.cornerRadius`, message: "cornerRadius must be numeric." })
  }
  if (mask.smooth !== undefined && typeof mask.smooth !== "boolean") {
    errors.push({ path: `${path}.mask.smooth`, message: "smooth must be a boolean." })
  }
  if (mask.imageUrl !== undefined && typeof mask.imageUrl !== "string") {
    errors.push({ path: `${path}.mask.imageUrl`, message: "imageUrl must be a string." })
  }
  if (mask.points !== undefined) {
    if (!Array.isArray(mask.points)) errors.push({ path: `${path}.mask.points`, message: "points must be a list." })
    else {
      mask.points.forEach((point, index) => {
        if (!point || !isNumber(point.x) || !isNumber(point.y)) {
          errors.push({ path: `${path}.mask.points[${index}]`, message: "Each mask point needs numeric x and y." })
        }
      })
    }
  }
  return errors
}

export function validateTemplate(template: AlbumTemplate): ValidationResult {
  const errors: ValidationError[] = []

  if (!template || typeof template !== "object") {
    return { ok: false, errors: [{ path: "template", message: "Template JSON is invalid." }] }
  }

  if (typeof template.id !== "string" || template.id.trim() === "") {
    errors.push({ path: "id", message: "Template id is required." })
  }
  if (typeof template.name !== "string" || template.name.trim() === "") {
    errors.push({ path: "name", message: "Template name is required." })
  }
  if (typeof template.version !== "string" || template.version.trim() === "") {
    errors.push({ path: "version", message: "Template version is required." })
  }

  if (!template.canvas) {
    errors.push({ path: "canvas", message: "Canvas dimensions are required." })
  } else {
    if (!isNumber(template.canvas.width) || template.canvas.width <= 0) {
      errors.push({ path: "canvas.width", message: "Canvas width is required and must be positive." })
    }
    if (!isNumber(template.canvas.height) || template.canvas.height <= 0) {
      errors.push({ path: "canvas.height", message: "Canvas height is required and must be positive." })
    }
    if (!isNumber(template.canvas.dpi) || template.canvas.dpi <= 0) {
      errors.push({ path: "canvas.dpi", message: "Canvas dpi is required and must be positive." })
    }
  }

  if (!template.background || typeof template.background !== "object") {
    errors.push({ path: "background", message: "Background is required." })
  } else if (template.background.type === "color") {
    if (typeof template.background.value !== "string") {
      errors.push({ path: "background.value", message: "Background color value is required." })
    }
  } else if (template.background.type === "image") {
    if (typeof template.background.url !== "string" || template.background.url.trim() === "") {
      errors.push({ path: "background.url", message: "Background image url is required." })
    }
  } else if (template.background.type !== "transparent") {
    errors.push({ path: "background.type", message: "Background type must be color, image, or transparent." })
  }

  if (template.themeId !== undefined && (typeof template.themeId !== "string" || template.themeId.trim() === "")) {
    errors.push({ path: "themeId", message: "themeId must be a non-empty string when present." })
  }

  if (!Array.isArray(template.elements)) {
    errors.push({ path: "elements", message: "elements must be an array." })
    return { ok: errors.length === 0, errors }
  }

  const ids = new Set<string>()
  template.elements.forEach((element, index) => {
    errors.push(...validateElement(element, index))
    if (typeof element?.id === "string") {
      if (ids.has(element.id)) {
        errors.push({
          path: `elements[${index}].id`,
          message: `Duplicate element id "${element.id}".`,
        })
      }
      ids.add(element.id)
    }
  })

  return { ok: errors.length === 0, errors }
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("\n")
}
