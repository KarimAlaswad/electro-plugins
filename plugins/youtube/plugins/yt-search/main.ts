import { Innertube, UniversalCache } from "youtubei.js"
import { join } from "path"
import { readFileSync } from "fs"
import { startStdin } from "../../../_shared/stdin.ts"

let cookieStr: string | null = null
const cookieFile = join(import.meta.dir, "..", "..", ".youtube-cookie")

try { const d = readFileSync(cookieFile, "utf-8").trim(); if (d) cookieStr = d } catch {}

startStdin(async (req, send) => {
  if (req.method !== "search") { send(req.id, null, "Method not found: " + req.method); return }
  if (!cookieStr) { send(req.id, null, "Not authenticated"); return }
  const tube = await Innertube.create({ cookie: cookieStr, cache: new UniversalCache(true) })
  const search = await Promise.race([
    tube.search(req.params.query),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
  ])
  const results = (search.videos || []).slice(0, req.params.limit || 10).map((v: any) => ({
    title: v.title?.text || "Untitled", videoId: v.id, channel: v.author?.name || "Unknown",
    views: v.views || "", duration: v.duration?.seconds || 0, thumbnail: v.thumbnails?.[0]?.url || "",
  }))
  send(req.id, results)
})
