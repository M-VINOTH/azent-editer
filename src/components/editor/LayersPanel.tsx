import { Fragment, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react"
import { LayerStyle } from "./LayerStyle"
import { useTemplateStore, BACKGROUND_LAYER_ID } from "../../store/templateStore"
import { hiddenWithAncestors, isInside, lockedWithAncestors, sortByZIndex } from "../../utils/geometry"
import { decorationSource } from "../../utils/shapeGraphic"
import { PHOTO_SHAPE_LABELS, type Background, type PhotoElement, type PhotoShape, type TemplateElement } from "../../models/template"

export function LayersPanel() {
  const template = useTemplateStore((state) => state.template)
  const selectedId = useTemplateStore((state) => state.selectedId)
  const selectedIds = useTemplateStore((state) => state.selectedIds)
  const layerFocus = useTemplateStore((state) => state.layerFocus)
  const hiddenIds = useTemplateStore((state) => state.hiddenIds)
  const hiddenPhotoIds = useTemplateStore((state) => state.hiddenPhotoIds)
  const selectElement = useTemplateStore((state) => state.selectElement)
  const toggleHidden = useTemplateStore((state) => state.toggleHidden)
  const togglePhotoHidden = useTemplateStore((state) => state.togglePhotoHidden)
  const setStatus = useTemplateStore((state) => state.setStatus)
  const selectAndReorder = useTemplateStore((state) => state.selectAndReorder)
  const reorderLayer = useTemplateStore((state) => state.reorderLayer)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ key: string; id: string; before: boolean; into: boolean } | null>(null)
  const draggingRef = useRef<string | null>(null)
  const dropRef = useRef<{ key: string; id: string; before: boolean; into: boolean } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pointerY = useRef<number | null>(null)
  const scrollFrame = useRef(0)

  const stopAutoScroll = () => {
    if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current)
    scrollFrame.current = 0
    pointerY.current = null
  }

  const stepAutoScroll = () => {
    const list = listRef.current
    const y = pointerY.current
    if (!list || y == null || !draggingRef.current) return
    const rect = list.getBoundingClientRect()
    const edge = 36
    const maxStep = 16
    if (y >= rect.top && y < rect.top + edge) {
      const speed = (edge - (y - rect.top)) / edge
      list.scrollTop -= Math.max(2, Math.ceil(maxStep * speed))
    } else if (y <= rect.bottom && y > rect.bottom - edge) {
      const speed = (edge - (rect.bottom - y)) / edge
      list.scrollTop += Math.max(2, Math.ceil(maxStep * speed))
    }
    scrollFrame.current = requestAnimationFrame(stepAutoScroll)
  }

  const trackPointer = (clientY: number) => {
    pointerY.current = clientY
    if (!scrollFrame.current && draggingRef.current) scrollFrame.current = requestAnimationFrame(stepAutoScroll)
  }

  const beginDrag = (id: string) => {
    draggingRef.current = id
    setDraggingId(id)
  }
  const hoverDrag = (key: string, id: string, before: boolean, into: boolean) => {
    const next = { key, id, before, into }
    dropRef.current = next
    setDropAt(next)
  }
  const finishDrag = () => {
    const from = draggingRef.current
    const target = dropRef.current
    if (from && target && from !== target.id) {
      const placement = target.into ? "into" : target.key === "background" ? "root" : "beside"
      reorderLayer(from, target.id, target.before, placement)
      if (target.into) setCollapsed((current) => ({ ...current, [target.id]: false }))
    }
    draggingRef.current = null
    dropRef.current = null
    stopAutoScroll()
    setDraggingId(null)
    setDropAt(null)
  }
  const cancelDrag = () => {
    draggingRef.current = null
    dropRef.current = null
    stopAutoScroll()
    setDraggingId(null)
    setDropAt(null)
  }

  useEffect(() => stopAutoScroll, [])
  const setTool = useTemplateStore((state) => state.setTool)
  const addLayer = useTemplateStore((state) => state.addLayer)
  const updateElement = useTemplateStore((state) => state.updateElement)
  const renameLayer = useTemplateStore((state) => state.renameLayer)
  const toggleLocked = useTemplateStore((state) => state.toggleLocked)
  const groupSelected = useTemplateStore((state) => state.groupSelected)
  const ungroupSelected = useTemplateStore((state) => state.ungroupSelected)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<LayerKind>("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingPhotoId = useRef<string | null>(null)
  const layers = sortByZIndex(template.elements, "desc")
  const layerIds = new Set(template.elements.map((element) => element.id))
  const roots = layers.filter((element) => !element.parentId || !layerIds.has(element.parentId))
  const concealed = hiddenWithAncestors(template.elements, hiddenIds)
  const lockedIds = lockedWithAncestors(template.elements)
  const needle = query.trim().toLowerCase()
  const filtering = needle.length > 0 || kind !== "all"
  const listed = listedLayerIds(template.elements, needle, kind)
  const chosen = new Set(selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [])
  const canGroup = template.elements.some((element) => chosen.has(element.id))
  const canUngroup = template.elements.some((element) => chosen.has(element.id) && (element.type === "group" || Boolean(element.parentId)))
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const createPhotoLayer = () => {
    addLayer("photo")
    pendingPhotoId.current = useTemplateStore.getState().selectedId
    fileRef.current?.click()
  }

  const renderLayer = (element: TemplateElement, depth: number): ReactNode => {
    const selected = selectedIds.includes(element.id) || selectedId === element.id
    const hidden = concealed.has(element.id)
    const kids = layers.filter((item) => item.parentId === element.id && listed.has(item.id))
    const framed = isFramePhoto(element)
    const open = filtering || !collapsed[element.id]
    const drag = {
      dragging: draggingId === element.id,
      dropAt,
      onDragStart: () => beginDrag(element.id),
      onDragOver: (key: string, before: boolean, clientY: number, into: boolean) => {
        trackPointer(clientY)
        const from = draggingRef.current
        if (from && (from === element.id || isInside(template.elements, element.id, from))) return
        const canNest = Boolean(from)
        const nest = into && canNest
        const highlightKey = nest && key.endsWith("-photo") ? `${element.id}-frame` : key
        hoverDrag(highlightKey, element.id, before, nest)
      },
      onDrop: finishDrag,
      onDragEnd: cancelDrag,
    }
    const childRows = open ? kids.map((child) => renderLayer(child, depth + 1)) : null
    if (!framed) {
      return (
        <Fragment key={element.id}>
          <LayerRow
            element={element}
            selected={selected}
            hidden={hidden}
            depth={depth}
            onSelect={(additive) => selectElement(element.id, additive)}
            onToggle={() => toggleHidden(element.id)}
            locked={lockedIds.has(element.id)}
            onToggleLock={() => toggleLocked(element.id)}
            editing={editingId === element.id}
            onStartRename={() => setEditingId(element.id)}
            onRename={(name) => renameLayer(element.id, name)}
            onFinishRename={() => setEditingId(null)}
            onMove={(direction) => selectAndReorder(element.id, direction)}
            expanded={kids.length > 0 ? open : undefined}
            onExpand={kids.length > 0 ? () => setCollapsed((current) => ({ ...current, [element.id]: open })) : undefined}
            drag={drag}
            dragKey={element.id}
          />
          {childRows}
        </Fragment>
      )
    }
    return (
      <Fragment key={element.id}>
        <LayerGroup
          element={element}
          open={open}
          depth={depth}
          hidden={hidden}
          onSelectFrame={(additive) => selectElement(element.id, additive, "frame")}
          onSelectPhoto={(additive) => selectElement(element.id, additive, "photo")}
          frameSelected={selected && layerFocus !== "photo"}
          photoSelected={selected && layerFocus === "photo"}
          onToggle={() => toggleHidden(element.id)}
          locked={lockedIds.has(element.id)}
          onToggleLock={() => toggleLocked(element.id)}
          editing={editingId === element.id}
          onStartRename={() => setEditingId(element.id)}
          onRename={(name) => renameLayer(element.id, name)}
          onFinishRename={() => setEditingId(null)}
          onTogglePhoto={() => {
            if (hidden) {
              setStatus("Show the frame first. The photo stays hidden while its frame is hidden.")
              return
            }
            togglePhotoHidden(element.id)
          }}
          photoHidden={hidden || hiddenPhotoIds.includes(element.id)}
          onMove={(direction) => selectAndReorder(element.id, direction)}
          onExpand={() => setCollapsed((current) => ({ ...current, [element.id]: open }))}
          drag={drag}
        />
        {childRows}
      </Fragment>
    )
  }

  return (
    <aside className="flex w-[280px] min-w-[280px] flex-col border-l border-[var(--ed-line)] bg-[var(--ed-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--ed-line-soft)] px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ed-secondary)]">Layers</h2>
        <span className="text-[11px] text-[var(--ed-muted)]">{layers.length}</span>
      </div>
      <div className="border-b border-[var(--ed-line-soft)] px-2 py-2">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ed-muted)]">
          <span>New layer</span>
          <span className="font-normal normal-case tracking-normal">Shift-click to select more</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <NewLayerButton label="Photo" onClick={createPhotoLayer} />
          <NewLayerButton label="Text" onClick={() => addLayer("text")} />
          <NewLayerButton label="Shape" onClick={() => addLayer("shape")} />
          <NewLayerButton label="Deco" onClick={() => addLayer("decoration")} />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <NewLayerButton label="Group" disabled={!canGroup} onClick={groupSelected} />
          <NewLayerButton label="Ungroup" disabled={!canUngroup} onClick={ungroupSelected} />
        </div>
        <div className="mt-2 flex gap-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search layers"
            className="min-w-0 flex-1 rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-2 py-1 text-[12px] text-[var(--ed-ink)]"
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as LayerKind)}
            className="rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-1 py-1 text-[12px] text-[var(--ed-text)]"
            aria-label="Filter layers"
          >
            <option value="all">All</option>
            <option value="photo">Photos</option>
            <option value="text">Text</option>
            <option value="shape">Shapes</option>
            <option value="decoration">Deco</option>
            <option value="group">Groups</option>
          </select>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          const id = pendingPhotoId.current
          event.target.value = ""
          if (!file || !id) return
          void readLayerImage(file).then((url) => updateElement(id, { imageUrl: url }))
        }}
      />
      <div
        ref={listRef}
        className="editor-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--ed-raised)]"
        onDragOver={(event) => {
          if (!draggingRef.current) return
          event.preventDefault()
          trackPointer(event.clientY)
        }}
      >
        <ul>
          {filtering && roots.every((element) => !listed.has(element.id)) ? (
            <li className="px-3 py-4 text-xs text-[var(--ed-muted)]">No layers match.</li>
          ) : (
            roots.filter((element) => listed.has(element.id)).map((element) => renderLayer(element, 0))
          )}
          <BackgroundRow
            background={template.background}
            selected={selectedId === BACKGROUND_LAYER_ID}
            dropActive={dropAt?.key === "background"}
            onDragOver={(event) => {
              if (!draggingRef.current) return
              event.preventDefault()
              trackPointer(event.clientY)
              const bottom = layers[layers.length - 1]
              if (!bottom || bottom.id === draggingRef.current) return
              hoverDrag("background", bottom.id, false, false)
            }}
            onDrop={finishDrag}
            onSelect={() => {
              selectElement(BACKGROUND_LAYER_ID)
              setTool("crop")
              useTemplateStore.getState().setStatus("Background selected. Drag to move the photo. Scroll to zoom it.")
            }}
          />
        </ul>
      </div>
      <LayerStyle />
    </aside>
  )
}

function NewLayerButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--ed-line)] bg-[var(--ed-surface)] px-1 py-1.5 text-[11px] text-[var(--ed-text)] hover:border-[var(--ed-accent)] hover:text-[var(--ed-accent-ink)] disabled:opacity-40"
    >
      {label}
    </button>
  )
}

function readLayerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const maxEdge = 1800
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(String(reader.result))
          return
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      image.onerror = () => reject(new Error("Could not read the photo"))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

type LayerDrag = {
  dragging: boolean
  dropAt: { key: string; id: string; before: boolean; into: boolean } | null
  onDragStart: () => void
  onDragOver: (key: string, before: boolean, clientY: number, into: boolean) => void
  onDrop: () => void
  onDragEnd: () => void
}

function LayerGroup({
  element,
  open,
  frameSelected,
  photoSelected,
  hidden,
  onSelectFrame,
  onSelectPhoto,
  onToggle,
  locked,
  onToggleLock,
  editing,
  onStartRename,
  onRename,
  onFinishRename,
  onTogglePhoto,
  photoHidden,
  onMove,
  onExpand,
  drag,
  depth,
}: {
  element: PhotoElement
  open: boolean
  frameSelected: boolean
  photoSelected: boolean
  hidden: boolean
  onSelectFrame: (additive: boolean) => void
  onSelectPhoto: (additive: boolean) => void
  onToggle: () => void
  locked: boolean
  onToggleLock: () => void
  editing: boolean
  onStartRename: () => void
  onRename: (name: string) => void
  onFinishRename: () => void
  onTogglePhoto: () => void
  photoHidden: boolean
  onMove: (direction: "forward" | "backward") => void
  onExpand: () => void
  drag: LayerDrag
  depth: number
}) {
  return (
    <>
      <LayerRow
        element={element}
        selected={frameSelected}
        hidden={hidden}
        depth={depth}
        label={PHOTO_SHAPE_LABELS[element.shape]}
        onSelect={onSelectFrame}
        onToggle={onToggle}
        locked={locked}
        onToggleLock={onToggleLock}
        editing={editing}
        onStartRename={onStartRename}
        onRename={onRename}
        onFinishRename={onFinishRename}
        onMove={onMove}
        expanded={open}
        onExpand={onExpand}
        drag={drag}
        dragKey={`${element.id}-frame`}
      />
      {open ? (
        <LayerRow
          element={element}
          selected={photoSelected}
          hidden={photoHidden}
          nested
          plain
          depth={depth + 1}
          label={layerLabel(element)}
          onSelect={onSelectPhoto}
          onToggle={onTogglePhoto}
          drag={drag}
          dragKey={`${element.id}-photo`}
        />
      ) : null}
    </>
  )
}

