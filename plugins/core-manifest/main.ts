import { readdirSync, existsSync, lstatSync, readFileSync } from "fs"
import { join } from "path"
import { startStdin } from "../_shared/stdin.ts"

const baseDir = process.argv[2] || join(import.meta.dir, "..", "..")

function getAllPluginManifests(dir: string): any[] {
  let manifests: any[] = []
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file)
    if (lstatSync(fullPath).isDirectory()) {
      if (existsSync(join(fullPath, "plugin.json")))
        manifests.push(JSON.parse(readFileSync(join(fullPath, "plugin.json"), "utf-8")))
      manifests = manifests.concat(getAllPluginManifests(fullPath))
    }
  }
  return manifests
}

startStdin(async (req, send) => {
  if (req.method === "scan") {
    const pluginDir = join(baseDir, "plugins")
    if (!existsSync(pluginDir)) { send(req.id, []); return }
    const manifests = getAllPluginManifests(pluginDir)
    if (req.params.full) { send(req.id, manifests); return }
    const safe = manifests.map((m: any) => ({
      name: m.name, version: m.version, description: m.description, author: m.author,
      methods: m.methods || [], hooks: m.hooks || [], ui: m.ui || null, feeds: m.feeds || null,
    }))
    send(req.id, safe)
  } else {
    send(req.id, null, "Method not found: " + req.method)
  }
})
