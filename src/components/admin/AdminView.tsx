"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";

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
  return `${counts.ready} ready · ${counts.pending + counts.generating} open · ${counts.failed} failed`;
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
        ? `Approved — invite ${data.code}`
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
    setNotice(`Updated ${data.user.email} → ${data.user.balance} credits`);
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
    <div className="pt-8 pb-16">
      <p className="text-[12px] font-semibold text-muted m-0">
        Admin
      </p>
      <h1 className="font-display text-[32px] mt-2 mb-2 tracking-[-0.02em]">
        Admin
      </h1>
      <p className="text-[14px] text-[var(--ink-3)] m-0 mb-6">
        One place for accounts, invites, the waitlist, and credits. Counts only — ad copy, files, and results stay on the account that owns them.
      </p>

      {error ? (
        <div className="mb-4 rounded-inner bg-[var(--s30-soft)] text-[var(--s30)] text-[13px] px-3.5 py-2.5">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-inner bg-[var(--s90-soft)] text-[var(--ink-2)] text-[13px] px-3.5 py-2.5 break-all">
          {notice}
        </div>
      ) : null}

      <section className="rounded-card border border-[var(--line)] bg-[var(--card)] p-5 mb-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-[18px] m-0 mb-3">Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="font-mono text-[10px] uppercase text-[var(--ink-3)]">
              <tr>
                <th className="py-2 pr-3">Account</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Credits</th>
                <th className="py-2 pr-3">Creatives</th>
                <th className="py-2 pr-3">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3">
                    <div>{account.name}</div>
                    <div className="text-[11px] text-[var(--ink-3)]">{account.email}</div>
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
                        className="rounded-inner border border-line px-2 py-1 text-[13px] bg-transparent"
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
                      <div className="text-[11px] text-[var(--ink-3)]">Brand saved</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-[12px] text-[var(--ink-3)]">
                    {account.lastCreativeAt
                      ? new Date(account.lastCreativeAt).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-[var(--line)] bg-[var(--card)] p-5 mb-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-[18px] m-0 mb-3">Create invites</h2>
        <form onSubmit={createInvites} className="flex flex-col sm:flex-row gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 w-full">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">Email (optional)</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="creator@studio.com"
              className="rounded-inner border border-line px-3 py-2.5 text-[14px]"
            />
          </label>
          <label className="flex flex-col gap-1 w-28">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">Count</span>
            <input
              type="number"
              min={1}
              max={50}
              value={inviteCount}
              onChange={(e) => setInviteCount(Number(e.target.value))}
              className="rounded-inner border border-line px-3 py-2.5 text-[14px]"
            />
          </label>
          <Button type="submit">Generate</Button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="font-mono text-[10px] uppercase text-[var(--ink-3)]">
              <tr>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Uses</th>
              </tr>
            </thead>
            <tbody>
              {invites.slice(0, 20).map((inv) => (
                <tr key={inv.id} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3 font-mono">{inv.code}</td>
                  <td className="py-2 pr-3">{inv.email ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {inv.usedCount}/{inv.maxUses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-[var(--line)] bg-[var(--card)] p-5 mb-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-[18px] m-0 mb-3">Waitlist</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="font-mono text-[10px] uppercase text-[var(--ink-3)]">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3">
                    <div>{entry.email}</div>
                    {entry.name ? (
                      <div className="text-[11px] text-[var(--ink-3)]">{entry.name}</div>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-ink font-semibold underline underline-offset-4 border-none bg-transparent cursor-pointer p-0"
                          onClick={() => void waitlistAction(entry.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-[var(--ink-3)] font-semibold border-none bg-transparent cursor-pointer p-0"
                          onClick={() => void waitlistAction(entry.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-[18px] m-0 mb-3">Credits</h2>
        <form onSubmit={setCredits} className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <label className="flex flex-col gap-1 flex-1 w-full">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">User email</span>
            <input
              type="email"
              required
              value={creditEmail}
              onChange={(e) => setCreditEmail(e.target.value)}
              className="rounded-inner border border-line px-3 py-2.5 text-[14px]"
            />
          </label>
          <label className="flex flex-col gap-1 w-28">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">Delta</span>
            <input
              type="number"
              value={creditDelta}
              onChange={(e) => setCreditDelta(Number(e.target.value))}
              className="rounded-inner border border-line px-3 py-2.5 text-[14px]"
            />
          </label>
          <Button type="submit">Adjust credits</Button>
        </form>
      </section>
    </div>
  );
}
