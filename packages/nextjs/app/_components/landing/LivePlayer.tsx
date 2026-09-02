import { YOUTUBE_EMBED_URL } from "./event";

// Live autoplays muted, which is the only autoplay browsers allow. The replay
// waits for a click: nobody wants a finished race to start talking on its own.
export function LivePlayer({ live }: { live: boolean }) {
  if (!YOUTUBE_EMBED_URL) return null;

  return (
    <div
      className={`w-full max-w-4xl overflow-hidden rounded-lg border bg-black ${
        live
          ? "border-[#00ff9c]/40 shadow-[0_0_40px_rgba(0,255,156,0.15)]"
          : "border-[#00FBFF]/25 shadow-[0_0_40px_rgba(0,251,255,0.08)]"
      }`}
    >
      <div className="relative aspect-video">
        <iframe
          src={`${YOUTUBE_EMBED_URL}?rel=0${live ? "&autoplay=1&mute=1" : ""}`}
          title={live ? "Agents Arena live stream" : "Agents Arena replay"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
