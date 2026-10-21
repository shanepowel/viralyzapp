import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/shell/AppPage";
import { Panel } from "@/components/ui/Panel";
import { balance, history } from "@/lib/credits";
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
        <div className="py-[22px] pb-6">
          <h1 className="font-display text-2xl font-bold m-0">Account</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">Credit balance and ledger history.</p>
        </div>

        <Panel className="mb-5">
          <div className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-2">
              Balance
            </div>
            <div className="font-display text-[32px] font-bold">
              {user.plan === "unlimited" ? "Unlimited" : userBalance}
            </div>
            {user.plan === "unlimited" ? null : (
              <div className="text-[13px] text-[var(--ink-3)]">credits</div>
            )}
          </div>
        </Panel>

        <Panel className="mb-5">
          <div className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-3">
              History
            </div>
            {entries.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)] m-0">No ledger activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="text-left text-[var(--ink-3)] font-mono text-[11px] uppercase">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Kind</th>
                      <th className="pb-2 pr-4">Delta</th>
                      <th className="pb-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-t border-[var(--line)]">
                        <td className="py-2 pr-4">{e.createdAt.toLocaleDateString()}</td>
                        <td className="py-2 pr-4">{e.kind}</td>
                        <td
                          className="py-2 pr-4 font-mono"
                          style={{
                            color:
                              e.delta > 0 ? "var(--s90)" : e.delta < 0 ? "var(--s30)" : undefined,
                          }}
                        >
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

        {user.role === "admin" ? (
          <Panel>
            <div className="p-5">
              <Link href="/admin" className="text-[var(--violet-deep)] font-semibold no-underline">
                Admin tools →
              </Link>
            </div>
          </Panel>
        ) : null}
      </div>
    </AppPage>
  );
}
