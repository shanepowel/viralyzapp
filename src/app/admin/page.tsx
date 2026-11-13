import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin/AdminView";
import { AppPage } from "@/components/shell/AppPage";
import { listAccountActivity } from "@/lib/admin-accounts";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await resolveAppUser();
  if (!user) redirect("/login");
  if (!isStaffRole(user.role)) redirect("/discover");

  const [invites, waitlist, accounts] = await Promise.all([
    prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    listAccountActivity(),
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
        viewerRole={user.role === "superadmin" ? "superadmin" : "admin"}
        initialAccounts={accounts.map((account) => ({
          ...account,
          createdAt: account.createdAt.toISOString(),
          lastCreativeAt: account.lastCreativeAt?.toISOString() ?? null,
        }))}
      />
    </AppPage>
  );
}
