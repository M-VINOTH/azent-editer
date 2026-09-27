import { SAMPLE_DECORATIONS, SAMPLE_PHOTOS, STUDIO_BLUSH_THEME } from "../models/asset"
import {
  CANVAS_UNIT,
  DESIGN_DPI,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
} from "../models/canvas"
import type {
  AlbumTemplate,
  Background,
  BlendMode,
  DecorationElement,
  PhotoElement,
  TemplateElement,
  TextElement,
} from "../models/template"
import { createId } from "../utils/geometry"

export interface LayoutRecipeMeta {
  id: string
  name: string
  description: string
  photoCount: number
  style: string
}

export const LAYOUT_RECIPES: LayoutRecipeMeta[] = [
  {
    id: "wedding-cover",
    name: "Wedding Cover",
    description: "12×36 crimson filigree cover with portrait, oval, and a three-photo cluster",
    photoCount: 5,
    style: "Wedding Cover",
  },
  {
    id: "hero-left",
    name: "Hero Left",
    description: "Large left portrait with two supporting slots",
    photoCount: 3,
    style: "Luxury Wedding",
  },
  {
    id: "hero-right",
    name: "Hero Right",
    description: "Mirrored cinematic hero on the right page",
    photoCount: 3,
    style: "Luxury Wedding",
  },
  {
    id: "couple-split",
    name: "Couple Split",
    description: "Two portraits across the fold with circle insets",
    photoCount: 5,
    style: "Candid",
  },
  {
    id: "family-grid",
    name: "Family Grid",
    description: "Hero plus a stack of family frames",
    photoCount: 4,
    style: "Classic",
  },
  {
    id: "haldi-collage",
    name: "Haldi Collage",
    description: "Organic mask, polaroid and ritual cluster",
    photoCount: 5,
    style: "Traditional",
  },
  {
    id: "circle-cluster",
    name: "Circle Cluster",
    description: "Oval hero with circular supporting portraits",
    photoCount: 4,
    style: "Romantic",
  },
  {
    id: "polaroid-stack",
    name: "Polaroid Stack",
    description: "Tilted polaroids over a faded wash",
    photoCount: 4,
    style: "Playful",
  },
  {
    id: "diagonal-cinematic",
    name: "Diagonal Cinematic",
    description: "Slanted split panels and small circles",
    photoCount: 4,
    style: "Cinematic",
  },
  {
    id: "portrait-wash",
    name: "Portrait Wash",
    description: "Faded background photo with a framed portrait",
    photoCount: 3,
    style: "Editorial",
  },
  {
    id: "reception-triptych",
    name: "Reception Triptych",
    description: "Three vertical panels with an oval inset",
    photoCount: 4,
    style: "Reception",
  },
  {
    id: "studio-hero",
    name: "Studio Hero",
    description: "Cut-out subject on a shared studio backdrop with overlays in front",
    photoCount: 1,
    style: "Studio Composite",
  },
  {
    id: "studio-circle",
    name: "Studio Circle",
    description: "Same studio theme, circular cut-out with a white ring",
    photoCount: 1,
    style: "Studio Composite",
  },
  {
    id: "ceremony-spread",
    name: "Ceremony Spread",
    description: "Color-block 12×36 album sheet with gold frames and captions",
    photoCount: 6,
    style: "Album PSD",
  },
  {
    id: "just-married",
    name: "Just Married",
    description: "Cut-out couple on curtains and marigolds, with two round portraits",
    photoCount: 4,
    style: "Wedding Spread",
  },
]

const W = DESIGN_WIDTH
const H = DESIGN_HEIGHT

function samplePhoto(index: number): string {
  const photos = SAMPLE_PHOTOS.filter((photo) => !photo.id.includes("cutout"))
  return photos[index % photos.length].url
}