function LayerRow({
  element,
  selected,
  hidden,
  onSelect,
  onToggle,
  locked = false,
  onToggleLock,
  editing = false,
  onStartRename,
  onRename,
  onFinishRename,
  onMove,
  label,
  plain = false,
  nested = false,
  expanded,
  onExpand,
  drag,
  dragKey,
  depth = 0,
}: {
  element: TemplateElement
  selected: boolean
  hidden: boolean
  onSelect: (additive: boolean) => void
  locked?: boolean
  onToggleLock?: () => void
  editing?: boolean
  onStartRename?: () => void
  onRename?: (name: string) => void
  onFinishRename?: () => void
  onToggle: () => void
  onMove?: (direction: "forward" | "backward") => void
  label?: string
  plain?: boolean
  nested?: boolean
  expanded?: boolean
  onExpand?: () => void
  drag?: LayerDrag
  dragKey?: string
  depth?: number
}) {
  const nesting = Boolean(drag?.dropAt?.into && drag.dropAt.key === dragKey)
  const dropLine = Boolean(drag?.dropAt && !drag.dropAt.into && drag.dropAt.key === dragKey)
  const cancelRename = useRef(false)
  const shown = label ?? layerLabel(element)
  return (
    <li
      onDragOver={(event) => {
        if (!drag || !dragKey) return
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1)
        const into = ratio >= 0.28 && ratio <= 0.72
        drag.onDragOver(dragKey, event.clientY < rect.top + rect.height / 2, event.clientY, into)
      }}
      onDrop={(event) => {
        event.preventDefault()
        drag?.onDrop()
      }}
      className={`border-b border-[var(--ed-line)] ${hidden ? "opacity-45" : ""} ${drag?.dragging && !nested ? "opacity-50" : ""} ${nesting ? "bg-[var(--ed-accent-wash)] text-[var(--ed-ink)]" : selected ? "bg-[var(--ed-accent)] text-white" : "bg-[var(--ed-panel)] text-[var(--ed-ink)] hover:bg-[var(--ed-surface)]"} ${nesting ? "shadow-[inset_0_0_0_2px_#1473e6]" : ""} ${dropLine ? (drag?.dropAt?.before ? "shadow-[inset_0_2px_0_#1473e6]" : "shadow-[inset_0_-2px_0_#1473e6]") : ""}`}
    >
      <div className="flex items-center gap-1.5 py-1 pr-1.5" style={{ paddingLeft: 4 + depth * 18 }}>
        {onExpand ? (
          <button
            type="button"
            title={expanded ? "Collapse" : "Expand"}
            onClick={onExpand}
            className={`grid h-7 w-3 shrink-0 place-items-center text-[10px] ${selected ? "text-white" : "text-[var(--ed-secondary)]"}`}
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <button
          type="button"
          title={hidden ? "Show layer" : "Hide layer"}
          onClick={onToggle}
          className={`grid h-7 w-5 shrink-0 place-items-center ${selected ? "text-white" : "text-[var(--ed-secondary)]"}`}
        >
          <EyeIcon hidden={hidden} />
        </button>
        {onToggleLock && !nested ? (
          <button
            type="button"
            title={locked ? "Unlock layer" : "Lock layer"}
            onClick={onToggleLock}
            className={`grid h-7 w-5 shrink-0 place-items-center ${selected ? "text-white" : locked ? "text-[var(--ed-accent)]" : "text-[var(--ed-muted)]"}`}
          >
            <LockIcon locked={locked} />
          </button>
        ) : null}
        <div
          role="button"
          tabIndex={0}
          draggable={Boolean(drag) && !nested && !editing}
          title={nested ? undefined : "Drag to reorder, or drop onto a layer to nest it"}
          onDragStart={(event) => {
            if (!drag || nested || editing) return
            event.dataTransfer.setData("text/plain", element.id)
            event.dataTransfer.effectAllowed = "move"
            drag.onDragStart()
          }}
          onDragEnd={() => drag?.onDragEnd()}
          onClick={(event) => {
            if (editing) return
            onSelect(event.shiftKey || event.metaKey)
          }}
          onKeyDown={(event) => {
            if (editing) return
            if (event.key === "Enter" || event.key === " ") onSelect(event.shiftKey || event.metaKey)
          }}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing"
        >
          <LayerThumb element={element} plain={plain} />
          {editing && onRename && onFinishRename ? (
            <input
              autoFocus
              defaultValue={element.name ?? shown}
              aria-label="Layer name"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onBlur={(event) => {
                if (!cancelRename.current) onRename(event.target.value)
                cancelRename.current = false
                onFinishRename()
              }}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === "Enter") event.currentTarget.blur()
                if (event.key === "Escape") {
                  event.preventDefault()
                  cancelRename.current = true
                  onFinishRename()
                }
              }}
              className="min-w-0 flex-1 rounded border border-[var(--ed-accent)] bg-[var(--ed-surface)] px-1 text-[12px] text-[var(--ed-ink)]"
            />
          ) : (
            <span
              title={onStartRename ? "Double-click to rename" : undefined}
              onDoubleClick={(event) => {
                if (!onStartRename) return
                event.preventDefault()
                event.stopPropagation()
                onStartRename()
              }}
              className="min-w-0 flex-1 truncate text-[12px] leading-4"
            >
              {shown}
            </span>
          )}
        </div>
        {onMove ? (
          <>
            <button type="button" title="Bring forward" onClick={() => onMove("forward")} className={`px-0.5 text-[10px] ${selected ? "text-white/80" : "text-[var(--ed-muted)]"}`}>
              ↑
            </button>
            <button type="button" title="Send backward" onClick={() => onMove("backward")} className={`px-0.5 text-[10px] ${selected ? "text-white/80" : "text-[var(--ed-muted)]"}`}>
              ↓
            </button>
          </>
        ) : null}
      </div>
    </li>
  )
}

