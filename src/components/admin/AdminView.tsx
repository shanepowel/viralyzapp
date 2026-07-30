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

type UserRow = {
  id: string;
  email: string;
  name: string;
  plan: string;
  creditsRemaining: number;
  role: string;
};

type Props = {
  initialInvites: Invite[];
  initialWaitlist: WaitlistEntry[];
  initialUsers: UserRow[];
};

export function AdminView({ initialInvites, initialWaitlist, initialUsers }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [waitlist, setWaitlist] = useState(initialWaitlist);
  const [users, setUsers] = useState(initialUsers);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCount, setInviteCount] = useState(5);
  const [creditEmail, setCreditEmail] = useState("");
  const [creditAmount, setCreditAmount] = useState(10);

  async function refresh() {
    const [i, w, u] = await Promise.all([
      fetch("/api/admin/invites").then((r) => r.json()),
      fetch("/api/admin/waitlist").then((r) => r.json()),
      fetch("/api/admin/credits").then((r) => r.json()),
    ]);
    if (i.invites) setInvites(i.invites);
    if (w.entries) setWaitlist(w.entries);
    if (u.users) setUsers(u.users);
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
        creditsRemaining: creditAmount,
        plan: "credits",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to update credits");
      return;
    }
    setNotice(`Updated ${data.user.email} → ${data.user.creditsRemaining} credits`);
    await refresh();
  }

  return (
    <div className="pt-8 pb-16">
      <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--violet-deep)] m-0">
        Admin
      </p>
      <h1 className="font-display text-[32px] font-bold mt-2 mb-2 tracking-[-0.02em]">
        Beta ops
      </h1>
      <p className="text-[14px] text-[var(--ink-3)] m-0 mb-6">
        Invites, waitlist approvals, and credit top-ups for the first ~1k testers.
      </p>

      {error ? (
        <div className="mb-4 rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[13px] px-3.5 py-2.5">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-[10px] bg-[var(--s90-soft)] text-[var(--ink-2)] text-[13px] px-3.5 py-2.5 break-all">
          {notice}
        </div>
      ) : null}

      <section className="rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-5 mb-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-[18px] m-0 mb-3">Create invites</h2>
        <form onSubmit={createInvites} className="flex flex-col sm:flex-row gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 w-full">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">Email (optional)</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="creator@studio.com"
              className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2.5 text-[14px]"
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
              className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2.5 text-[14px]"
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

      <section className="rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-5 mb-5 shadow-[var(--shadow)]">
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
                          className="text-[var(--violet-deep)] font-semibold border-none bg-transparent cursor-pointer p-0"
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

      <section className="rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
        <h2 className="font-display text-[18px] m-0 mb-3">Credits</h2>
        <form onSubmit={setCredits} className="flex flex-col sm:flex-row gap-3 items-end mb-4">
          <label className="flex flex-col gap-1 flex-1 w-full">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">User email</span>
            <input
              type="email"
              required
              value={creditEmail}
              onChange={(e) => setCreditEmail(e.target.value)}
              className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2.5 text-[14px]"
            />
          </label>
          <label className="flex flex-col gap-1 w-28">
            <span className="font-mono text-[10px] uppercase text-[var(--ink-3)]">Credits</span>
            <input
              type="number"
              min={0}
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              className="rounded-[12px] border border-[var(--line-strong)] px-3 py-2.5 text-[14px]"
            />
          </label>
          <Button type="submit">Set credits</Button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="font-mono text-[10px] uppercase text-[var(--ink-3)]">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Credits</th>
                <th className="py-2 pr-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3">
                    <div>{u.name}</div>
                    <div className="text-[11px] text-[var(--ink-3)]">{u.email}</div>
                  </td>
                  <td className="py-2 pr-3">{u.plan}</td>
                  <td className="py-2 pr-3">{u.creditsRemaining}</td>
                  <td className="py-2 pr-3">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