function deco(
  id: string,
  assetIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<DecorationElement> = {},
): DecorationElement {
  const asset = SAMPLE_DECORATIONS[assetIndex % SAMPLE_DECORATIONS.length]
  return {
    id,
    type: "decoration",
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: 22,
    assetId: asset.id,
    assetUrl: asset.url,
    opacity: 0.9,
    ...extra,
  }
}

function decoById(
  id: string,
  assetId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<DecorationElement> = {},
): DecorationElement {
  const asset = SAMPLE_DECORATIONS.find((item) => item.id === assetId) ?? SAMPLE_DECORATIONS[0]
  return deco(id, 0, x, y, width, height, {
    assetId: asset.id,
    assetUrl: asset.url,
    ...extra,
  })
}

function caption(id: string, text: string, x: number, y: number, width: number, extra: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height: extra.height ?? 420,
    rotation: 0,
    zIndex: 30,
    text,
    fontFamily: extra.fontFamily ?? "Great Vibes",
    fontSize: extra.fontSize ?? 220,
    fontWeight: extra.fontWeight ?? "400",
    textAlign: extra.textAlign ?? "center",
    color: extra.color ?? "#6B4F3A",
    ...extra,
  }
}

function slot(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<PhotoElement> = {},
): PhotoElement {
  const photoIndex = Number(id.replace(/\D/g, "")) || 1
  return {
    id,
    type: "photo",
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: extra.role === "wash" ? 1 : 10,
    shape: extra.shape ?? "rectangle",
    objectFit: "cover",
    opacity: extra.role === "wash" ? 0.22 : 1,
    blendMode: extra.role === "wash" ? "multiply" : "normal",
    role: extra.role ?? "slot",
    imageUrl: extra.imageUrl ?? samplePhoto(Math.max(0, photoIndex - 1)),
    ...extra,
  }
}

function cutout(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<PhotoElement> = {},
): PhotoElement {
  return slot(id, x, y, width, height, {
    role: "cutout",
    objectFit: "contain",
    opacity: 1,
    blendMode: "normal",
    imageUrl: STUDIO_BLUSH_THEME.cutoutUrl,
    zIndex: 10,
    ...extra,
  })
}

function wash(imageIndex = 0, extra: Partial<PhotoElement> = {}): PhotoElement {
  return slot("photo-wash", 0, 0, W, H, {
    role: "wash",
    zIndex: 1,
    opacity: 0.2,
    blendMode: "multiply",
    imageUrl: samplePhoto(imageIndex),
    ...extra,
  })
}

function template(
  recipe: LayoutRecipeMeta,
  background: string | Background,
  elements: TemplateElement[],
  themeId?: string,
): AlbumTemplate {
  return {
    id: createId(recipe.id),
    name: recipe.name,
    version: "1.0",
    recipeId: recipe.id,
    themeId,
    canvas: {
      width: W,
      height: H,
      unit: CANVAS_UNIT,
      dpi: DESIGN_DPI,
    },
    background: typeof background === "string" ? { type: "color", value: background } : background,
    elements,
  }
}

function heroLeft(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[1]
  return template(recipe, "#F5EFE6", [
    slot("photo-01", 400, 400, 5600, 5200, { zIndex: 10, border: { width: 36, color: "#FBF7F1" } }),
    slot("photo-02", 6200, 400, 5400, 2480, { zIndex: 11, shape: "rounded", cornerRadius: 180 }),
    slot("photo-03", 6200, 3080, 5400, 1680, { zIndex: 12 }),
    deco("deco-01", 2, 10480, 120, 1400, 1400),
    caption("text-title", "Our Wedding", 6200, 4920, 5400, {
      fontFamily: "Playfair Display",
      fontSize: 280,
      fontWeight: "600",
      height: 680,
    }),
  ])
}

