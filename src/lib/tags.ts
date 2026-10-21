import { prisma } from "@/lib/prisma";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSuffix(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** vz_<4 lowercase base36 chars>, retried on collision against Creative.tag. */
export async function newTag(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const tag = `vz_${randomSuffix()}`;
    const existing = await prisma.creative.findUnique({ where: { tag }, select: { id: true } });
    if (!existing) return tag;
  }
  throw new Error("Could not generate a unique tag after 10 attempts");
}
