import { hasImageProvider, imageProviderName } from "@/lib/env";
import { FakeProvider } from "@/lib/providers/fake";
import { FalProvider } from "@/lib/providers/fal";
import type { ImageProvider } from "@/lib/providers/types";

export type { ImageProvider } from "@/lib/providers/types";
export { FakeProvider } from "@/lib/providers/fake";

export function getImageProvider(): ImageProvider | null {
  // IMAGE_PROVIDER=fake lets local/staging runs exercise the full generation
  // pipeline (including a real Anthropic call for copy) without spending on
  // real image generation — never a value this app would pick on its own.
  if (imageProviderName() === "fake") return new FakeProvider();
  if (!hasImageProvider()) return null;
  return new FalProvider();
}