function BackgroundRow({
  background,
  selected,
  onSelect,
  dropActive = false,
  onDragOver,
  onDrop,
}: {
  background: Background
  selected: boolean
  onSelect: () => void
  dropActive?: boolean
  onDragOver?: (event: DragEvent<HTMLLIElement>) => void
  onDrop?: () => void
}) {
  return (
    <li
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault()
        onDrop?.()
      }}
      className={`border-b border-[var(--ed-line)] ${dropActive ? "shadow-[inset_0_2px_0_#1473e6]" : ""} ${selected ? "bg-[var(--ed-accent)] text-white" : "bg-[var(--ed-panel)] text-[var(--ed-ink)] hover:bg-[var(--ed-surface)]"}`}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-center gap-2 px-1.5 py-1 pl-8 text-left">
        <ThumbFrame>
          {background.type === "image" ? (
            <img src={background.url} alt="" className="h-full w-full object-cover" />
          ) : background.type === "transparent" ? (
            <span
              className="block h-full w-full"
              style={{
                backgroundColor: "#fff",
                backgroundImage:
                  "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                backgroundSize: "8px 8px",
                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
              }}
            />
          ) : (
            <span className="block h-full w-full" style={{ background: background.value }} />
          )}
        </ThumbFrame>
        <span className="min-w-0 flex-1 truncate text-[12px]">Background</span>
      </button>
    </li>
  )
}

