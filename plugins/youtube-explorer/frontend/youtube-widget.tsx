import { useState, useRef, useEffect } from "react" 
import { createRoot, type Root } from "react-dom/client" 

export default function YoutubeUI() {
  const [query, setQuery] = useState("")
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [feed, setFeed] = useState<any[] | null>(null)
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const feedLoadedRef = useRef(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountName, setAccountName] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await window.__pluginRpc("youtube.auth.status", {})
        if (res.loggedIn) {
          setLoggedIn(true)
          setAccountName(res.accountName || null)
          loadFeed()
        }
      } catch {}
    })()
  }, [])

  async function loadFeed() {
    if (feedLoadedRef.current) return;
    feedLoadedRef.current = true;
    try {
      const res = await window.__pluginRpc("youtube.feed", {});
      setFeed(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function signIn() {
    setError(null)
    try {
      const res = await window.__pluginRpc("youtube.auth.login", {})
      setLoggedIn(true)
      setAccountName(res.accountName || null)
      loadFeed()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function signOut() {
    try {
      await window.__pluginRpc("youtube.auth.logout", {})
    } catch {}
    setLoggedIn(false)
    setAccountName(null)
    setFeed(null)
    feedLoadedRef.current = false;
  }

  async function search() {
    if (!query.trim()) return 
    setLoading(true) 
    setError(null) 
    setResults(null) 
    
    try {
      const res = await window.__pluginRpc("youtube.search", { query }) 
      setResults(Array.isArray(res) ? res : [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false) 
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") search()
  }

  return (
    <div className="font-sans">
      {playingVideo && (
        <div className="mb-4">
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${playingVideo}`}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              className="w-full h-full"
              allowFullScreen
            />
          </div>
          <button
            onClick={() => setPlayingVideo(null)}
            className="mt-1 text-xs text-gray-500 hover:text-red-600"
          >
            x Close
          </button>
        </div>
      )}

      {!loggedIn  && (
        <div className="mb-3 p-3 border border-gray-200 rounded-md bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">Sign in to Youtube to see your feed</p>
          <button onClick={signIn}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer">
              Sign in with Google
          </button>
          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
        </div>
      )}

      {loggedIn && (
        <div className="mb-3 p-3 border border-green-200 rounded-md bg-green-50 flex items-center justify-between">
          <p className="text-sm text-green-800">
          ✓ Connected{accountName ? ` as ${accountName}` : ""}
          </p>
          <button onClick={signOut}
            className="text-xs text-red-600 hover:underline cursor-pointer">
              Disconnect
            </button>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search YouTube..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-red-500 transition-colors"
        />
        <button
          onClick={search}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-sm font-semibold text-white transition-colors ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 cursor-pointer"}`}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {loggedIn && !results && feed && feed.length > 0 && (
        <div>
          {feed.map((v: any) => (
            <div
              key={v.videoId}
              className="flex gap-3 py-2 border-b border-gray-100 items-start"
            >
              {v.thumbnail && (
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-[120px] h-[68px] object-cover rounded flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="m-0 font-semibold text-sm text-gray-900 truncate">
                  {v.title}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {v.channel}
                  {v.views ? ` . ${v.views}` : ""}
                  {v.published ? ` . ${v.published}` : ""}
                </p>
                <button
                  onClick={() => setPlayingVideo(v.videoId)}
                  className="text-xs text-red-600 hover:underline mt-1"
                >
                  ▶ Watch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!results && feed === null && !error && loggedIn && (
        <p className="text-gray-400 italic text-sm">Loading feed...</p>
      )}

      {error && !(!loggedIn) && <p className="text-red-600 text-sm my-1">{error}</p>}

      {!loading && results !== null && results.length === 0 && (
        <p className="text-gray-400 italic text-sm">No results found.</p>
      )}

      {results && results.length > 0 && (
        <div>
          {results.map((v: any) => (
            <div
              key={v.videoId}
              className="flex gap-3 py-2 border-b border-gray-100 items-start"
            >
              {v.thumbnail && (
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-[120px] h-[68px] object-cover rounded flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="m-0 font-semibold text-sm text-gray-900 truncate">
                  {v.title}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {v.channel}
                  {v.views ? ` . ${v.views}` : ""}
                </p>
                <button
                  onClick={() => setPlayingVideo(v.videoId)}
                  className="text-xs text-red-600 hover:underline mt-1"
                >
                  ▶ Watch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}