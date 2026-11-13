import { describe, expect, it } from "vitest";
import { formatFromContentType, formatFromHtml, formatFromUrl, resolveAdFormat } from "@/lib/ad-format";

describe("ad format", () => {
  it("reads image and video content types and ignores the rest", () => {
    expect(formatFromContentType("image/png")).toBe("image");
    expect(formatFromContentType("video/mp4; codecs=avc1")).toBe("video");
    expect(formatFromContentType("text/html")).toBeNull();
  });

  it("reads a media file URL and leaves a normal page unknown", () => {
    expect(formatFromUrl("https://cdn.example.com/ads/launch.mp4?v=1")).toBe("video");
    expect(formatFromUrl("https://cdn.example.com/ads/launch.png")).toBe("image");
    expect(formatFromUrl("https://shop.example.com/products/candle")).toBeNull();
  });

  it("treats a page with a video creative as video even when it has a poster", () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/poster.jpg">
      <meta property="og:video" content="https://cdn.example.com/ad.mp4">`;
    expect(formatFromHtml(html)).toBe("video");
  });

  it("treats a page with only a lead image as an image", () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/ad.jpg">`;
    expect(formatFromHtml(html)).toBe("image");
    expect(formatFromHtml("<html></html>")).toBeNull();
  });

  it("lets the page override a file extension", () => {
    expect(
      resolveAdFormat({
        url: "https://cdn.example.com/ad.png",
        html: `<meta property="og:type" content="video.other">`,
      }),
    ).toBe("video");
  });
});
