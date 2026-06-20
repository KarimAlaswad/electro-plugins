import { useState, useEffect, useRef } from "react"
import { Electroview } from "electrobun/view"
import type { PluginInfo, PluginManifest } from "../shared/types"


const electroview = new Electroview({
	rpc: Electroview.defineRPC({ handlers: { requests: {}, messages: {} } }),
})

// Global bridge - Web Components call this instead of importing Electrobun
window.__pluginRpc = async (method: string, params: any) => {
  const res = await electroview.rpc?.request.pluginRequest({ method, params })
  return res.data 
}

const loadedPlugins = new Set<string>();


function WebComponentSlot({ tag }: { tag: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const el = document.createElement(tag);
    ref.current.appendChild(el);
  }, [tag]);
  return <div ref={ref} />;
}

function App() {
  const [manifests, setManifests] = useState<PluginManifest[]>([])
	const [plugins, setPlugins] = useState<PluginInfo[]>([])
	const [result, setResult] = useState("")
	const [loading, setLoading] = useState<string | null>(null)


	useEffect(() => { loadManifests(); loadPlugins() }, [])

  useEffect(() => {
    if (manifests.length === 0) return
    loadAllFrontends()
  }, [manifests])

  async function loadAllFrontends() {
    for (const m of manifests) {
      if (!m.frontendComponent) continue
      if (loadedPlugins.has(m.name)) continue 
      loadedPlugins.add(m.name)
      try {
        const { code } = await electroview.rpc?.request.getPluginFrontend({ name: m.name })
        const script = document.createElement("script")
        script.textContent = code 
        document.body.appendChild(script)
      } catch (e) {
        setResult("Error loading frontend for " + m.name + ": " + (e as Error).message)
      }
    }
  }

  async function loadManifests() {
    try {
      setManifests(await electroview.rpc.request.getPluginManifests({}))
    } catch (e: any) {
      setResult("Error: " + e.message)
    }
  }

	async function loadPlugins() {
		try {
			setPlugins(await electroview.rpc.request.pluginList({}))
		} catch (e: any) {
			setResult("Error: " + e.message)
		}
	}

	async function callMethod(method: string, params: any = {}) {
		setLoading(method)
		setResult("")
		try {
			const res = await electroview.rpc.request.pluginRequest({ method, params })
			setResult(JSON.stringify(res, null, 2))
		} catch (e: any) {
			setResult("Error: " + e.message)
		} finally {
			setLoading(null)
		}
	}

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-5xl font-bold text-center text-white mb-10 drop-shadow-lg">
          Electro Plugins
        </h1>
        {plugins.map((p) => { 
          const manifest = manifests.find(m => m.name === p.name)
          return (
            <div key={p.name} className="bg-white rounded-xl shadow-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-indigo-600">
                  {p.name}
                </h2>
                {manifest && (
                  <p className="text-sm text-gray-500">
                    {manifest.description} - v{manifest.version}
                  </p>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    p.alive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {p.alive ? "● Alive" : "● Dead"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {p.methods.map((m) => (
                  <button
                    key={m}
                    onClick={() => callMethod(m)}
                    disabled={loading !== null}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {m}
                  </button>
                ))}
                {manifest?.frontendComponent && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <WebComponentSlot tag={manifest.frontendComponent} />
                  </div>
                )}
              </div>
            </div>
        )})}
        {result && (
          <div className="bg-white rounded-xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-indigo-600 mb-3">
              Result
            </h2>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App