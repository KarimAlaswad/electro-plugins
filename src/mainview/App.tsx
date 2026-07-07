import { useState, useEffect } from "react"
import { Electroview } from "electrobun/view"
import type { PluginManifest } from "../shared/types"

const electroview = new Electroview({
  rpc: Electroview.defineRPC({
    maxRequestTime: 20000,
    handlers: { requests: {}, messages: {} },
  }),
})

// -- Globals --
window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params })
  if (!res.success) throw new Error(res.error || "RPC error")
    return res.data 
}

window.resolveHook = async (hook: string) => {
  const res = await electroview.rpc.request.resolveHook({ hook })
  if (!res.success) throw new Error(res.error || "Hook resolution failed")
  return res.data
}

window.callHook = async (hook: string, methodOrArgs: any, args?: any) => {
  const method = args !== undefined ? methodOrArgs : undefined
  const params = args !== undefined ? args : methodOrArgs
  const res = await electroview.rpc.request.callHook({ hook, method, params })
  if (!res.success) throw new Error(res.error || "callHook failed")
  return res.data 
}

export default function App() {
  const [manifests, setManifests] = useState<PluginManifest[]>([])

  useEffect(() => {
    init().catch(e => {
      console.error("[app] init() failed:", e)
      const c = document.getElementById("feed-container")
      if (c) c.innerHTML = `<p style="color:red;padding:20px;font-family:monospace">Init error: ${e.message}</p>`
    })
  }, [])
  async function init() {
    console.log("[app] init: fetching manifests...")
    const all: PluginManifest[] = await electroview.rpc.request.getPluginManifests({})
    console.log("[app] manifests received:", all.map(m => `${m.name}${m.feeds?.length ? " (feeds)" : ""}${m.ui ? " (ui:"+m.ui+")" : ""}${m.hooks?.length ? " (hooks:"+m.hooks+")" : ""}`))
    setManifests(all)

    const loaded = new Set<string>()
    const uiPlugins: PluginManifest[] = []
    for (const m of all) {
      for (const f of (m.feeds || [])) {
        if (f.card && !loaded.has(f.card)) {
          loaded.add(f.card)
          console.log(`[app] loading card: ${f.card}`)
          await loadFrontend(`build/plugins/${f.card}.js`)
        }
      }
      if (m.ui) {
        uiPlugins.push(m)
        if (!loaded.has(m.ui)) {
          loaded.add(m.ui)
          console.log(`[app] loading ui: ${m.ui}`)
          await loadFrontend(`build/plugins/${m.ui}.js`)
        }
      }
    }

    // Create WC elements directly, outside React's VDOM
    const container = document.getElementById("feed-container")
    if (container) {
      container.innerHTML = ""
      for (const m of uiPlugins) {
        const tag = m.ui!
        await customElements.whenDefined(tag)
        const el = document.createElement(tag)
        el.manifests = all
        container.appendChild(el)
      }
    }
    console.log("[app] init complete, ui plugins:", uiPlugins.map(p => p.ui).join(", ") || "none")
  }

  async function loadFrontend(path: string) {
    const res = await electroview.rpc.request.getPluginFrontend({ path })
    if (res.error) throw new Error(`loadFrontend(${path}): ${res.error}`)
    const script = document.createElement("script")
    script.textContent = res.code
    document.body.appendChild(script)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <h1 className="text-5xl font-bold text-center text-white mb-10 drop-shadow-lg">
          Electro Plugins
        </h1> 
        <div id="feed-container" />
      </div>
    </div>
  )
}