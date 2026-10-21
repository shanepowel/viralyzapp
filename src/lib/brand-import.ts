export type BrandDraft = {
  name: string;
  title: string | null;
  price: string | null;
  currency: string | null;
  imageUrls: string[];
  colors: string[];
};

// Attribute values can use either quote style, and a double-quoted value may
// itself contain an apostrophe (or vice versa). A single character class
// shared between both quote styles truncates at whichever mark comes first,
// so each quote style gets its own alternative instead.
function parseTagAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  }
  return attrs;
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const tagRe = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const attrs = parseTagAttrs(m[0]);
    if (attrs[attr] === key) {
      return attrs.content?.trim() || null;
    }
  }
  return null;
}

function jsonLdProducts(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        blocks.push(item as Record<string, unknown>);
        // A top-level @graph wraps the real nodes (Product among them) one
        // level deeper — collect those too instead of only the wrapper.
        const graph = (item as Record<string, unknown>)["@graph"];
        if (Array.isArray(graph)) {
          for (const node of graph) {
            if (node && typeof node === "object") blocks.push(node as Record<string, unknown>);
          }
        }
      }
    } catch {
      // Not valid JSON — skip this block rather than fail the whole page.
    }
  }
  return blocks;
}

function findProduct(blocks: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const block of blocks) {
    const type = block["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes("Product")) return block;
  }
  return null;
}

function hostnameFallbackName(pageUrl: string): string {
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "Untitled brand";
  }
}

export function extractBrand(html: string, pageUrl: string): BrandDraft {
  const products = jsonLdProducts(html);
  const product = findProduct(products);

  const ogTitle = metaContent(html, "property", "og:title");
  const ogSiteName = metaContent(html, "property", "og:site_name");
  const ogImage = metaContent(html, "property", "og:image");
  const themeColor = metaContent(html, "name", "theme-color");

  // A Product can list multiple Offers (e.g. per size/color); take the first
  // rather than reading price/priceCurrency off the array itself.
  const offersRaw = product?.offers;
  const offers = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as
    | Record<string, unknown>
    | undefined;
  const brand = product?.brand as Record<string, unknown> | string | undefined;
  const brandName = typeof brand === "string" ? brand : (brand?.name as string | undefined);

  const title =
    (product?.name as string | undefined) ?? ogTitle ?? null;
  const price =
    offers?.price != null && offers.price !== "" ? String(offers.price) : null;
  const currency = (offers?.priceCurrency as string | undefined) ?? null;

  // An `image` entry can be a plain URL string or a Schema.org ImageObject
  // (or a mix, or an array of either) — pull the URL out of the object form
  // instead of pushing the object itself into a string[].
  function imageUrlOf(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const url = (value as Record<string, unknown>).url ?? (value as Record<string, unknown>).contentUrl;
      if (typeof url === "string") return url;
    }
    return null;
  }
  const rawImages = product?.image
    ? Array.isArray(product.image)
      ? (product.image as unknown[])
      : [product.image]
    : [];
  const productImageUrls = rawImages.map(imageUrlOf).filter((url): url is string => Boolean(url));

  const imageUrls = [...productImageUrls, ...(ogImage ? [ogImage] : [])].filter(
    (url, i, all) => all.indexOf(url) === i,
  );

  const colors = themeColor ? [themeColor] : [];

  return {
    name: brandName || ogSiteName || hostnameFallbackName(pageUrl),
    title,
    price,
    currency,
    imageUrls,
    colors,
  };
}
