"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";

type Invite = {
  id: string;
  code: string;
  email: string | null;
  usedCount: number;
  maxUses: number;
  note: string | null;
  createdAt: string;
};

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  inviteCode: string | null;
  createdAt: string;
};

type CreativeCounts = { pending: number; generating: number; ready: number; failed: number };

type AccountRow = {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: string;
  balance: number;
  brandCount: number;
  creatives: CreativeCounts;
  createdAt: string;
  lastCreativeAt: string | null;
  onboardingDone: boolean;
};

type Props = {
  viewerRole: "admin" | "superadmin";
  initialInvites: Invite[];
  initialWaitlist: WaitlistEntry[];
  initialAccounts: AccountRow[];
};

function creativeSummary(counts: CreativeCounts): string {
  const total = counts.pending + counts.generating + counts.ready + counts.failed;
  if (total === 0) return "None";
  return `${counts.ready} ready / ${counts.pending + counts.generating} open / ${counts.failed} failed`;
}

function roleLabel(role: string): string {
  switch (role) {
    case "superadmin":
      return "Super admin";
    case "admin":
      return "Admin";
    case "user":
      return "Seller";
    default:
      return role;
  }
}

export function AdminView({ viewerRole, initialInvites, initialWaitlist, initialAccounts }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [waitlist, setWaitlist] = useState(initialWaitlist);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCount, setInviteCount] = useState(5);
  const [creditEmail, setCreditEmail] = useState("");
  const [creditDelta, setCreditDelta] = useState(10);

  async function refresh() {
    const [i, w, u] = await Promise.all([
      fetch("/api/admin/invites").then((r) => r.json()),
      fetch("/api/admin/waitlist").then((r) => r.json()),
      fetch("/api/admin/accounts").then((r) => r.json()),
    ]);
    if (i.invites) setInvites(i.invites);
    if (w.entries) setWaitlist(w.entries);
    if (u.accounts) setAccounts(u.accounts);
  }

  async function createInvites(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count: inviteCount,
        email: inviteEmail || undefined,
        sendEmail: Boolean(inviteEmail),
        expiresInDays: 30,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create invites");
      return;
    }
    setNotice(`Created: ${(data.codes as string[]).join(", ")}`);
    setInviteEmail("");
    await refresh();
  }

  async function waitlistAction(id: string, action: "approve" | "reject") {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Waitlist action failed");
      return;
    }
    setNotice(
      action === "approve" && data.code
        ? `Approved. Invite code ${data.code}`
        : `Marked ${action}`,
    );
    await refresh();
  }

  async function setCredits(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: creditEmail,
        delta: creditDelta,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to update credits");
      return;
    }
    setNotice(`${data.user.email} now has ${data.user.balance} credits.`);
    await refresh();
  }

  async function setRole(email: string, role: "user" | "admin") {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not change that role");
      return;
    }
    setNotice(`${email} is now ${roleLabel(role).toLowerCase()}.`);
    await refresh();
  }

  return (
    <div className="vfade pb-16">
      <PageHeader
        kicker="Admin"
        title="Accounts, invites and credits"
        description="Counts only. Ad copy, files and results stay with the account that owns them."
      />

      {error ? (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      ) : null}
      {notice ? (
        <Notice className="mb-4 break-all">{notice}</Notice>
      ) : null}

      <section className="mb-10 border-t border-rule pt-4">
        <h2 className="font-display m-0 mb-3 text-[22px]">Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead className="kicker border-b border-rule">
              <tr>
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Credits</th>
                <th className="py-2 pr-4 font-medium">Creatives</th>
                <th className="py-2 pr-4 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-line align-top hover:bg-panel">
                  <td className="py-2 pr-3">
                    <div>{account.name}</div>
                    <div className="font-mono text-[11px] text-muted">{account.email}</div>
                  </td>
                  <td className="py-2 pr-3">
                    {viewerRole === "superadmin" && account.role !== "superadmin" ? (
                      <select
                        aria-label={`Role for ${account.email}`}
                        value={account.role === "admin" ? "admin" : "user"}
                        onChange={(e) => {
                          const next = e.target.value === "admin" ? "admin" : "user";
                          void setRole(account.email, next);
                        }}
                        className="min-h-9 rounded-inner border border-rule bg-card px-2 text-[13px]"
                      >
                        <option value="user">Seller</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      roleLabel(account.role)
                    )}
                  </td>
                  <td className="py-2 pr-3">{account.plan === "unlimited" ? "Unlimited" : account.balance}</td>
                  <td className="py-2 pr-3">
                    {creativeSummary(account.creatives)}
                    {account.brandCount > 0 ? (
                      <div className="font-mono text-[11px] text-muted">Brand saved</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-muted">
                    {account.lastCreativeAt
                      ? new Date(account.lastCreativeAt).toLocaleDateString("en-GB")
                      : "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 border-t border-rule pt-4">
        <h2 className="font-display m-0 mb-3 text-[22px]">Create invites</h2>
        <form onSubmit={createInvites} className="flex flex-col sm:flex-row gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 w-full">
            <span className="kicker">Email, optional</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="seller@shop.com"
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1 w-28">
            <span className="kicker">Count</span>
            <input
              type="number"
              min={1}
              max={50}
              value={inviteCount}
              onChange={(e) => setInviteCount(Number(e.target.value))}
              className={inputClasses}
            />
          </label>
          <Button type="submit">Create invites</Button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead className="kicker border-b border-rule">
              <tr>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Uses</th>
              </tr>
            </thead>
            <tbody>
              {invites.slice(0, 20).map((inv) => (
                <tr key={inv.id} className="border-b border-line align-top hover:bg-panel">
                  <td className="py-2 pr-3 font-mono">{inv.code}</td>
                  <td className="py-2 pr-3">{inv.email ?? "n/a"}</td>
                  <td className="py-2 pr-3">
                    {inv.usedCount}/{inv.maxUses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 border-t border-rule pt-4">
        <h2 className="font-display m-0 mb-3 text-[22px]">Waitlist</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead className="kicker border-b border-rule">
              <tr>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((entry) => (
                <tr key={entry.id} className="border-b border-line align-top hover:bg-panel">
                  <td className="py-2 pr-3">
                    <div>{entry.email}</div>
                    {entry.name ? (
                      <div className="font-mono text-[11px] text-muted">{entry.name}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {entry.status}
                    {entry.inviteCode ? (
                      <div className="font-mono text-[11px]">{entry.inviteCode}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {entry.status === "pending" ? (
                      <div className="flex gap-4">
                        <button
                          type="button"
                          className="min-h-9 cursor-pointer border-0 bg-transparent p-0 font-semibold text-ink underline underline-offset-4"
                          onClick={() => void waitlistAction(entry.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="min-h-9 cursor-pointer border-0 bg-transparent p-0 font-semibold text-mark underline underline-offset-4"
                          onClick={() => void waitlistAction(entry.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "n/a"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-rule pt-4">
        <h2 className="font-display m-0 mb-3 text-[22px]">Credits</h2>
        <form onSubmit={setCredits} className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <label className="flex flex-col gap-1 flex-1 w-full">
            <span className="kicker">Account email</span>
            <input
              type="email"
              required
              value={creditEmail}
              onChange={(e) => setCreditEmail(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1 w-28">
            <span className="kicker">Add or remove</span>
            <input
              type="number"
              value={creditDelta}
              onChange={(e) => setCreditDelta(Number(e.target.value))}
              className={inputClasses}
            />
          </label>
          <Button type="submit">Adjust credits</Button>
        </form>
      </section>
    </div>
  );
}
