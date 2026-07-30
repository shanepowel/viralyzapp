import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";
import { AppPage } from "@/components/shell/AppPage";
import { prisma } from "@/lib/prisma";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await resolveAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/score");

  const [invites, waitlist, users] = await Promise.all([
    prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        creditsRemaining: true,
        role: true,
      },
    }),
  ]);

  return (
    <AppPage>
      <AdminView
        initialInvites={invites.map((i) => ({
          id: i.id,
          code: i.code,
          email: i.email,
          usedCount: i.usedCount,
          maxUses: i.maxUses,
          note: i.note,
          createdAt: i.createdAt.toISOString(),
        }))}
        initialWaitlist={waitlist.map((w) => ({
          id: w.id,
          email: w.email,
          name: w.name,
          status: w.status,
          inviteCode: w.inviteCode,
          createdAt: w.createdAt.toISOString(),
        }))}
        initialUsers={users}
      />
    </AppPage>
  );
}
