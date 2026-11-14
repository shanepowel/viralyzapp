/**
 * Sample material for a new account, so Discover and Brand are not blank
 * before any real source is connected. Every brand here is fictional and
 * every image is drawn for Viralyz; the interface always says so.
 */

export type SampleReference = {
  id: string;
  advertiser: string;
  image: string;
  format: "image";
  structure: { hookType: string; offerType: string; layout: string; cta: string };
};

export const SAMPLE_REFERENCES: SampleReference[] = [
  {
    id: "halden",
    advertiser: "Halden",
    image: "/samples/ref-halden.png",
    format: "image",
    structure: { hookType: "benefit_statement", offerType: "none", layout: "product_hero", cta: "shop_now" },
  },
  {
    id: "rove",
    advertiser: "Rove Coffee",
    image: "/samples/ref-rove.png",
    format: "image",
    structure: { hookType: "daily_routine", offerType: "subscribe_and_save", layout: "centred_product", cta: "subscribe" },
  },
  {
    id: "pepa",
    advertiser: "Pepa",
    image: "/samples/ref-pepa.png",
    format: "image",
    structure: { hookType: "new_launch", offerType: "none", layout: "bold_type", cta: "none" },
  },
  {
    id: "nordlys",
    advertiser: "Nordlys",
    image: "/samples/ref-nordlys.png",
    format: "image",
    structure: { hookType: "question", offerType: "free_delivery", layout: "product_hero", cta: "none" },
  },
  {
    id: "ostra",
    advertiser: "Ostra",
    image: "/samples/ref-ostra.png",
    format: "image",
    structure: { hookType: "question", offerType: "bundle", layout: "split", cta: "build_a_bundle" },
  },
  {
    id: "korn",
    advertiser: "Korn & Co",
    image: "/samples/ref-korn.png",
    format: "image",
    structure: { hookType: "customer_quote", offerType: "percent_off", layout: "testimonial", cta: "none" },
  },
];

export function getSampleReference(id: string): SampleReference | undefined {
  return SAMPLE_REFERENCES.find((s) => s.id === id);
}

/** The reference row a sample becomes when someone uses it. */
export const sampleSourceRef = (id: string) => `sample:${id}`;

/** A fictional brand to try the product with. The image path is made absolute by the caller. */
export const SAMPLE_BRAND = {
  name: "Halden",
  colors: ["#1E3A2A", "#D5E5D8", "#F4F1EA"],
  voice: "Calm, plain-spoken, a little dry",
  product: { title: "Oat cleanser", price: "24.00", currency: "GBP", image: "/samples/halden-cleanser.png" },
} as const;