function heroRight(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[2]
  return template(recipe, "#F3D9D0", [
    slot("photo-01", 6000, 400, 5600, 5200, { zIndex: 10, border: { width: 36, color: "#FBF7F1" } }),
    slot("photo-02", 400, 400, 5400, 2480, { zIndex: 11, shape: "rounded", cornerRadius: 180 }),
    slot("photo-03", 400, 3080, 5400, 1680, { zIndex: 12 }),
    deco("deco-01", 2, 120, 120, 1400, 1400, { rotation: -90 }),
    caption("text-title", "Our Wedding", 400, 4920, 5400, {
      fontFamily: "Playfair Display",
      fontSize: 280,
      fontWeight: "600",
      height: 680,
    }),
  ])
}

function coupleSplit(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[3]
  return template(recipe, "#F6E4DA", [
    wash(0),
    slot("photo-01", 180, 280, 5720, 5440, {
      zIndex: 10,
      shape: "rounded",
      cornerRadius: 80,
      border: { width: 28, color: "#FFFFFF" },
    }),
    slot("photo-02", 6100, 280, 5720, 5440, {
      zIndex: 11,
      shape: "rounded",
      cornerRadius: 80,
      border: { width: 28, color: "#FFFFFF" },
    }),
    slot("photo-03", 4780, 1680, 1680, 1680, { zIndex: 16, shape: "circle", border: { width: 40, color: "#FFFFFF" } }),
    slot("photo-04", 5540, 3720, 1320, 1320, { zIndex: 17, shape: "circle", border: { width: 32, color: "#FFFFFF" } }),
    slot("photo-05", 9800, 4280, 1500, 1500, { zIndex: 18, shape: "oval", border: { width: 28, color: "#FFFFFF" } }),
    deco("deco-01", 1, 80, 4360, 1600, 1600, { opacity: 0.7, blendMode: "multiply" as BlendMode }),
    caption("text-title", "Beautiful Memories", 3600, 5340, 4800, { fontSize: 200, height: 400 }),
  ])
}

function familyGrid(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[4]
  return template(recipe, "#F5EFE6", [
    wash(1, { opacity: 0.14 }),
    slot("photo-01", 280, 280, 7200, 5440, { zIndex: 10, border: { width: 32, color: "#FFFFFF" } }),
    slot("photo-02", 7680, 280, 4040, 1680, { zIndex: 11, shape: "rounded", cornerRadius: 120 }),
    slot("photo-03", 7680, 2160, 4040, 1680, { zIndex: 12 }),
    slot("photo-04", 7680, 4040, 4040, 1680, { zIndex: 13, shape: "rounded", cornerRadius: 120 }),
    deco("deco-01", 2, 80, 80, 1200, 1200),
    caption("text-title", "Together", 280, 5480, 2400, {
      fontFamily: "Cormorant Garamond",
      fontSize: 180,
      fontWeight: "600",
      textAlign: "left",
      height: 320,
    }),
  ])
}

function haldiCollage(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[5]
  return template(recipe, "#F4E1C1", [
    wash(2, { opacity: 0.16, blendMode: "soft-light" }),
    slot("photo-01", 220, 360, 6200, 5280, { zIndex: 10, shape: "organic" }),
    slot("photo-02", 6280, 280, 2680, 2480, { zIndex: 11, shape: "rounded", cornerRadius: 80 }),
    slot("photo-03", 9160, 280, 2560, 2480, { zIndex: 12 }),
    slot("photo-04", 6280, 3000, 2680, 2680, { zIndex: 13, shape: "polaroid", rotation: -4 }),
    slot("photo-05", 9160, 3180, 2520, 1960, {
      zIndex: 14,
      border: { width: 28, color: "#FFFFFF" },
    }),
    deco("deco-01", 0, 80, 80, 1500, 1500, { opacity: 0.75 }),
    deco("deco-02", 3, 10400, 4600, 1400, 1400, { opacity: 0.55, blendMode: "multiply" as BlendMode }),
    caption("text-title", "Memorable Moments", 6280, 5480, 5400, {
      fontFamily: "Cormorant Garamond",
      fontSize: 160,
      fontWeight: "600",
      height: 320,
    }),
  ])
}

