import type { Placement } from "@/lib/preflight/types";

/**
 * Placement specs, each sourced from the platform's own published ad specs
 * rather than guessed. Char limits are the platforms' recommended maximums
 * (what their own ad managers warn about), not hard technical ceilings.
 */
export const PLACEMENTS: Record<Placement["id"], Placement> = {
  meta_feed_1x1: {
    id: "meta_feed_1x1",
    width: 1080,
    height: 1080,
    // Feed placements aren't covered by a UI overlay, so there's no
    // platform-mandated safe-zone margin.
    safeZone: { top: 0, bottom: 0, left: 0, right: 0 },
    headlineMax: 40,
    primaryMax: 125,
    source: "https://www.facebook.com/business/ads-guide/image/feed-image-ads",
  },
  meta_feed_4x5: {
    id: "meta_feed_4x5",
    width: 1080,
    height: 1350,
    safeZone: { top: 0, bottom: 0, left: 0, right: 0 },
    headlineMax: 40,
    primaryMax: 125,
    source: "https://www.facebook.com/business/ads-guide/image/feed-image-ads",
  },
  story_9x16: {
    id: "story_9x16",
    width: 1080,
    height: 1920,
    // Meta's Stories specs keep key content out of the top ~250px (profile
    // chip/close button) and bottom ~250px (reply bar/CTA sticker) of a
    // 1080x1920 canvas.
    safeZone: { top: 250, bottom: 250, left: 54, right: 54 },
    headlineMax: 40,
    primaryMax: 125,
    source: "https://www.facebook.com/business/ads-guide/image/facebook-instagram-stories",
  },
  tiktok_9x16: {
    id: "tiktok_9x16",
    width: 1080,
    height: 1920,
    // TikTok's spec keeps text/logos clear of the top ~150px and bottom
    // ~320px (caption, music info, and engagement buttons overlay the video).
    safeZone: { top: 150, bottom: 320, left: 64, right: 64 },
    // TikTok ad copy is a single text field, not a separate headline —
    // both limits reflect its published 100-character cap.
    headlineMax: 100,
    primaryMax: 100,
    source: "https://ads.tiktok.com/help/article/tiktok-ad-specifications",
  },
};
