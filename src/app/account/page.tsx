import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPage } from "@/components/shell/AppPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { balance, history } from "@/lib/credits";
import { creditPricePerVariant } from "@/lib/env";
import { resolveAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export default async function AccountPage() {
  const user = await resolveAppUser();
  if (!user) redirect("/login");

  const [userBalance, entries] = await Promise.all([balance(user.id), history(user.id)]);

  const price = creditPricePerVariant();
  const unlimited = user.plan === "unlimited";
  const row = "grid grid-cols-1 gap-x-8 gap-y-3 border-b border-line py-6 md:grid-cols-[200px_1fr]";
  const th = "kicker border-b border-rule py-2 pr-4 text-left font-medium";

  return (
    <AppPage>
      <div className="vfade">
        <PageHeader kicker="Account" title={user.name} description="Credits, display and sign-in, on one page." />

        <div className="border-t border-rule">
          <section aria-label="Credits" className={row}>
            <p className="kicker m-0 pt-2 text-ink">Credits</p>
            <div>
              <p className="m-0 font-mono text-[56px] font-medium leading-none">
                {unlimited ? "Unlimited" : userBalance}
                {unlimited ? null : <span className="ml-3 text-[13px] font-normal text-muted">credits left</span>}
              </p>
              <p className="m-0 mt-3 max-w-[520px] text-[14px] text-ink-2">
                {price === 1 ? "One credit" : `${price} credits`} makes and checks one ad. A credit is only spent when
                the ad is made; if it fails, the credit comes back. Need more during the beta? Write to{" "}
                <a href="mailto:hello@viralyz.com" className="font-semibold text-ink underline underline-offset-4">
                  hello@viralyz.com
                </a>
                .
              </p>
            </div>
          </section>

          <section aria-label="Credit history" className={row}>
            <p className="kicker m-0 pt-2 text-ink">History</p>
            {entries.length === 0 ? (
              <p className="m-0 text-[14px] text-ink-2">No credits in or out yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full max-w-[820px] border-collapse border-t border-rule text-[14px]">
                  <thead>
                    <tr>
                      <th className={th}>Date</th>
                      <th className={th}>What</th>
                      <th className={`${th} text-right`}>Credits</th>
                      <th className={`${th} pl-4`}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b border-line">
                        <td className="py-2 pr-4 font-mono text-[13px] text-ink-2">
                          {e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-2 pr-4 first-letter:uppercase">{e.kind.replace(/_/g, " ")}</td>
                        <td className={`py-2 pr-4 text-right font-mono text-[13px] ${e.delta > 0 ? "font-semibold text-pass" : ""}`}>
                          {formatDelta(e.delta)}
                        </td>
                        <td className="py-2 pl-4 text-ink-2">{e.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Display" className={row}>
            <p className="kicker m-0 pt-2 text-ink">Display</p>
            <div>
              <ThemeToggle />
              <p className="m-0 mt-2 text-[13px] text-muted">Light is the default. Match device follows your system setting.</p>
            </div>
          </section>

          {user.role === "admin" || user.role === "superadmin" ? (
            <section aria-label="Admin" className={row}>
              <p className="kicker m-0 pt-1 text-ink">Admin</p>
              <Link href="/admin" className="font-semibold text-ink underline underline-offset-4">
                Accounts, invites and credits
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </AppPage>
  );
}
