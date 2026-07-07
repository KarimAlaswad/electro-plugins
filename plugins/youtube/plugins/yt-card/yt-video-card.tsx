export default function YTVideoCard({ item }: { item: any }) {
  if (!item) return <div className="text-gray-400 p-4 text-sm">Loading...</div>;

  const handleClick = async () => {
    const url = `https://www.youtube.com/embed/${item.videoId}`;
    await window.__pluginRpc("video-player.load", { url, title: item.title });
    window.dispatchEvent(
      new CustomEvent("player-load", { detail: { url, title: item.title } }),
    );
  };

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
          {item.views ? ` . ${item.views}` : ""}
          {item.published ? ` . ${item.published}` : ""}
        </p>
      </div>
    </div>
  );
}
