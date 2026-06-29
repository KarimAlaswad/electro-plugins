import { useState, useEffect, useRef } from "react"

// -- What a feed source looks like (derived from PluginManifest.feeds) --
interface FeedSource {
  name: string    // plugin name, e.g. "youtube-explorer"
  card: string    // WC tag, e.g. "yt-video-card"
  method: string  // RPC method, e.g. "youtube.feed"
  methods: string[]
}

// -- One item in the merged feed --
interface FeedItem {
  plugin: FeedSource  // which source this came from
  data: any           // the raw item data (shape is plugin-specific)
}

interface FeedProps {
  manifests: any[]    // received from the WC wrapper's .manifests setter
}

export default function Feed({ manifests }: FeedProps) {
  const [sources, setSources] = useState<FeedSource[]>([])            // plugins with feeds
  const [items, setItems] = useState<FeedItem[]>([])                  // merged items
  const [errors, setErrors] = useState<Record<string, string>>({})    // per-plugin errors
  const [loading, setLoading] = useState(true)       // loading spinner
  const [systemError, setSystemError] = useState<string | null>(null)   // fatal error 
  const mountedRef = useRef(true)   // cleanup guard

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!manifests || manifests.length === 0) {
      setLoading(false)
      return
    }
    loadFeed()
  }, [manifests])

  async function loadFeed() {
    setLoading(true)
    setSystemError(null)
    setErrors({})

    // Step 1: Filter manifests to plugins that have feeds
    const feedSources: FeedSource[] = manifests
      .filter((m: any) => m.feeds)
      .map((m: any) => ({
        name: m.name,
        card: m.feeds.card,
        method: m.feeds.method,
        methods: m.methods || [],
      }))
    setSources(feedSources)

    // Step 2: If no sources, stop
    if (feedSources.length === 0) {
      setLoading(false)
      return 
    }

    // Step 3: Call each source's feed method (all at once)
    const results = await Promise.allSettled(
      feedSources.map(s =>
        window.__pluginRpc(s.method, {}).then((data: any) => ({
          name: s.name,
          items: Array.isArray(data) ? data : []
        }))
      )
    )

    // Step 4: Separate successes and failures
    const newItems: FeedItem[] = []
    const newErrors: Record<string, string> = {}

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const source = feedSources[i]

      if (result.status === "fulfilled") {
        for (const item of result.value.items) {
          newItems.push({ plugin: source, data: item })
        }
      } else {
        newErrors[source.name] = result.reason?.message || "Unknown error"
      }
    }

    // Step 5: Update state (only if still mounted)
    if (mountedRef.current) {
      setItems(newItems)
      setErrors(newErrors)
      setLoading(false)
    }
  }

  // ---- Render per state ----

  // State 1: System error
  if (systemError) {
    return (
      <div className="bg-red-100 border border-red-400 rounded-lg p-4">
        <p className="text-red-700 font-medium">Failed to load feed</p>
        <p className="text-red-600 text-sm mt-1">{systemError}</p>
        <button
          onClick={loadFeed}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry 
        </button>
      </div>
    )
  }

  // State 2: Loading (with no existing items)
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-white rounded-full border-t-transparent" />
        <p className="ml-3 text-white text-lg">Loading feed...</p>
      </div>
    )
  }

  // State 3: Empty (no sources, not loading)
  if (!loading && sources.length === 0) {
    return (
      <div className="text-center py-12 text-white">
        <p className="text-2xl mb-2">No feed sources</p>
        <p className="text-white/70">Install plugins to populate your feed.</p>
      </div>
    )
  }

  // State 4 + 5: Partial / Loaded - show items with error banners
  const hasErrors = Object.keys(errors).length > 0

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-white text-sm">
          {items.length} item{items.length !== 1 ? "s" : ""}
          {hasErrors && ` (${Object.keys(errors).length} source${Object.keys(errors).length !== 1 ? "s" : ""} failed)`}
        </p>
        <button
          onClick={loadFeed}
          disabled={loading}
          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Error banners per plugin */}
      {Object.entries(errors).map(([name, msg]) => {
        const source = sources.find(s => s.name === name)
        const loginMethod = source?.methods.find(m => m.endsWith(".auth.login"))

        return (
          <div
            key={name}
            className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-3"
          >
            <p className="text-yellow-800 font-medium text-sm">{name}</p>
            <p className="text-yellow-700 text-xs mt-1">{msg}</p>
            {loginMethod && (
              <button
                onClick={async () => {
                  try {
                    await window.__pluginRpc(loginMethod, {});
                    loadFeed();
                  } catch (e: any) {
                    alert("Sign in failed: " + e.message);
                  }
                }}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
              >
                Sign in
              </button>
            )}
          </div>
        );
      })}

      {/* Card items */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-white/70">
          No items to display
        </div>
      ) : (
        items.map((item, i) => (
          <CardRenderer
            key={`${item.plugin.name}-${i}`}
            plugin={item.plugin}
            data={item.data}
          />
        ))
      )}
    </div>
  )
}

// -- Helper component: creates a card WC and passes data to it --
function CardRenderer({ plugin, data }: { plugin: FeedSource; data: any }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return 

    const tag = plugin.card
    const container = ref.current

    customElements.whenDefined(tag).then(() => {
      if (!container.isConnected) return // component unmounted while loading
      const card = document.createElement(tag)
      card.item = data
      container.appendChild(card)
    })

    // Cleanup: remove all children on unmount or re-render
    return () => { container.innerHTML = "" }
  }, [plugin.card, data])

  return <div ref={ref} className="mb-2" />
}