function circleCluster(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[6]
  return template(recipe, "#F7E8E2", [
    wash(0, { opacity: 0.18 }),
    slot("photo-01", 480, 480, 6200, 5040, { zIndex: 10, shape: "oval", border: { width: 36, color: "#FFFFFF" } }),
    slot("photo-02", 7040, 360, 2200, 2200, { zIndex: 12, shape: "circle", border: { width: 40, color: "#FFFFFF" } }),
    slot("photo-03", 9400, 1200, 2280, 2280, { zIndex: 13, shape: "circle", border: { width: 40, color: "#FFFFFF" } }),
    slot("photo-04", 7480, 3360, 2400, 2400, { zIndex: 14, shape: "circle", border: { width: 40, color: "#FFFFFF" } }),
    deco("deco-01", 1, 10200, 80, 1700, 1700, { opacity: 0.8 }),
    caption("text-title", "Our Wedding", 7040, 5400, 4600, { fontSize: 210, height: 380 }),
  ])
}

function polaroidStack(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[7]
  return template(recipe, "#EFE6D8", [
    wash(1, { opacity: 0.24 }),
    slot("photo-01", 620, 640, 2680, 3360, { zIndex: 11, shape: "polaroid", rotation: -8 }),
    slot("photo-02", 3180, 980, 2680, 3360, { zIndex: 12, shape: "polaroid", rotation: 3 }),
    slot("photo-03", 5860, 560, 2800, 3520, { zIndex: 13, shape: "polaroid", rotation: -2 }),
    slot("photo-04", 8520, 1120, 2680, 3360, { zIndex: 14, shape: "polaroid", rotation: 6 }),
    deco("deco-01", 0, 80, 4200, 1800, 1800, { opacity: 0.65 }),
    caption("text-title", "Beautiful Memories", 2000, 5080, 8000, { fontSize: 240, height: 480 }),
  ])
}

function diagonalCinematic(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[8]
  return template(recipe, "#F3D9D0", [
    wash(2, { opacity: 0.12 }),
    slot("photo-01", 0, 0, 7400, 6000, { zIndex: 10, shape: "diagonal-left" }),
    slot("photo-02", 5600, 0, 6400, 6000, { zIndex: 11, shape: "diagonal-right" }),
    slot("photo-03", 4960, 3720, 1480, 1480, { zIndex: 16, shape: "circle", border: { width: 36, color: "#FFFFFF" } }),
    slot("photo-04", 9800, 420, 1680, 1680, { zIndex: 17, shape: "circle", border: { width: 36, color: "#FFFFFF" } }),
    caption("text-title", "Our Story", 7800, 5200, 3600, {
      fontFamily: "Playfair Display",
      fontSize: 200,
      fontWeight: "600",
      height: 400,
    }),
  ])
}

function portraitWash(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[9]
  return template(recipe, "#F4D5D8", [
    wash(0, { opacity: 0.28, blendMode: "multiply" }),
    slot("photo-01", 6200, 0, 5800, 6000, { zIndex: 8 }),
    slot("photo-02", 720, 920, 2680, 3360, {
      zIndex: 12,
      shape: "rectangle",
      border: { width: 48, color: "#FFFFFF" },
    }),
    slot("photo-03", 1680, 3960, 1880, 1320, {
      zIndex: 13,
      shape: "rounded",
      cornerRadius: 40,
      border: { width: 20, color: "#FFFFFF" },
    }),
    deco("deco-01", 2, 80, 80, 1400, 1400, { opacity: 0.7 }),
    caption("text-kicker", "Wedding ceremony", 720, 420, 3200, {
      fontFamily: "Playfair Display",
      fontSize: 140,
      fontWeight: "600",
      textAlign: "left",
      height: 280,
    }),
    caption("text-title", "Ila & Rajnish", 720, 5320, 4000, {
      fontSize: 260,
      textAlign: "left",
      height: 420,
    }),
  ])
}

