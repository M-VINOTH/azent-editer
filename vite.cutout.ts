import { execFile } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import type { Plugin } from "vite"

const execFileAsync = promisify(execFile)
const MAX_BYTES = 30 * 1024 * 1024

function swiftToolchain(): { bin: string; sdk: string } | null {
  const root = "/Applications/Xcode.app/Contents/Developer"
  const bin = path.join(root, "Toolchains/XcodeDefault.xctoolchain/usr/bin/swift")
  const sdkDir = path.join(root, "Platforms/MacOSX.platform/Developer/SDKs")
  if (!existsSync(bin) || !existsSync(sdkDir)) return null
  const sdk = readdirSync(sdkDir)
    .filter((name) => name.startsWith("MacOSX") && name.endsWith(".sdk"))
    .sort()
    .at(-1)
  if (!sdk) return null
  return { bin, sdk: path.join(sdkDir, sdk) }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export function subjectCutoutPlugin(): Plugin {
  return {
    name: "subject-cutout",
    configureServer(server) {
      server.middlewares.use("/api/cutout", (req, res) => {
        void handleCutout(req, res)
      })
    },
  }
}

async function handleCutout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Use POST." })
    return
  }
  const toolchain = swiftToolchain()
  if (!toolchain) {
    sendJson(res, 500, { error: "Subject selection is not available on this Mac." })
    return
  }

  const dir = await mkdtemp(path.join(tmpdir(), "azent-cutout-"))
  try {
    const body = await readBody(req)
    if (body.length < 32) {
      sendJson(res, 400, { error: "Choose a photo first." })
      return
    }
    if (body.length > MAX_BYTES) {
      sendJson(res, 413, { error: "That photo is too large to cut out." })
      return
    }
    const input = path.join(dir, "source")
    const output = path.join(dir, "subject.png")
    await writeFile(input, body)
    const script = path.resolve(process.cwd(), "scripts/subject-cutout.swift")
    await execFileAsync(toolchain.bin, ["-sdk", toolchain.sdk, script, input, output], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    const png = await readFile(output)
    res.statusCode = 200
    res.setHeader("content-type", "image/png")
    res.setHeader("cache-control", "no-store")
    res.end(png)
  } catch (error) {
    const message = stderrOf(error)
    const noPerson = /no person/i.test(message)
    sendJson(res, noPerson ? 422 : 500, {
      error: noPerson ? "No person was found in this photo." : "Could not select the subject.",
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function sendJson(res: ServerResponse, status: number, body: { error: string }): void {
  res.statusCode = status
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(body))
}

function stderrOf(error: unknown): string {
  if (!error || typeof error !== "object") return ""
  const stderr = "stderr" in error ? error.stderr : undefined
  const text = Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr ?? "")
  const message = "message" in error ? String(error.message) : ""
  return `${text}\n${message}`
}
