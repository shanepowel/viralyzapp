"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function ClaimInvitePage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/claim-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not claim invite.");
      return;
    }
    router.push("/score");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[440px]">
        <div className="font-display font-bold text-[17px]">Viralyz</div>
        <h1 className="font-display text-[32px] font-bold mt-8 mb-2 tracking-[-0.02em]">
          Enter your invite
        </h1>
        <p className="text-[14px] text-[var(--ink-3)] m-0 mb-8">
          You signed in with SSO. Paste your beta invite code to finish creating your Viralyz
          account.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
              Invite code
            </span>
            <input
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="VLZ…"
              className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)]"
            />
          </label>
          {error ? (
            <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full py-3" disabled={loading}>
            {loading ? "Claiming…" : "Continue"}
          </Button>
        </form>
        <p className="mt-6 text-[13px] text-[var(--ink-3)]">
          No invite?{" "}
          <Link href="/waitlist" className="text-[var(--violet-deep)] font-semibold no-underline">
            Join the waitlist
          </Link>
        </p>
      </div>
    </div>
  );
}
