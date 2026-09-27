import { createReadStream, existsSync, statSync } from "node:fs"
import type { ServerResponse } from "node:http"
import path from "node:path"
import type { Plugin } from "vite"

const TEMPLATE_DIR = "/Users/mvinoth/Downloads/template-free"

export function studioTemplatesPlugin(): Plugin {
  return {
    name: "studio-templates",
    configureServer(server) {
      server.middlewares.use("/templates", (req, res) => {
        const name = decodeURIComponent((req.url ?? "/").split("?")[0].replace(/^\//, ""))
        if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
          res.statusCode = 400
          res.end("Invalid template name")
          return
        }
        const file = path.join(TEMPLATE_DIR, name)
        if (!file.startsWith(TEMPLATE_DIR + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404
          res.end("Template not found")
          return
        }
        sendFile(file, res)
      })
    },
  }
}

function sendFile(file: string, res: ServerResponse): void {
  const stat = statSync(file)
  res.statusCode = 200
  res.setHeader("Content-Type", "application/octet-stream")
  res.setHeader("Content-Length", String(stat.size))
  createReadStream(file).pipe(res)
}
