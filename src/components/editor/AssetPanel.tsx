import { useState } from "react"
import {
  SAMPLE_BACKGROUNDS,
  SAMPLE_DECORATIONS,
  SAMPLE_PHOTOS,
  type EditorAsset,
} from "../../models/asset"
import { useTemplateStore } from "../../store/templateStore"

type AssetTab = "backgrounds" | "photos" | "decorations"

export function AssetPanel() {
  const [tab, setTab] = useState<AssetTab>("backgrounds")
  const background = useTemplateStore((state) => state.template.background)
  const selectedAssetId = useTemplateStore((state) => state.selectedAssetId)
  const setBackground = useTemplateStore((state) => state.setBackground)
  const applyBackgroundAsset = useTemplateStore((state) => state.applyBackgroundAsset)
  const applyPhotoAsset = useTemplateStore((state) => state.applyPhotoAsset)
  const applyDecorationAsset = useTemplateStore((state) => state.applyDecorationAsset)
  const setSelectedAsset = useTemplateStore((state) => state.setSelectedAsset)

  return (
    <aside className="flex w-[260px] min-w-[260px] flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Assets</h2>
      </div>
      <div className="grid grid-cols-3 border-b border-line">
        {([
          ["backgrounds", "Backgrounds"],
          ["photos", "Photos"],
          ["decorations", "Decorations"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-2 py-2 text-[11px] ${
              tab === id ? "bg-gold/10 text-gold-strong" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="editor-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "backgrounds" ? (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Color</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={background.type === "color" ? background.value : "#F5EFE6"}
                onChange={(event) => setBackground({ type: "color", value: event.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
              />
              {(
                [
                  ["Ivory", "#F5EFE6"],
                  ["Blush", "#F3D9D0"],
                  ["Peach", "#F4E1C1"],
                  ["Rose", "#E8C5C5"],
                ] as const
              ).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setBackground({ type: "color", value })}
                  className="rounded-md border border-line px-2 py-1 text-xs text-ink"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted">Image</p>
            <AssetGrid
              assets={SAMPLE_BACKGROUNDS}
              selectedId={background.type === "image" ? background.assetId : selectedAssetId}
              onSelect={applyBackgroundAsset}
            />
          </div>
        ) : null}

        {tab === "photos" ? (
          <AssetGrid
            assets={SAMPLE_PHOTOS}
            selectedId={selectedAssetId}
            onSelect={applyPhotoAsset}
            checkerboard
          />
        ) : null}

        {tab === "decorations" ? (
          <AssetGrid
            assets={SAMPLE_DECORATIONS}
            selectedId={selectedAssetId}
            onSelect={(asset) => {
              setSelectedAsset(asset.id)
              applyDecorationAsset(asset)
            }}
          />
        ) : null}
      </div>
    </aside>
  )
}

function AssetGrid({
  assets,
  selectedId,
  onSelect,
  checkerboard = false,
}: {
  assets: EditorAsset[]
  selectedId: string | null
  onSelect: (asset: EditorAsset) => void
  checkerboard?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          onClick={() => onSelect(asset)}
          className={`overflow-hidden rounded-md border text-left ${
            selectedId === asset.id ? "border-gold" : "border-line hover:border-gold/50"
          }`}
        >
          <div
            className={`flex aspect-[3/2] items-center justify-center ${
              checkerboard
                ? "bg-[repeating-conic-gradient(#3a332c_0_25%,#2a241f_0_50%)] bg-[length:12px_12px]"
                : "bg-[var(--ed-raised)]"
            }`}
          >
            <img
              src={asset.url}
              alt={asset.name}
              className={`h-full w-full ${checkerboard ? "object-contain p-1" : "object-cover"}`}
            />
          </div>
          <div className="px-2 py-1.5 text-[11px] text-ink">{asset.name}</div>
        </button>
      ))}
    </div>
  )
}
