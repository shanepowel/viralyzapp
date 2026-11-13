import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/shell/AppPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { balance, history } from "@/lib/credits";
import { creditPricePerVariant } from "@/lib/env";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export default async function AccountPage() {
  const user = await resolveAppUser();
  if (!user) redirect("/login");

  const [userBalance, entries] = await Promise.all([balance(user.id), history(user.id)]);

  return (
    <AppPage>
      <div className="vfade">
        <PageHeader title="Account" description="Your credit balance and every credit in or out." />

        <div className="mb-5 rounded-card bg-inv text-inv-ink p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-[13px] text-inv-muted">Balance</div>
            <div className="font-display text-[56px] leading-none mt-2 tabular">
              {user.plan === "unlimited" ? "Unlimited" : userBalance}
            </div>
            {user.plan === "unlimited" ? null : <div className="text-[13px] text-inv-muted mt-1">credits</div>}
          </div>
          <p className="m-0 max-w-[320px] text-[13px] text-inv-muted">
            {creditPricePerVariant() === 1 ? "One credit" : `${creditPricePerVariant()} credits`} per variant. Need more during the beta?{" "}
            <a href="mailto:hello@viralyz.com" className="text-inv-ink underline underline-offset-4">
              hello@viralyz.com
            </a>
          </p>
        </div>

        <Panel className="mb-5">
          <div className="p-5">
            <div className="text-[12px] font-semibold text-[var(--ink-3)] mb-3">
              History
            </div>
            {entries.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)] m-0">No ledger activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="text-left text-muted text-[12px]">
                      <th className="font-semibold pb-2 pr-4">Date</th>
                      <th className="font-semibold pb-2 pr-4">Kind</th>
                      <th className="font-semibold pb-2 pr-4 text-right">Credits</th>
                      <th className="font-semibold pb-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-t border-[var(--line)]">
                        <td className="py-2 pr-4">{e.createdAt.toLocaleDateString()}</td>
                        <td className="py-2 pr-4">{e.kind}</td>
                        <td className={`py-2 pr-4 text-right tabular ${e.delta > 0 ? "font-semibold" : ""}`}>
                          {formatDelta(e.delta)}
                        </td>
                        <td className="py-2">{e.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        {user.role === "admin" || user.role === "superadmin" ? (
          <Panel>
            <div className="p-5">
              <Link href="/admin" className="text-ink font-semibold underline underline-offset-4">
                Admin tools →
              </Link>
            </div>
          </Panel>
        ) : null}
      </div>
    </AppPage>
  );
}
