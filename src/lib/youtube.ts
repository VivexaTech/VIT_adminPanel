const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (VIDEO_ID.test(raw)) return raw;

  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]?.slice(0, 11);
      return id && VIDEO_ID.test(id) ? id : null;
    }

    if (!host.endsWith("youtube.com") && host !== "youtube-nocookie.com") return null;

    const fromQuery = url.searchParams.get("v");
    if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery;

    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => ["embed", "live", "shorts", "v", "watch"].includes(part));
    if (marker >= 0) {
      const next = parts[marker + 1]?.slice(0, 11);
      if (next && VIDEO_ID.test(next)) return next;
    }
  } catch {
    return null;
  }

  return null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string, autoplay = true): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    fs: "1",
    autoplay: autoplay ? "1" : "0",
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}
