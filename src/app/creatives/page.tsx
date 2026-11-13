import { AppPage } from "@/components/shell/AppPage";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreativesView } from "@/components/creatives/CreativesView";
import { toCreativeDTO, type CreativeDTO } from "@/components/studio/proof";
import { creditPricePerVariant } from "@/lib/env";
import { continueOpenCreativesForUser, generationAvailable } from "@/lib/generation";
import { scheduleCreative } from "@/lib/schedule-creative";
import { prisma } from "@/lib/prisma";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creatives" };

export default async function CreativesPage() {
  const user = await resolveAppUser();
  // AppPage itself redirects to /login when there's no user — this is only
  // for TypeScript, since the query below needs a concrete id.
  if (user) await continueOpenCreativesForUser(user.id, scheduleCreative);
  const creatives = user
    ? await prisma.creative.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } },
      })
    : [];

  const initialCreatives: CreativeDTO[] = creatives.map(toCreativeDTO);

  return (
    <AppPage>
      <PageHeader
        kicker="Creatives"
        title="Every proof, with its check"
        description="Open one to read its marks. Put its tag in the ad name so Results can match spend back to it."
        actions={<ButtonLink href="/studio?new=1">New batch</ButtonLink>}
      />
      <CreativesView
        initialCreatives={initialCreatives}
        generationAvailable={generationAvailable()}
        creditsPerVariant={creditPricePerVariant()}
      />
    </AppPage>
  );
}
