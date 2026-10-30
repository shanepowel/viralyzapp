import { AppPage } from "@/components/shell/AppPage";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreativesView } from "@/components/creatives/CreativesView";
import type { CreativeDTO } from "@/components/studio/VariantCard";
import { generationAvailable } from "@/lib/generation";
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
    referenceId: c.referenceId,
    status: c.status as CreativeDTO["status"],
    headline: c.headline,
    primaryText: c.primaryText,
    cta: c.cta,
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
      <PageHeader
        title="Creatives"
        description="Everything you've generated, with its latest pre-flight result. Put each tag in the ad name so Results can match spend back to it."
        actions={<ButtonLink href="/studio">New creative</ButtonLink>}
      />
      <CreativesView initialCreatives={initialCreatives} generationAvailable={generationAvailable()} />
    </AppPage>
  );
}
