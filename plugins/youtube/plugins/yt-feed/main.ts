import { Innertube, UniversalCache } from "youtubei.js"
import { join } from "path"
import { existsSync, readFileSync, unlinkSync } from "fs"
import { startStdin } from "../../../_shared/stdin.ts"

let cookieStr: string | null = null
const cookieFile = join(import.meta.dir, "..", "..", ".youtube-cookie")

function loadCookie(): string | null {
  try {
    if (existsSync(cookieFile)) {
      const data = readFileSync(cookieFile, "utf-8").trim()
      if (data) return data
    }
  } catch {}
  return null
}

const cached = loadCookie()
if (cached) {
  try {
    const tube = await Innertube.create({ cookie: cached, cache: new UniversalCache(true) })
    await tube.account.getInfo()
    cookieStr = cached
  } catch {
    if (existsSync(cookieFile)) unlinkSync(cookieFile)
  }
}

startStdin(async (req, send) => {
  if (req.method !== "feed") { send(req.id, null, "Method not found: " + req.method); return }
  if (!cookieStr) { const fresh = loadCookie(); if (fresh) cookieStr = fresh }
  if (!cookieStr) { send(req.id, null, "Not Authenticated"); return }
  const tube = await Innertube.create({ cookie: cookieStr, cache: new UniversalCache(true) })
  const home = await Promise.race([
    tube.getHomeFeed(),
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
  ])
  const videos: any[] = []
  for (const section of home.contents?.contents || []) {
    let items: any[] = []
    if (section.type === "RichItem" && section.content?.type === "LockupView" && section.content?.content_type === "VIDEO")
      items = [section.content]
    else if (section.type === "RichSection" && section.content?.type === "RichShelf" && section.content?.contents)
      items = section.content.contents.filter((i: any) => i.content?.type === "LockupView" && i.content?.content_type === "VIDEO").map((i: any) => i.content)
    for (const v of items) {
      const md = v.metadata || {}
      const parts = md.metadata?.metadata_rows?.[0]?.metadata_parts || []
      videos.push({
        title: md.title?.text || "Untitled", videoId: v.content_id,
        channel: parts[0]?.text?.text || "", views: parts[1]?.text?.text || "",
        published: parts[2]?.text?.text || "", thumbnail: v.content_image?.image?.[0]?.url || "",
      })
    }
  }
  send(req.id, videos.slice(0, req.params.limit || 30))
})
