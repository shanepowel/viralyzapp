export const AD_FORMATS = ["image", "video"] as const;

export type AdFormat = (typeof AD_FORMATS)[number];

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(?:$|\?)/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)(?:$|\?)/i;

export function isAdFormat(value: string | null | undefined): value is AdFormat {
  return value === "image" || value === "video";
}

/** Image or video from a content type. Anything else is unknown. */
export function formatFromContentType(contentType: string | null | undefined): AdFormat | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return null;
}

/** Image or video when the URL path is a media file. A normal page URL is unknown. */
export function formatFromUrl(url: string | null | undefined): AdFormat | null {
  if (!url) return null;
  const path = url.split("#")[0] ?? url;
  if (VIDEO_EXT.test(path)) return "video";
  if (IMAGE_EXT.test(path)) return "image";
  return null;
}

function metaContent(html: string, key: string): string | null {
  const tagRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const tag = match[0];
    const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (prop !== key) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim();
    if (content) return content;
  }
  return null;
}

/**
 * Video wins over a poster image: a page that embeds a video creative is a
 * video ad even when it also has og:image. A page with neither stays unknown.
 */
export function formatFromHtml(html: string | null | undefined): AdFormat | null {
  if (!html) return null;
  const ogType = metaContent(html, "og:type")?.toLowerCase() ?? "";
  const videoUrl = metaContent(html, "og:video") ?? metaContent(html, "og:video:url") ?? metaContent(html, "og:video:secure_url");
  if (videoUrl || ogType.startsWith("video") || /<video\b/i.test(html) || metaContent(html, "twitter:player:stream")) {
    return "video";
  }
  if (metaContent(html, "og:image") || metaContent(html, "twitter:image")) return "image";
  return null;
}

/** Prefer an explicit page signal, then the URL, then the file type. */
export function resolveAdFormat(input: {
  contentType?: string | null;
  url?: string | null;
  html?: string | null;
}): AdFormat | null {
  return formatFromHtml(input.html) ?? formatFromUrl(input.url) ?? formatFromContentType(input.contentType);
}
