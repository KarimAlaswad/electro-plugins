import { startStdin } from "../_shared/stdin.ts"

startStdin(async (req, send) => {
  if (req.method !== "list") { send(req.id, null, "Method not found: " + req.method); return }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  const res = await fetch("https://peertube.cpy.re/api/v1/videos?sort=-views&count=15", { signal: controller.signal })
  clearTimeout(timer)
  const items = (await res.json()).data.map((v: any) => ({
    title: v.name || "Untitled", videoId: v.uuid, channel: v.account?.displayName || v.account?.name || "Unknown",
    views: String(v.views || 0), duration: v.duration || 0,
    thumbnail: v.thumbnailPath ? "https://peertube.cpy.re" + v.thumbnailPath : "",
    published: v.publishedAt || "", url: v.url || "", category: v.category?.label || "",
    licence: v.licence?.label || "", language: v.language?.label || "",
    embedUrl: v.embedPath ? "https://peertube.cpy.re" + v.embedPath : "",
  }))
  send(req.id, items)
})