function receptionTriptych(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[10]
  return template(recipe, "#F7EEE4", [
    wash(1, { opacity: 0.1 }),
    slot("photo-01", 240, 240, 3760, 5520, { zIndex: 10, shape: "arch" }),
    slot("photo-02", 4120, 240, 3760, 5520, { zIndex: 11 }),
    slot("photo-03", 8000, 240, 3760, 5520, { zIndex: 12, shape: "arch" }),
    slot("photo-04", 5080, 1960, 1840, 2320, {
      zIndex: 18,
      shape: "oval",
      border: { width: 44, color: "#FFFFFF" },
    }),
    deco("deco-01", 1, 80, 80, 1200, 1200, { opacity: 0.6 }),
    caption("text-title", "Reception", 4120, 5480, 3760, {
      fontFamily: "Cormorant Garamond",
      fontSize: 170,
      fontWeight: "600",
      height: 300,
    }),
  ])
}

function studioHero(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[11]
  return template(
    recipe,
    STUDIO_BLUSH_THEME.background,
    [
      decoById("deco-disc-a", "deco-soft-disc", 720, 520, 2400, 2400, {
        zIndex: 3,
        opacity: 0.55,
        blendMode: "screen",
      }),
      decoById("deco-disc-b", "deco-soft-disc", 8200, 280, 3000, 3000, {
        zIndex: 4,
        opacity: 0.5,
        blendMode: "soft-light",
      }),
      decoById("deco-ring-a", "deco-soft-ring", 4300, 1680, 2000, 2000, {
        zIndex: 5,
        opacity: 0.45,
        blendMode: "screen",
      }),
      cutout("photo-01", 3900, 720, 4200, 4600, { zIndex: 10 }),
      decoById("deco-floral", "deco-floral-spray", 200, 3180, 11600, 2500, { zIndex: 20, opacity: 0.95 }),
      decoById("deco-mat", "deco-page-mat", 0, 0, W, H, { zIndex: 28, opacity: 1 }),
      caption("text-title", "Little Moments", 3000, 5200, 6000, {
        fontSize: 220,
        color: "#7A4454",
        height: 420,
        zIndex: 30,
      }),
    ],
    STUDIO_BLUSH_THEME.id,
  )
}

function studioCircle(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[12]
  return template(
    recipe,
    STUDIO_BLUSH_THEME.background,
    [
      decoById("deco-disc-a", "deco-soft-disc", 480, 360, 2200, 2200, {
        zIndex: 3,
        opacity: 0.5,
        blendMode: "screen",
      }),
      decoById("deco-disc-b", "deco-soft-disc", 9400, 280, 2200, 2200, {
        zIndex: 4,
        opacity: 0.42,
        blendMode: "soft-light",
      }),
      decoById("deco-ring-a", "deco-soft-ring", 1800, 1400, 1600, 1600, {
        zIndex: 5,
        opacity: 0.4,
        blendMode: "screen",
      }),
      cutout("photo-01", 3300, 420, 5400, 5400, {
        zIndex: 10,
        shape: "circle",
        border: { width: 120, color: "#FFFFFF" },
      }),
      decoById("deco-floral", "deco-floral-spray", 1600, 4560, 8800, 1400, { zIndex: 20, opacity: 0.9 }),
      decoById("deco-mat", "deco-page-mat", 0, 0, W, H, { zIndex: 28, opacity: 1 }),
      caption("text-title", "Little Moments", 3000, 5280, 6000, {
        fontSize: 200,
        color: "#7A4454",
        height: 380,
        zIndex: 30,
      }),
    ],
    STUDIO_BLUSH_THEME.id,
  )
}

const GOLD_FRAME = { width: 40, color: "#C9A36A" }
const WHITE_MAT = { width: 72, color: "#FBF7F1" }