function isFramePhoto(element: TemplateElement): element is PhotoElement {
  return element.type === "photo" && element.role !== "wash" && element.role !== "cutout"
}

function LayerThumb({ element, plain = false }: { element: TemplateElement; plain?: boolean }) {
  if (element.type === "photo" && element.imageUrl) {
    const framed = !plain && isFramePhoto(element)
    return (
      <ThumbFrame>
        <span className="relative block h-full w-full">
          <img
            src={element.imageUrl}
            alt=""
            className={`h-full w-full ${element.role === "cutout" || element.objectFit === "contain" ? "object-contain" : "object-cover"}`}
            style={framed && element.shape !== "rectangle" ? { clipPath: shapeClip(element.shape) } : undefined}
          />
          {framed ? <ShapeRing element={element} /> : null}
        </span>
      </ThumbFrame>
    )
  }
  if (element.type === "group") {
    return (
      <ThumbFrame>
        <span className="text-[14px] leading-none text-[var(--ed-secondary)]">▣</span>
      </ThumbFrame>
    )
  }
  if (element.type === "text") {
    return (
      <ThumbFrame>
        <span className="font-serif text-[22px] font-semibold leading-none" style={{ color: element.color }}>
          T
        </span>
      </ThumbFrame>
    )
  }
  if (element.type === "decoration") {
    return (
      <ThumbFrame>
        <img src={decorationSource(element)} alt="" className="h-full w-full object-contain" />
      </ThumbFrame>
    )
  }
  return (
    <ThumbFrame>
      <span className="text-[11px] text-[var(--ed-muted)]">+</span>
    </ThumbFrame>
  )
}

