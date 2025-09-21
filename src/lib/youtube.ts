// Utility to extract a YouTube video ID from a variety of URL formats
// Supports:
// - https://www.youtube.com/watch?v=VIDEO_ID
// - https://youtu.be/VIDEO_ID
// - https://www.youtube.com/shorts/VIDEO_ID
// - https://www.youtube.com/embed/VIDEO_ID
// - https://www.youtube.com/live/VIDEO_ID
// Falls back to returning the input if it already looks like an ID.
export function extractVideoId(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // If it already looks like an ID, return as-is.
  // YouTube video IDs are typically 11 chars [A-Za-z0-9_-], but allow slight variance.
  const idLike = /^[A-Za-z0-9_-]{6,15}$/;
  if (idLike.test(raw)) return raw;

  // Try to parse as URL
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    // youtu.be/<id>
    if (host === "youtu.be") {
      const seg = url.pathname.split("/").filter(Boolean)[0];
      return seg ?? null;
    }

    // youtube.com/*
    if (host.endsWith("youtube.com")) {
      const path = url.pathname.replace(/\/+$/, "");
      // /watch?v=<id>
      if (path === "/watch") {
        const v = url.searchParams.get("v");
        return v ?? null;
      }
      // /shorts/<id>, /embed/<id>, /live/<id>
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2 && ["shorts", "embed", "live"].includes(parts[0])) {
        return parts[1] ?? null;
      }
    }

    // Not a recognized YouTube URL
    return null;
  } catch {
    // Not a URL. If it's not ID-like, return null
    return idLike.test(raw) ? raw : null;
  }
}

export function buildThumbnailUrl(videoId: string, quality: "default" | "mq" | "hq" | "sd" | "max" = "hq"): string {
  const map = { default: "default", mq: "mqdefault", hq: "hqdefault", sd: "sddefault", max: "maxresdefault" } as const;
  const q = map[quality] ?? map.hq;
  return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`;
}

export function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

