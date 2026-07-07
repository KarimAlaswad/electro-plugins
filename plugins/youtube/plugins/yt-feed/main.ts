import { createInterface } from "readline"
import { Innertube, UniversalCache } from "youtubei.js"
import { join } from "path"
import { existsSync, readFileSync, unlinkSync } from "fs"

let cookieStr: string | null = null
const cookieFile = join(import.meta.dir, "..", "..", ".youtube-cookie")

function send(id: number | null, result?: any, error?: string) {
  const msg: any = { id }
  if (error) msg.error = error
  else msg.result = result
  process.stdout.write(JSON.stringify(msg) + "\n")
}

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
    unlinkSync(cookieFile)
  }
}

async function handleRequest(request: any) {
  const method = request.method
  const params = request.params || {}
  const reqId = request.id

  try {
    if (method === "feed") {
      if (!cookieStr) {
        const fresh = loadCookie()
        if (fresh) cookieStr = fresh 
      }
      if (!cookieStr) { send(reqId, null, "Not Authenticated"); return }
      const tube = await Innertube.create({ cookie: cookieStr, cache: new UniversalCache(true) })
      const home = await Promise.race([
        tube.getHomeFeed(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ])
      const grid = home.contents
      const videos: any[] = []
      for (const section of grid?.contents || []) {
        let items: any[] = []
        if (section.type === "RichItem" && section.content?.type === "LockupView" && section.content?.content_type === "VIDEO")
          items = [section.content]
        else if (section.type === "RichSection" && section.content?.type === "RichShelf" && section.content?.contents)
          items = section.content.contents.filter((i: any) => i.content?.type === "LockupView" && i.content?.content_type === "VIDEO").map((i: any) => i.content)
        for (const v of items) {
          const md = v.metadata || {}
          const parts = md.metadata?.metadata_rows?.[0]?.metadata_parts || []
          videos.push({
            title: md.title?.text || "Untitled",
            videoId: v.content_id,
            channel: parts[0]?.text?.text || "",
            views: parts[1]?.text?.text || "",
            published: parts[2]?.text?.text || "",
            thumbnail: v.content_image?.image?.[0]?.url || "",
          })
        }
      }
      send(reqId, videos.slice(0, params.limit || 30))
    } else {
      send(reqId, null, "Method not found: " + method)
    }
  } catch (e: any) {
    send(reqId, null, e.message || String(e))
  }
}

const rl = createInterface({ input: process.stdin })
let busy = false
const queue: string[] = []
rl.on('line', (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return
  queue.push(trimmed)
  if (!busy) processNext()
})

async function processNext() {
  busy = true
  while (queue.length > 0) {
    try { await handleRequest(JSON.parse(queue.shift()!)) } catch { send(null, null, "Parse error") }
  }
  busy = false
}