function ShapeRing({ element }: { element: PhotoElement }) {
  const color = element.border?.color ?? "transparent"
  const width = (element.border?.width ?? 0) > 0 ? 2 : 0
  if (element.shape === "rectangle" || element.shape === "rounded") {
    return (
      <span
        className="pointer-events-none absolute inset-[1px] border-solid"
        style={{
          borderWidth: Math.max(width, 1),
          borderColor: width > 0 ? color : "#c8c8c8",
          borderRadius: element.shape === "rounded" ? 4 : 0,
        }}
      />
    )
  }
  if (element.shape === "circle" || element.shape === "oval") {
    return (
      <span
        className={`pointer-events-none absolute border-solid ${element.shape === "circle" ? "inset-[1px] rounded-full" : "inset-x-[1px] inset-y-[5px] rounded-[50%]"}`}
        style={{ borderWidth: width, borderColor: color }}
      />
    )
  }
  return null
}

function shapeClip(shape: PhotoShape): string {
  if (shape === "circle") return "circle(46%)"
  if (shape === "oval") return "ellipse(48% 34%)"
  if (shape === "rounded") return "inset(0 round 14%)"
  if (shape === "arch") return "polygon(0% 100%, 0% 42%, 50% 6%, 100% 42%, 100% 100%)"
  if (shape === "polaroid") return "inset(8% 8% 22% 8%)"
  if (shape === "organic") return "ellipse(46% 42% at 50% 52%)"
  if (shape === "diagonal-left") return "polygon(18% 0, 100% 0, 100% 100%, 0 100%)"
  if (shape === "diagonal-right") return "polygon(0 0, 82% 0, 100% 100%, 0 100%)"
  return "inset(0)"
}

