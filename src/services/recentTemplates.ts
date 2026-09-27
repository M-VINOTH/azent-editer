export type RecentTemplate =
  | { kind: "plain"; name: string; width: number; height: number; dpi: number; at: number }
  | { kind: "studio"; file: string; name: string; at: number }

const KEY = "azent-recent-templates"
const LIMIT = 12

export function readRecents(): RecentTemplate[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentTemplate[]
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, LIMIT) : []
  } catch {
    return []
  }
}

type NewRecent =
  | { kind: "plain"; name: string; width: number; height: number; dpi: number }
  | { kind: "studio"; file: string; name: string }

export function rememberRecent(item: NewRecent): RecentTemplate[] {
  const next = { ...item, at: Date.now() } as RecentTemplate
  const recents = [next, ...readRecents().filter((recent) => !sameRecent(recent, next))].slice(0, LIMIT)
  localStorage.setItem(KEY, JSON.stringify(recents))
  return recents
}

function sameRecent(a: RecentTemplate, b: RecentTemplate): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "studio" && b.kind === "studio") return a.file === b.file
  return a.kind === "plain" && b.kind === "plain" && a.width === b.width && a.height === b.height && a.dpi === b.dpi
}

function isRecent(value: RecentTemplate): boolean {
  if (!value || (value.kind !== "plain" && value.kind !== "studio")) return false
  return typeof value.name === "string" && typeof value.at === "number"
}
