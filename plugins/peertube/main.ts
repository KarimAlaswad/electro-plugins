import { createInterface } from "readline"

// -- Send JSON response to stdout --
function send(id: number | null, result?: any, error?: string) {
  const msg: any = { id };
  if (error) msg.error = error
  else msg.result = result
  process.stdout.write(JSON.stringify(msg) + "\n")
}

// -- Handle one RPC request --
async function handleRequest(request: any) {
  const method = request.method
  const params = request.params || {}
  const reqId = request.id

  try {
    if (method === "list") {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(
        "https://peertube.cpy.re/api/v1/videos?sort=-views&count=15",
        { signal: controller.signal }
      )
      clearTimeout(timer)
      const json: any = await res.json()
      const items = json.data.map((v: any) => ({
        title: v.name || "Untitled",
        videoId: v.uuid,
        channel: v.account?.displayName || v.account?.name || "Unknown",
        views: String(v.views || 0),
        duration: v.duration || 0,
        thumbnail: v.thumbnailPath
          ? "https://peertube.cpy.re" + v.thumbnailPath
          : "",
        published: v.publishedAt || "",
        url: v.url || "",
        category: v.category?.label || "",
        licence: v.licence?.label || "",
        language: v.language?.label || "",
        embedUrl: v.embedPath ? "https://peertube.cpy.re" + v.embedPath : "",
      }))
      send(reqId, items)
    } else {
      send(reqId, null, "Method not found: " + method)
    }
  } catch (e: any) {
    send(reqId, null, e.message || String(e))
  }
}

// -- stdin reader (one JSON line at a time), queued to ensure serial processing --
const rl = createInterface({ input: process.stdin })
let busy = false
const queue: string[] = []
rl.on("line", (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return
  queue.push(trimmed)
  if (!busy) processNext()
})
async function processNext() {
  busy = true
  while (queue.length > 0) {
    try {
      await handleRequest(JSON.parse(queue.shift()!))
    } catch (e: any) {
      send(null, null, e.message || "Parse error")
    }
  }
  busy = false
}