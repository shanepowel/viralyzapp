import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { isOAuthConfigured } from "@/lib/oauth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["tiktok", "instagram", "youtube"]),
  handle: z.string().min(1).max(64).optional(),
  /** Force mock connect even when OAuth is configured (local testing). */
  mock: z.boolean().optional(),
});

/**
 * Connect a platform.
 * - When OAuth credentials are set and mock is not forced, returns `{ oauthUrl }` for the client to redirect.
 * - Otherwise creates/updates a Platform row (demo / no-keys path).
 */
export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const { provider, mock } = parsed.data;

    if (isOAuthConfigured(provider) && !mock) {
      return NextResponse.json({
        oauth: true,
        oauthUrl: `/api/platforms/oauth/${provider}/start`,
        provider,
      });
    }

    const handle =
      parsed.data.handle ??
      `@${auth.session.name.replace(/\s+/g, "").toLowerCase()}`;

    const platform = await prisma.platform.upsert({
      where: {
        userId_provider_handle: {
          userId: auth.session.userId,
          provider,
          handle,
        },
      },
      create: {
        userId: auth.session.userId,
        provider,
        handle,
        syncStatus: "ok",
      },
      update: {
        syncStatus: "ok",
        connectedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      oauth: false,
      platform,
      message: `Connected ${provider} as ${handle}${isOAuthConfigured(provider) ? "" : " (demo connect — add OAuth env vars for real tokens)"}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const platforms = await prisma.platform.findMany({
    where: { userId: auth.session.userId },
    orderBy: { connectedAt: "desc" },
    select: {
      id: true,
      provider: true,
      handle: true,
      syncStatus: true,
      connectedAt: true,
      externalAccountId: true,
      tokenExpiresAt: true,
      accessToken: true,
    },
  });
  return NextResponse.json({
    platforms: platforms.map(({ accessToken, ...p }) => ({
      ...p,
      hasTokens: Boolean(accessToken),
    })),
    oauth: {
      tiktok: isOAuthConfigured("tiktok"),
      instagram: isOAuthConfigured("instagram"),
      youtube: isOAuthConfigured("youtube"),
    },
  });
}
