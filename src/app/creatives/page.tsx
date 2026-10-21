import { AppPage } from "@/components/shell/AppPage";
import { CreativesView } from "@/components/creatives/CreativesView";
import type { CreativeDTO } from "@/components/studio/VariantCard";
import { prisma } from "@/lib/prisma";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function CreativesPage() {
  const user = await resolveAppUser();
  // AppPage itself redirects to /login when there's no user — this is only
  // for TypeScript, since the query below needs a concrete id.
  const creatives = user
    ? await prisma.creative.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } },
      })
    : [];

  const initialCreatives: CreativeDTO[] = creatives.map((c) => ({
    id: c.id,
    tag: c.tag,
    angle: c.angle,
    placement: c.placement,
    productId: c.productId,
    status: c.status as CreativeDTO["status"],
    headline: c.headline,
    compositeUrl: c.compositeUrl,
    aiGenerated: c.aiGenerated,
    checks: c.checks.map((check) => ({
      headline: check.headline,
      headlineBasis: check.headlineBasis as { counted: number; total: number },
      factors: check.factors as CreativeDTO["checks"][number]["factors"],
    })),
  }));

  return (
    <AppPage>
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Creatives</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Everything you&apos;ve generated, with its latest pre-flight result.
        </p>
      </div>
      <CreativesView initialCreatives={initialCreatives} />
    </AppPage>
  );
}
