import type { EditorAsset } from "../models/asset"
import {
  ALBUM_HEIGHT_IN,
  ALBUM_WIDTH_IN,
  CANVAS_UNIT,
  DESIGN_DPI,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
} from "../models/canvas"
import type {
  AlbumTemplate,
  DecorationElement,
  PhotoElement,
  TemplateElement,
  TextElement,
} from "../models/template"
import { createId } from "../utils/geometry"
import { validateTemplate } from "../utils/validation"
import { buildLayoutRecipe, getRecipeMeta } from "./layoutRecipes"

export interface GenerateTemplateOptions {
  albumSize: "12x36"
  recipeId: string
}

export function cloneTemplate(template: AlbumTemplate): AlbumTemplate {
  return structuredClone(template)
}

export function getSampleTemplate(): AlbumTemplate {
  return createEmptyTemplate("Untitled")
}

export function createEmptyTemplate(
  name = "Untitled",
  canvas?: { width: number; height: number; dpi: number },
): AlbumTemplate {
  return {
    id: createId("template"),
    name,
    version: "1.0",
    canvas: {
      width: Math.max(1, Math.round(canvas?.width ?? DESIGN_WIDTH)),
      height: Math.max(1, Math.round(canvas?.height ?? DESIGN_HEIGHT)),
      unit: CANVAS_UNIT,
      dpi: Math.max(1, Math.round(canvas?.dpi ?? DESIGN_DPI)),
    },
    background: {
      type: "transparent",
    },
    elements: [],
  }
}

export type {
  AlbumStoryService,
  LayoutGenerationService,
  PhotoAnalysisService,
  QualityAnalysisService,
  TemplateRecommendationService,
} from "./futureContracts"

export function serializeTemplate(template: AlbumTemplate): string {
  return JSON.stringify(template, null, 2)
}

export function parseTemplateJson(raw: string): AlbumTemplate {
  const parsed = JSON.parse(raw) as AlbumTemplate
  const result = validateTemplate(parsed)
  if (!result.ok) {
    throw new Error(result.errors.map((error) => `${error.path}: ${error.message}`).join("\n"))
  }
  return parsed
}

/**
 * Deterministic layout generator. Understands geometry, assets, typography,
 * composition and layers only. Photo AI / decisioning is intentionally absent.
 */
export function generateTemplate(options: GenerateTemplateOptions): AlbumTemplate {
  const template = buildLayoutRecipe(options.recipeId)
  const recipe = getRecipeMeta(options.recipeId)
  template.name = recipe.name
  const result = validateTemplate(template)
  if (!result.ok) {
    throw new Error("Generated template failed validation.")
  }
  return template
}

export function createPhotoElement(zIndex: number): PhotoElement {
  return {
    id: createId("photo"),
    type: "photo",
    x: 4400,
    y: 1800,
    width: 3200,
    height: 2400,
    rotation: 0,
    zIndex,
    shape: "rectangle",
    objectFit: "cover",
    opacity: 1,
    blendMode: "normal",
    role: "slot",
  }
}

export function createTextElement(zIndex: number): TextElement {
  return {
    id: createId("text"),
    type: "text",
    x: 4000,
    y: 2600,
    width: 4000,
    height: 520,
    rotation: 0,
    zIndex,
    text: "Our Wedding",
    fontFamily: "Playfair Display",
    fontSize: 220,
    fontWeight: "600",
    textAlign: "center",
    color: "#6B4F3A",
  }
}

export function createDecorationElement(asset: EditorAsset, zIndex: number): DecorationElement {
  return {
    id: createId("deco"),
    type: "decoration",
    x: 200,
    y: 200,
    width: 1600,
    height: 1600,
    rotation: 0,
    zIndex,
    assetId: asset.id,
    assetUrl: asset.url,
    opacity: 1,
  }
}

export function duplicateElement(element: TemplateElement, zIndex: number): TemplateElement {
  return {
    ...cloneTemplate({ elements: [element] } as AlbumTemplate).elements[0],
    id: createId(element.type),
    x: element.x + 180,
    y: element.y + 180,
    zIndex,
  }
}

export function albumSizeLabel(): string {
  return `${ALBUM_HEIGHT_IN} × ${ALBUM_WIDTH_IN} in`
}