function ceremonySpread(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES[13]
  return template(recipe, "#F6EBDD", [
    decoById("deco-maroon", "deco-block-maroon", 0, 0, 2280, H, { zIndex: 2, opacity: 1 }),
    decoById("deco-sand", "deco-block-sand", 1680, 0, 4320, H, { zIndex: 3, opacity: 1 }),
    decoById("deco-gold-bar", "deco-block-gold", 5880, 0, 120, H, { zIndex: 4, opacity: 1 }),
    decoById("deco-rule-a", "deco-gold-rule", 2100, 720, 3200, 36, { zIndex: 8, opacity: 0.95 }),
    decoById("deco-rule-b", "deco-gold-rule", 2100, 5240, 3200, 36, { zIndex: 8, opacity: 0.95 }),
    decoById("deco-medallion", "deco-gold-medallion", 10940, 200, 780, 780, { zIndex: 17, opacity: 0.9 }),
    decoById("deco-corner", "deco-gold-corner", 120, 120, 980, 980, { zIndex: 9, opacity: 0.8 }),
    slot("photo-01", 2100, 900, 3480, 4200, {
      zIndex: 12,
      border: WHITE_MAT,
    }),
    slot("photo-02", 240, 400, 1640, 1400, {
      zIndex: 13,
      shape: "rounded",
      cornerRadius: 40,
      border: GOLD_FRAME,
    }),
    slot("photo-06", 240, 4200, 1640, 1400, {
      zIndex: 13,
      shape: "rounded",
      cornerRadius: 40,
      border: GOLD_FRAME,
    }),
    slot("photo-03", 6360, 240, 5400, 3920, {
      zIndex: 12,
      border: GOLD_FRAME,
    }),
    slot("photo-04", 10080, 4280, 1480, 1480, {
      zIndex: 16,
      shape: "circle",
      border: { width: 48, color: "#FBF7F1" },
    }),
    slot("photo-05", 6360, 4320, 1760, 1440, {
      zIndex: 13,
      shape: "rounded",
      cornerRadius: 48,
      border: GOLD_FRAME,
    }),
    decoById("deco-leaf", "deco-leaf-spray", 10480, 4680, 1400, 1200, {
      zIndex: 18,
      opacity: 0.7,
      rotation: 18,
    }),
    caption("text-vert", "Wedding", 120, 2480, 1880, {
      fontFamily: "Great Vibes",
      fontSize: 220,
      color: "#F6EBDD",
      textAlign: "center",
      height: 400,
      rotation: -90,
      zIndex: 20,
    }),
    caption("text-kicker", "WEDDING CEREMONY", 8280, 4240, 1680, {
      fontFamily: "Playfair Display",
      fontSize: 96,
      fontWeight: "600",
      textAlign: "left",
      color: "#6B4F3A",
      height: 180,
      zIndex: 20,
    }),
    caption("text-title", "Ceremony Moments", 8280, 4420, 1680, {
      fontSize: 170,
      textAlign: "left",
      color: "#6B4F3A",
      height: 320,
      zIndex: 21,
    }),
  ])
}

const COVER_W = 10800
const COVER_H = 3600
const COVER_FRAME = { width: 36, color: "#FFFFFF" }

