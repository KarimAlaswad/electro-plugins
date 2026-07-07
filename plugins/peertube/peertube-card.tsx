export default function PeerTubeCard({ item }: { item: any }) {
  if (!item) return <div className="text-gray-400 p-4 text-sm">Loading...</div>

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleClick = async () => {
    if (item.embedUrl) {
      await window.__pluginRpc('video-player.load', {
        url: item.embedUrl + "?autoplay=1",
        title: item.title,
      })
      window.dispatchEvent(new CustomEvent("player-load", {
        detail: { url: item.embedUrl + "?autoplay=1", title: item.title }
      }))
    }
  }

  return (
    <div
      onClick={handleClick}
      className="flex gap-3 p-3 bg-white rounded-lg shadow items-start cursor-pointer hover:bg-gray-50 transition-colors"
    >
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt={item.title}
          className="w-[120px] h-[60px] object-cover rounded flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-gray-900 truncate">
          {item.title}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {item.channel}
          {item.views ? ` . ${item.views} views` : ""}
          {item.duration ? ` . ${formatDuration(item.duration)}` : ""}
        </p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {item.category && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">
              {item.category}
            </span>
          )}
          {item.licence && (
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">
              {item.licence}
            </span>
          )}
          {item.language && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
              {item.language}
            </span>
          )}
        </div>
        {item.published && (
          <p className="mt-1 text-[10px] text-gray-400">{item.published}</p>
        )}
      </div>
    </div>
  )
}