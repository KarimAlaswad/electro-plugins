export default function YTVideoCard({ item }: {item: any }) {
  if (!item) return <div className="text-gray-400 p-4 text-sm">Loading...</div>

  return (
    <div className="flex gap-3 p-3 bg-white rounded-lg shadow items-start">
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt={item.title}
          className="w-[120px] h-[60px] object-cover rounded flex-shrink-0"
        />
      )}
      <div className="min-w-0">
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
  )
}