import { describe, expect, it } from "vitest";
import { extractBrand } from "@/lib/brand-import";

const OG_ONLY_PAGE = `
<!doctype html>
<html>
<head>
  <meta property="og:title" content="Hand-Poured Soy Candle">
  <meta property="og:site_name" content="Hearth & Wick">
  <meta property="og:image" content="https://cdn.example.com/candle.jpg">
  <meta name="theme-color" content="#4b2e2e">
</head>
<body></body>
</html>
`;

const JSON_LD_PRODUCT_PAGE = `
<!doctype html>
<html>
<head>
  <meta property="og:site_name" content="Fallback Store">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Ceramic Pour-Over Dripper",
    "image": ["https://cdn.example.com/dripper-1.jpg", "https://cdn.example.com/dripper-2.jpg"],
    "brand": { "@type": "Brand", "name": "Kiln & Bean" },
    "offers": {
      "@type": "Offer",
      "price": "38.00",
      "priceCurrency": "USD"
    }
  }
  </script>
</head>
<body></body>
</html>
`;

const NO_PRICE_PAGE = `
<!doctype html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@type": "Product",
    "name": "Coming Soon Tee",
    "brand": "Nomad Thread"
  }
  </script>
</head>
<body></body>
</html>
`;

describe("extractBrand", () => {
  it("reads Open Graph tags when there is no JSON-LD", () => {
    const draft = extractBrand(OG_ONLY_PAGE, "https://hearthandwick.example.com/");
    expect(draft.name).toBe("Hearth & Wick");
    expect(draft.title).toBe("Hand-Poured Soy Candle");
    expect(draft.imageUrls).toEqual(["https://cdn.example.com/candle.jpg"]);
    expect(draft.colors).toEqual(["#4b2e2e"]);
    expect(draft.price).toBeNull();
    expect(draft.currency).toBeNull();
  });

  it("prefers JSON-LD Product data over Open Graph", () => {
    const draft = extractBrand(JSON_LD_PRODUCT_PAGE, "https://kilnandbean.example.com/products/dripper");
    expect(draft.name).toBe("Kiln & Bean");
    expect(draft.title).toBe("Ceramic Pour-Over Dripper");
    expect(draft.price).toBe("38.00");
    expect(draft.currency).toBe("USD");
    expect(draft.imageUrls).toEqual([
      "https://cdn.example.com/dripper-1.jpg",
      "https://cdn.example.com/dripper-2.jpg",
    ]);
  });

  it("leaves price null rather than 0 when the page has none", () => {
    const draft = extractBrand(NO_PRICE_PAGE, "https://nomadthread.example.com/");
    expect(draft.name).toBe("Nomad Thread");
    expect(draft.title).toBe("Coming Soon Tee");
    expect(draft.price).toBeNull();
    expect(draft.price).not.toBe("0");
    expect(draft.currency).toBeNull();
  });

  it("falls back to the hostname when no name signal is present", () => {
    const draft = extractBrand("<html><head></head><body></body></html>", "https://www.plainshop.example.com/");
    expect(draft.name).toBe("Plainshop");
    expect(draft.title).toBeNull();
    expect(draft.imageUrls).toEqual([]);
    expect(draft.colors).toEqual([]);
  });
});
