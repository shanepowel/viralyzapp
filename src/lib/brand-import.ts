export type BrandDraft = {
  name: string;
  title: string | null;
  price: string | null;
  currency: string | null;
  imageUrls: string[];
  colors: string[];
};

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    "i",
  );
  const match = html.match(re) ?? html.match(reversed);
  return match ? match[1].trim() || null : null;
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
        if (item && typeof item === "object") blocks.push(item as Record<string, unknown>);
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

  const offers = product?.offers as Record<string, unknown> | undefined;
  const brand = product?.brand as Record<string, unknown> | string | undefined;
  const brandName = typeof brand === "string" ? brand : (brand?.name as string | undefined);

  const title =
    (product?.name as string | undefined) ?? ogTitle ?? null;
  const price =
    offers?.price != null && offers.price !== "" ? String(offers.price) : null;
  const currency = (offers?.priceCurrency as string | undefined) ?? null;

  const imageUrls = [
    ...(product?.image
      ? Array.isArray(product.image)
        ? (product.image as string[])
        : [product.image as string]
      : []),
    ...(ogImage ? [ogImage] : []),
  ].filter((url, i, all) => all.indexOf(url) === i);

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
