import { hasImageProvider } from "@/lib/env";
import { FalProvider } from "@/lib/providers/fal";
import type { ImageProvider } from "@/lib/providers/types";

export type { ImageProvider } from "@/lib/providers/types";
export { FakeProvider } from "@/lib/providers/fake";

export function getImageProvider(): ImageProvider | null {
  if (!hasImageProvider()) return null;
  return new FalProvider();
}
