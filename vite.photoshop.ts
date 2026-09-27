import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, statfs, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

const execFileAsync = promisify(execFile)

/** Full Photoshop first, then the Elements Editor. The outer Elements app is the hub and does not open the file. */
const PHOTOSHOP_APPS = [
  "Adobe Photoshop 2026",
  "Adobe Photoshop 2025",
  "Adobe Photoshop 2024",
  "Adobe Photoshop",
  "/Applications/Adobe Photoshop Elements 2025.app/Contents/MacOS/Adobe Photoshop Elements 2025 Editor.app",
  "Adobe Photoshop Elements 2025",
]

const LOW_DISK_BYTES = 12 * 1024 * 1024 * 1024

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function appLabel(app: string): string {
  if (app.includes("Elements") && app.endsWith(".app")) return "Adobe Photoshop Elements 2025"
  return app
}

async function openPsd(file: string): Promise<{ ok: true; app: string } | { ok: false; error: string }> {
  for (const app of PHOTOSHOP_APPS) {
    if (app.startsWith("/") && !existsSync(app)) continue
    try {
      await execFileAsync("open", ["-a", app, file])
      return { ok: true, app: appLabel(app) }
    } catch {
      // Try the next installed Photoshop.
    }
  }
  try {
    await execFileAsync("open", [file])
    return { ok: true, app: "the default PSD app" }
  } catch {
    return { ok: false, error: "Adobe Photoshop is not installed on this Mac." }
  }
}

async function diskWarning(dir: string): Promise<string | undefined> {
  try {
    const stats = await statfs(dir)
    const free = stats.bavail * stats.bsize
    if (free >= LOW_DISK_BYTES) return undefined
    const gigabytes = Math.max(1, Math.round(free / (1024 * 1024 * 1024)))
    return `This Mac has about ${gigabytes} GB free. Photoshop Elements shows a disk error when the disk is that full. Free some space, then open the file from Documents/Azent.`
  } catch {
    return undefined
  }
}

export function openInPhotoshopPlugin(): Plugin {
  return {
    name: "open-in-photoshop",
    configureServer(server) {
      server.middlewares.use("/api/open-photoshop", (req, res) => {
        void handleOpen(req, res)
      })
    },
  }
}

async function handleOpen(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405
    res.end(JSON.stringify({ ok: false, error: "Use POST." }))
    return
  }

  try {
    const body = await readBody(req)
    if (body.length < 26) {
      res.statusCode = 400
      res.end(JSON.stringify({ ok: false, error: "The PSD export was empty." }))
      return
    }
    const rawName = String(req.headers["x-filename"] ?? "album-spread.psd")
    const filename = rawName.replace(/[^a-zA-Z0-9._-]/g, "") || "album-spread.psd"
    // Documents, not the system temp folder. The Mac App Store build of Elements
    // cannot read /var/folders and reports that as a disk error.
    const dir = path.join(os.homedir(), "Documents", "Azent")
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, filename)
    await writeFile(file, body)
    const opened = await openPsd(file)
    const warning = opened.ok ? await diskWarning(dir) : undefined
    res.statusCode = opened.ok ? 200 : 404
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ...opened, path: file, warning }))
  } catch (error) {
    res.statusCode = 500
    res.setHeader("content-type", "application/json")
    res.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Could not open Photoshop.",
      }),
    )
  }
}
