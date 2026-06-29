import { useState, useEffect, useRef } from "react"
import { Electroview } from "electrobun/view"
import type { PluginManifest } from "../shared/types"

// -- RPC bridge (same as before, except Step 3 change to __pluginRpc) --
const electroview = new Electroview({
  rpc: Electroview.defineRPC({
    maxRequestTime: 20000,
    handlers: { requests: {}, messages: {} },
  }),
})

window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params });
  if (!res.success) throw new Error(res.error || "RPC error");
  return res.data;
};

export default function App() {
  const [manifests, setManifests] = useState<PluginManifest[]>([])
  const [feedPlugin, setFeedPlugin] = useState<PluginManifest | null>(null)
  const manifestsRef = useRef<PluginManifest[]>([])

  // On mount: load manifests => load frontneds => mount feed
  useEffect(() => { init() }, [])
  async function init() {
    // Step 1: Get all plugin manifests
    const all: PluginManifest[] = await electroview.rpc.request.getPluginManifests({})
    setManifests(all)
    manifestsRef.current = all

    // Step 2: Load frontend JS for every plugin that has a frontend file
    for (const m of all) {
      // Load card WCs (plugins with feeds.card)
      if (m.feeds?.card) {
        const path = `plugins/${m.name}/frontend/${m.feeds.card}.js`
        await loadFrontend(path)
      }
      // Load AND mount the main-UI WC (only the feed plugin)
      if (m.ui) {
        setFeedPlugin(m)
        const path = `plugins/${m.name}/frontend/${m.ui}.js`
        await loadFrontend(path)
      }
    }
  }

  // Helper: inject a JS file as a <script> tag
  async function loadFrontend(path: string) {
    const { code } = await electroview.rpc.request.getPluginFrontend({ path })
    const script = document.createElement("script")
    script.textContent = code
    document.body.appendChild(script)
  }

  // Step 3: Mount the feed-widget once its frontend is loaded
  useEffect(() => {
    if (!feedPlugin?.ui) return
    const tag = feedPlugin.ui
    customElements.whenDefined(tag).then(() => {
      const existing = document.getElementById("feed-container")
      if (!existing) return
      existing.innerHTML = ""
      const el = document.createElement(tag)
      el.manifests = manifestsRef.current 
      existing.appendChild(el)
    })
  }, [feedPlugin])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <h1 className="text-5xl font-bold text-center text-white mb-10 drop-shadow-lg">
          Electro Plugins
        </h1>
        <div id="feed-container" />
        {/* feed-widget is mounted here by the useEffect above */}
      </div>
    </div>
  )
}