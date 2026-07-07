import { join } from "path"
import { startStdin } from "../_shared/stdin.ts"

const baseDir = process.argv[2] || join(import.meta.dir, "..", "..")
const ALLOWED_PREFIX = join(baseDir, "build", "plugins")

startStdin(async (req, send) => {
  if (req.method === "read") {
    if (!req.params.path) { send(req.id, null, "path required"); return }
    const fullPath = join(baseDir, req.params.path)
    if (!fullPath.startsWith(ALLOWED_PREFIX)) { send(req.id, null, "Access denied"); return }
    const file = Bun.file(fullPath)
    if (!(await file.exists())) { send(req.id, null, "Not found: " + req.params.path); return }
    send(req.id, { code: await file.text() })
  } else {
    send(req.id, null, "Method not found: " + req.method)
  }
})
