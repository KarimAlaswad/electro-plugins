import { useState, useEffect, useRef } from "react"

// -- What a feed source looks like (derived from PluginManifest.feeds) --
interface FeedSource {
  name: string    // plugin name, e.g. "yt-feed"
  card: string    // WC tag, e.g. "yt-video-card"
  method: string  // bare method name, e.g. "feed"
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
    console.log("[feed] loadFeed: manifests.length =", manifests?.length ?? 0)
    setLoading(true)
    setSystemError(null)
    setErrors({})

    // Step 1: Filter manifests to plugins that have feeds
    const feedSources: FeedSource[] = manifests 
      .filter((m: any) => m.feeds && m.feeds.length > 0)
      .flatMap((m: any) => m.feeds.map((f: any) => ({
        name: m.name,
        card: f.card,
        method: f.method || m.methods?.[0],
        methods: m.methods || [],
      })))

    console.log("[feed] sources found:", feedSources.map(s => `${s.name}.${s.method} -> ${s.card}`).join(", ") || "none")
    setSources(feedSources)

    // Step 2: If no sources, stop
    if (feedSources.length === 0) {
      setLoading(false)
      return 
    }

    // -- Safety timer: force-resolve if nothing settles within 20s --
    const safetyTimer = setTimeout(() => {
      console.log("[feed] SAFETY TIMEOUT FIRED at 20s — forcing resolution")
      setLoading(false)
      forceClearLoading()
    }, 20000)

    // Step 3: Call each source's feed method (all at once), with frontend timeout
    const FEED_TIMEOUT = 15000
    const results = await Promise.allSettled(
      feedSources.map(s => {
        const rpcMethod = s.name + "." + s.method
        console.log(`[feed] calling __pluginRpc("${rpcMethod}", {})`)
        console.log(`[feed] __pluginRpc type:`, typeof window.__pluginRpc)
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            console.log(`[feed] per-source timeout fired for ${rpcMethod}`)
            reject(new Error(`Frontend timeout (${FEED_TIMEOUT}ms): ${rpcMethod}`))
          }, FEED_TIMEOUT)
          const rpcPromise = window.__pluginRpc(rpcMethod, {})
          console.log(`[feed] __pluginRpc returned promise:`, typeof rpcPromise?.then)
          rpcPromise.then(
            (data: any) => {
              clearTimeout(timeoutId)
              console.log(`[feed] "${rpcMethod}" success: ${Array.isArray(data) ? data.length : typeof data} items`)
              resolve({ name: s.name, items: Array.isArray(data) ? data : [] })
            },
            (err: any) => {
              clearTimeout(timeoutId)
              console.log(`[feed] "${rpcMethod}" rejection:`, err?.message || err)
              reject(err)
            },
          )
        })
      })
    )

    clearTimeout(safetyTimer)

    // Step 4: Separate successes and failures, then shuffle
    const newItems: FeedItem[] = []
    const newErrors: Record<string, string> = {}

    try {
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const source = feedSources[i]

        if (result.status === "fulfilled") {
          for (const item of result.value.items) {
            newItems.push({ plugin: source, data: item})
          }
        } else {
          const msg = result.reason?.message || "Unknown error"
          console.error(`[feed] "${source.name}.${source.method}" failed:`, msg)
          newErrors[source.name] = msg
        }
      }

      // Fisher-Yates shuffle
      for (let i = newItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newItems[i], newItems[j]] = [newItems[j], newItems[i]]
      }

      // Step 5: Update state unconditionally (ignore mountedRef — 
      //         if component was unmounted/remounted the new ref
      //         will pick up, and React handles the rest)
      console.log("[feed] setting state: items=", newItems.length, "errors=", Object.keys(newErrors).length, "loading=false")
      setItems(newItems)
      setErrors(newErrors)
      setLoading(false)
      console.log("[feed] state set OK")
    } catch (e) {
      console.error("[feed] exception in loadFeed processing:", e)
    }

    // DOM-level kill switch in case React state doesn't take effect
    forceClearLoading()
  }

  function forceClearLoading() {
    const container = document.getElementById("feed-container")
    if (container) {
      const loadingEl = container.querySelector("p")
      if (loadingEl && loadingEl.textContent === "Loading feed...") {
        console.log("[feed] DOM kill switch: removing loading text")
        loadingEl.textContent = "Feed loaded (DOM recovery)"
      }
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
          {hasErrors &&
            ` (${Object.keys(errors).length} source${Object.keys(errors).length !== 1 ? "s" : ""} failed)`}
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
      {/* Error banners per plugin */}
      {Object.entries(errors).map(([name, msg]) => {
        const authPlugin = manifests?.find((m: any) =>
          m.methods?.includes("login"),
        );

        return (
          <div
            key={name}
            className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-3"
          >
            <p className="text-yellow-800 font-medium text-sm">{name}</p>
            <p className="text-yellow-700 text-xs mt-1">{msg}</p>
            {authPlugin && (
              <button
                onClick={async () => {
                  try {
                    await window.__pluginRpc(authPlugin.name + ".login", {});
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
  );
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

  return <div ref={ref} className="mb-2 cursor-pointer" />
}