function ThumbFrame({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[2px] border border-black/20"
      style={{
        backgroundColor: "#fff",
        backgroundImage:
          "linear-gradient(45deg, #d0d0d0 25%, transparent 25%), linear-gradient(-45deg, #d0d0d0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d0d0d0 75%), linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)",
        backgroundSize: "8px 8px",
        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
      }}
    >
      {children}
    </span>
  )
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="9" rx="1.5" fill={locked ? "currentColor" : "none"} />
      <path d={locked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.5-1"} />
    </svg>
  )
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {hidden ? (
        <path d="M3 3l18 18M10.5 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M6.1 6.4C3.8 8 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2M9.9 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.8" />
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

type LayerKind = "all" | "photo" | "text" | "shape" | "decoration" | "group"

function matchesKind(element: TemplateElement, kind: LayerKind): boolean {
  if (kind === "all") return true
  if (kind === "shape") return element.type === "decoration" && Boolean(element.shape)
  if (kind === "decoration") return element.type === "decoration" && !element.shape
  return element.type === kind
}

function listedLayerIds(elements: TemplateElement[], needle: string, kind: LayerKind): Set<string> {
  const direct = new Set<string>()
  for (const element of elements) {
    if (!matchesKind(element, kind)) continue
    const label = layerLabel(element).toLowerCase()
    const text = element.type === "text" ? element.text.toLowerCase() : ""
    if (needle && !label.includes(needle) && !text.includes(needle)) continue
    direct.add(element.id)
  }
  if (!needle && kind === "all") return new Set(elements.map((element) => element.id))
  const listed = new Set(direct)
  const addDescendants = (id: string) => {
    for (const element of elements) {
      if (element.parentId !== id || listed.has(element.id)) continue
      listed.add(element.id)
      addDescendants(element.id)
    }
  }
  for (const id of direct) {
    addDescendants(id)
    const guard = new Set<string>()
    let parent = elements.find((element) => element.id === id)?.parentId
    while (parent && !guard.has(parent)) {
      listed.add(parent)
      guard.add(parent)
      parent = elements.find((element) => element.id === parent)?.parentId
    }
  }
  return listed
}

function layerLabel(element: TemplateElement): string {
  if (element.name) return element.name
  if (element.type === "group") return "Group"
  if (element.type === "text") return element.text.trim() || "Text"
  if (element.type === "photo") {
    if (element.role === "wash") return "Background Wash"
    if (element.role === "cutout") return prettyId(element.id, "Cutout")
    return prettyId(element.id, "Photo")
  }
  return prettyId(element.assetId || element.id, "Decoration")
}

function prettyId(id: string, fallback: string): string {
  const cleaned = id.replace(/-/g, " ").trim()
  if (!cleaned) return fallback
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}
