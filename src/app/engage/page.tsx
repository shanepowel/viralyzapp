import { AppPage } from "@/components/shell/AppPage";
import { EngageView } from "@/components/earn/EngageView";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EngagePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const comments = await prisma.engageComment.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppPage>
      <EngageView comments={comments} />
    </AppPage>
  );
}