function weddingCover(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES.find((item) => item.id === "wedding-cover") ?? LAYOUT_RECIPES[0]
  const layout = template(
    recipe,
    {
      type: "image",
      assetId: "bg-cover-filigree",
      url: "/assets/backgrounds/cover-filigree.jpg",
      opacity: 1,
    },
    [
      decoById("deco-wash", "deco-cover-crimson", 5399, 402, 5401, 2812, { zIndex: 2, opacity: 0.47 }),
      slot("photo-01", 0, 0, 2192, COVER_H, {
        zIndex: 10,
        imageUrl: "/assets/photos/cover-portrait.jpg",
        shadow: false,
      }),
      slot("photo-02", 2912, 323, 1777, 2722, {
        zIndex: 11,
        shape: "oval",
        border: COVER_FRAME,
        imageUrl: "/assets/photos/cover-engagement.jpg",
        shadow: false,
      }),
      slot("photo-03", 5399, 531, 3027, 2571, {
        zIndex: 12,
        border: COVER_FRAME,
        imageUrl: "/assets/photos/cover-couple.jpg",
        shadow: false,
      }),
      slot("photo-04", 8485, 531, 2152, 1254, {
        zIndex: 13,
        border: COVER_FRAME,
        imageUrl: "/assets/photos/cover-moment-a.jpg",
        shadow: false,
      }),
      slot("photo-05", 8485, 1834, 2152, 1254, {
        zIndex: 14,
        border: COVER_FRAME,
        imageUrl: "/assets/photos/cover-moment-b.jpg",
        shadow: false,
      }),
      decoById("deco-love-tab", "deco-cover-crimson", 0, 0, 186, 515, { zIndex: 20, opacity: 1 }),
      decoById("deco-footer", "deco-cover-crimson", 0, 3166, 5401, 276, { zIndex: 20, opacity: 1 }),
      decoById("deco-oval-cap", "deco-cover-crimson", 2912, 0, 1777, 219, { zIndex: 20, opacity: 1 }),
      decoById("deco-engagement-tab", "deco-cover-crimson", 2400, 1011, 186, 1220, { zIndex: 21, opacity: 1 }),
      decoById("deco-quote-rule", "deco-cover-crimson", 4604, 608, 168, 1623, { zIndex: 22, opacity: 1 }),
      decoById("deco-top-rule", "deco-cover-crimson", 5399, 0, 4783, 130, { zIndex: 20, opacity: 1 }),
      decoById("deco-bottom-rule", "deco-cover-crimson", 6232, 3408, 3846, 192, { zIndex: 20, opacity: 1 }),
      decoById("deco-mark-a", "deco-cover-crimson", 5426, 208, 92, 104, { zIndex: 23, opacity: 1 }),
      decoById("deco-mark-b", "deco-cover-crimson", 5837, 208, 118, 104, { zIndex: 23, opacity: 1 }),
      decoById("deco-leaf", "deco-cover-leaf", 2304, 0, 437, 687, { zIndex: 24, opacity: 1 }),
      decoById("deco-squares", "deco-cover-squares", 4952, 3260, 366, 81, { zIndex: 25, opacity: 1 }),
      caption("text-love", "love", -80, 177, 340, {
        fontFamily: "Playfair Display",
        fontSize: 118,
        fontWeight: "600",
        color: "#FFFFFF",
        height: 120,
        rotation: 90,
        zIndex: 30,
      }),
      caption("text-engagement", "Engagement", 1891, 1543, 1200, {
        fontFamily: "Playfair Display",
        fontSize: 132,
        fontWeight: "600",
        color: "#FFFFFF",
        height: 160,
        rotation: 90,
        zIndex: 30,
      }),
      caption("text-wedding", "WEDDING", 620, 3196, 760, {
        fontFamily: "Playfair Display",
        fontSize: 108,
        fontWeight: "600",
        color: "#FFFFFF",
        textAlign: "left",
        height: 130,
        zIndex: 30,
      }),
      caption("text-caption", "The family is growing…happier! Congrats, Hannah and Ethan!", 132, 3336, 2200, {
        fontFamily: "Cormorant Garamond",
        fontSize: 42,
        fontWeight: "600",
        color: "#FFFFFF",
        textAlign: "left",
        height: 64,
        zIndex: 30,
      }),
      caption("text-title", "HAPPY MOMENTS", 5480, 196, 1400, {
        fontFamily: "Playfair Display",
        fontSize: 78,
        fontWeight: "600",
        color: "#1A1A1A",
        textAlign: "left",
        height: 110,
        zIndex: 30,
      }),
      caption(
        "text-quote",
        "We are not perfect, we learn from our mistakes. And as long as it takes, I will prove my love to you.",
        3558,
        1626,
        2800,
        {
          fontFamily: "Cormorant Garamond",
          fontSize: 52,
          fontWeight: "600",
          color: "#1A1A1A",
          height: 140,
          rotation: 90,
          zIndex: 30,
        },
      ),
    ],
    "wedding-cover",
  )
  layout.canvas = {
    width: COVER_W,
    height: COVER_H,
    unit: "px",
    dpi: 300,
  }
  layout.name = "Wedding Cover"
  return layout
}

