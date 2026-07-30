"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not join waitlist.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="font-display font-bold text-[17px] no-underline text-[var(--ink)]">
          Viralyz
        </Link>
        <h1 className="font-display text-[32px] font-bold mt-8 mb-2 tracking-[-0.02em]">
          Join the waitlist
        </h1>
        <p className="text-[14px] text-[var(--ink-3)] m-0 mb-8">
          The beta is invite-only. Leave your email and we&apos;ll send a code when a seat opens.
        </p>

        {done ? (
          <div className="rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
            <strong>You&apos;re on the list.</strong>
            <p className="m-0 mt-2 text-[13.5px] text-[var(--ink-2)]">
              We&apos;ll email you an invite code. Already have one?{" "}
              <Link href="/login?mode=signup" className="text-[var(--violet-deep)] font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)]"
              />
            </label>
            {error ? (
              <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full py-3" disabled={loading}>
              {loading ? "Submitting…" : "Request invite"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-[13px] text-[var(--ink-3)]">
          <Link href="/login" className="text-[var(--violet-deep)] font-semibold no-underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
