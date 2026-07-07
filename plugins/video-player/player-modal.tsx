import { useEffect, useState } from "react";

export default function PlayerModal() {
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    // This listener handles the RPC-triggered 'load' event
    const handleLoad = (e: any) => setPlaying(e.detail);
    window.addEventListener("player-load", handleLoad);
    return () => window.removeEventListener("player-load", handleLoad);
  }, []);

  if (!playing) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={() => setPlaying(null)}
    >
      <video src={playing.url} controls autoPlay className="max-w-4xl" />
    </div>
  );
}
