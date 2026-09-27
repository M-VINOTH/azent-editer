import { useEffect, useRef, useState } from "react"
import { LAYOUT_RECIPES } from "../../services/layoutRecipes"
import type { GenerateTemplateOptions } from "../../services/templateService"
import { albumSizeLabel } from "../../services/templateService"
import { useTemplateStore } from "../../store/templateStore"

export function TemplateHeader() {
  const template = useTemplateStore((state) => state.template)
  const setTemplateName = useTemplateStore((state) => state.setTemplateName)
  const generate = useTemplateStore((state) => state.generate)
  const [showGenerate, setShowGenerate] = useState(false)
  const [recipeId, setRecipeId] = useState(template.recipeId ?? "ceremony-spread")

  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-panel px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gold/15 text-sm font-semibold text-gold">
          A
        </div>
        <div className="min-w-0">
          <input
            value={template.name}
            onChange={(event) => setTemplateName(event.target.value)}
            className="w-[280px] max-w-full truncate bg-transparent text-sm font-medium tracking-wide text-ink outline-none"
          />
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            JSON source of truth · POC-02
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-line px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
          {albumSizeLabel()} · {template.canvas.width}×{template.canvas.height} · {template.canvas.dpi} dpi
        </span>
        <button
          type="button"
          onClick={() => setShowGenerate(true)}
          className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold tracking-wide text-[#2a2118] hover:bg-gold-strong"
        >
          Generate Template
        </button>
      </div>

      {showGenerate ? (
        <GenerateDialog
          recipeId={recipeId}
          onRecipeId={setRecipeId}
          onClose={() => setShowGenerate(false)}
          onGenerate={(options) => {
            generate(options)
            setShowGenerate(false)
          }}
        />
      ) : null}
    </header>
  )
}

function GenerateDialog({
  recipeId,
  onRecipeId,
  onClose,
  onGenerate,
}: {
  recipeId: string
  onRecipeId: (value: string) => void
  onClose: () => void
  onGenerate: (options: GenerateTemplateOptions) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const selected = LAYOUT_RECIPES.find((recipe) => recipe.id === recipeId) ?? LAYOUT_RECIPES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        className="w-[640px] max-h-[90vh] overflow-y-auto rounded-xl border border-line bg-panel-2 p-5 shadow-2xl"
      >
        <h2 className="font-serif text-xl text-ink">Generate Template</h2>
        <p className="mt-1 text-sm text-muted">
          Deterministic collage and studio-composite recipes. Geometry, cutouts, shared themes, and layers.
        </p>

        <label className="mt-5 block text-[11px] uppercase tracking-[0.16em] text-muted">
          Album Size
        </label>
        <div className="mt-1 rounded-md border border-line bg-panel px-3 py-2 text-sm">12 × 36</div>

        <label className="mt-4 block text-[11px] uppercase tracking-[0.16em] text-muted">
          Layout Recipe
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {LAYOUT_RECIPES.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => onRecipeId(recipe.id)}
              className={`rounded-md border px-3 py-2 text-left ${
                recipeId === recipe.id
                  ? "border-gold bg-gold/15"
                  : "border-line hover:border-gold/40"
              }`}
            >
              <div className="text-sm text-ink">{recipe.name}</div>
              <div className="mt-0.5 text-[11px] text-muted">
                {recipe.style} · {recipe.photoCount} photos
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{selected.description}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onGenerate({
                albumSize: "12x36",
                recipeId,
              })
            }
            className="rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-[#2a2118]"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}
