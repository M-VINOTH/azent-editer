export type AssetKind = "background" | "decoration" | "photo"

export const PHOTO_DROP_TYPE = "application/x-azent-photo"

export interface EditorAsset {
  id: string
  name: string
  kind: AssetKind
  url: string
  thumbnailUrl?: string
}

export const SAMPLE_BACKGROUNDS: EditorAsset[] = [
  {
    id: "bg-cover-filigree",
    name: "Cover Filigree",
    kind: "background",
    url: "/assets/backgrounds/cover-filigree.jpg",
  },
  {
    id: "bg-studio-blush",
    name: "Studio Blush",
    kind: "background",
    url: "/assets/backgrounds/studio-blush.svg",
  },
  {
    id: "bg-luxury-beige",
    name: "Luxury Beige",
    kind: "background",
    url: "/assets/backgrounds/luxury-beige.jpg",
  },
  {
    id: "bg-luxury-gold",
    name: "Luxury Gold",
    kind: "background",
    url: "/assets/backgrounds/luxury-gold.jpg",
  },
  {
    id: "bg-floral",
    name: "Floral",
    kind: "background",
    url: "/assets/backgrounds/floral.jpg",
  },
]

export const STUDIO_BLUSH_THEME = {
  id: "studio-blush",
  background: {
    type: "image" as const,
    assetId: "bg-studio-blush",
    url: "/assets/backgrounds/studio-blush.svg",
    opacity: 1,
  },
  cutoutUrl: "/assets/photos/cutout-demo.svg",
}

export const SAMPLE_DECORATIONS: EditorAsset[] = [
  {
    id: "deco-cover-leaf",
    name: "Cover Leaf Spray",
    kind: "decoration",
    url: "/assets/decorations/cover-leaf-spray.png",
  },
  {
    id: "deco-cover-crimson",
    name: "Cover Crimson",
    kind: "decoration",
    url: "/assets/decorations/cover-crimson.svg",
  },
  {
    id: "deco-cover-squares",
    name: "Cover Squares",
    kind: "decoration",
    url: "/assets/decorations/cover-squares.svg",
  },
  {
    id: "deco-flower-01",
    name: "Flower 01",
    kind: "decoration",
    url: "/assets/decorations/flower-01.svg",
  },
  {
    id: "deco-flower-02",
    name: "Flower 02",
    kind: "decoration",
    url: "/assets/decorations/flower-02.svg",
  },
  {
    id: "deco-gold-corner",
    name: "Gold Floral Corner",
    kind: "decoration",
    url: "/assets/decorations/gold-corner.svg",
  },
  {
    id: "deco-mandala",
    name: "Mandala",
    kind: "decoration",
    url: "/assets/decorations/mandala.svg",
  },
  {
    id: "deco-watercolor",
    name: "Watercolor Blush",
    kind: "decoration",
    url: "/assets/decorations/watercolor-blush.svg",
  },
  {
    id: "deco-torn-paper",
    name: "Torn Paper",
    kind: "decoration",
    url: "/assets/decorations/torn-paper.svg",
  },
  {
    id: "deco-leaf-spray",
    name: "Leaf Spray",
    kind: "decoration",
    url: "/assets/decorations/leaf-spray.svg",
  },
  {
    id: "deco-soft-disc",
    name: "Soft Disc",
    kind: "decoration",
    url: "/assets/decorations/soft-disc.svg",
  },
  {
    id: "deco-soft-ring",
    name: "Soft Ring",
    kind: "decoration",
    url: "/assets/decorations/soft-ring.svg",
  },
  {
    id: "deco-floral-spray",
    name: "Floral Spray",
    kind: "decoration",
    url: "/assets/decorations/floral-spray.svg",
  },
  {
    id: "deco-page-mat",
    name: "Page Mat",
    kind: "decoration",
    url: "/assets/decorations/page-mat.svg",
  },
  {
    id: "deco-block-maroon",
    name: "Maroon Block",
    kind: "decoration",
    url: "/assets/decorations/block-maroon.svg",
  },
  {
    id: "deco-block-gold",
    name: "Gold Block",
    kind: "decoration",
    url: "/assets/decorations/block-gold.svg",
  },
  {
    id: "deco-block-sand",
    name: "Sand Block",
    kind: "decoration",
    url: "/assets/decorations/block-sand.svg",
  },
  {
    id: "deco-gold-rule",
    name: "Gold Rule",
    kind: "decoration",
    url: "/assets/decorations/gold-rule.svg",
  },
  {
    id: "deco-gold-medallion",
    name: "Gold Medallion",
    kind: "decoration",
    url: "/assets/decorations/gold-medallion.svg",
  },
]

export const SAMPLE_PHOTOS: EditorAsset[] = [
  {
    id: "photo-cover-portrait",
    name: "Cover Portrait",
    kind: "photo",
    url: "/assets/photos/cover-portrait.jpg",
  },
  {
    id: "photo-cover-engagement",
    name: "Cover Engagement",
    kind: "photo",
    url: "/assets/photos/cover-engagement.jpg",
  },
  {
    id: "photo-cover-couple",
    name: "Cover Couple",
    kind: "photo",
    url: "/assets/photos/cover-couple.jpg",
  },
  {
    id: "photo-cover-moment-a",
    name: "Cover Moment A",
    kind: "photo",
    url: "/assets/photos/cover-moment-a.jpg",
  },
  {
    id: "photo-cover-moment-b",
    name: "Cover Moment B",
    kind: "photo",
    url: "/assets/photos/cover-moment-b.jpg",
  },
  {
    id: "photo-sample-01",
    name: "Sample Photo 01",
    kind: "photo",
    url: "/assets/photos/sample-01.jpg",
  },
  {
    id: "photo-sample-02",
    name: "Sample Photo 02",
    kind: "photo",
    url: "/assets/photos/sample-02.jpg",
  },
  {
    id: "photo-sample-03",
    name: "Sample Photo 03",
    kind: "photo",
    url: "/assets/photos/sample-03.jpg",
  },
  {
    id: "photo-cutout-demo",
    name: "Cutout Demo",
    kind: "photo",
    url: "/assets/photos/cutout-demo.svg",
  },
]