const SPREAD_W = 10800
const SPREAD_H = 3600

function justMarried(): AlbumTemplate {
  const recipe = LAYOUT_RECIPES.find((item) => item.id === "just-married") ?? LAYOUT_RECIPES[0]
  const liftW = Math.round(3400 * (570 / 893))
  const groomW = Math.round(3460 * (565 / 951))
  const layout = template(recipe, "#F7F1EA", [
    slot("photo-wash", 0, 0, SPREAD_W, SPREAD_H, {
      role: "wash",
      zIndex: 1,
      opacity: 1,
      blendMode: "normal",
      shadow: false,
      imageUrl: "/assets/photos/just-married/background.jpg",
    }),
    cutout("photo-lift", 60, 200, liftW, 3400, {
      imageUrl: "/assets/photos/just-married/lift.png",
      zIndex: 8,
    }),
    cutout("photo-groom", SPREAD_W - groomW - 220, 70, groomW, 3460, {
      imageUrl: "/assets/photos/just-married/groom.png",
      zIndex: 9,
    }),
    slot("photo-stairs", 3180, 460, 1860, 1860, {
      shape: "circle",
      zIndex: 12,
      border: { width: 54, color: "#FFFFFF" },
      shadow: true,
      imageUrl: "/assets/photos/just-married/stairs.jpg",
    }),
    slot("photo-pillar", 4520, 1720, 1280, 1280, {
      shape: "circle",
      zIndex: 14,
      border: { width: 46, color: "#FFFFFF" },
      shadow: true,
      imageUrl: "/assets/photos/just-married/pillar.jpg",
    }),
    caption("text-title", "just married", 1960, 160, 1900, {
      fontFamily: "Great Vibes",
      fontSize: 200,
      height: 260,
      color: "#2a2a2a",
      zIndex: 20,
    }),
    caption("text-note", "together, always", 1960, 410, 1900, {
      fontFamily: "Cormorant Garamond",
      fontSize: 48,
      fontWeight: "400",
      height: 80,
      color: "#5c534c",
      zIndex: 20,
    }),
    caption("text-forever", "forever", 6480, 1280, 1400, {
      fontFamily: "Playfair Display",
      fontSize: 78,
      fontWeight: "600",
      height: 120,
      color: "#FFF6EE",
      rotation: -90,
      zIndex: 16,
    }),
  ])
  layout.canvas = {
    width: SPREAD_W,
    height: SPREAD_H,
    unit: "px",
    dpi: 300,
  }
  layout.name = "Just Married"
  return layout
}

const BUILDERS: Record<string, () => AlbumTemplate> = {
  "wedding-cover": weddingCover,
  "hero-left": heroLeft,
  "hero-right": heroRight,
  "couple-split": coupleSplit,
  "family-grid": familyGrid,
  "haldi-collage": haldiCollage,
  "circle-cluster": circleCluster,
  "polaroid-stack": polaroidStack,
  "diagonal-cinematic": diagonalCinematic,
  "portrait-wash": portraitWash,
  "reception-triptych": receptionTriptych,
  "studio-hero": studioHero,
  "studio-circle": studioCircle,
  "ceremony-spread": ceremonySpread,
  "just-married": justMarried,
}

export function buildLayoutRecipe(recipeId: string): AlbumTemplate {
  const builder = BUILDERS[recipeId] ?? heroLeft
  return builder()
}

export function getRecipeMeta(recipeId: string): LayoutRecipeMeta {
  return LAYOUT_RECIPES.find((recipe) => recipe.id === recipeId) ?? LAYOUT_RECIPES[0]
}
