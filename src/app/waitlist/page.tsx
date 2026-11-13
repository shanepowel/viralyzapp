"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Notice";

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
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16 text-ink">
      <div className="w-full max-w-[440px]">
        <Link href="/" aria-label="Viralyz">
          <Logo />
        </Link>
        <h1 className="font-display mb-3 mt-10 text-[38px]">
          Join the waitlist
        </h1>
        <p className="m-0 mb-8 text-[15px] text-ink-2">
          The beta is invite-only. Leave your email and we&apos;ll send a code when a seat opens.
        </p>

        {done ? (
          <div className="border-y border-rule py-5">
            <p className="kicker m-0 text-pass">On the list</p>
            <p className="m-0 mt-2 text-[14px] text-ink-2">
              We&apos;ll email you an invite code. Already have one?{" "}
              <Link href="/login?mode=signup" className="text-ink font-semibold underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Name</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourshop.com"
                className={inputClasses}
              />
            </label>
            {error ? (
              <Notice tone="error">{error}</Notice>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting…" : "Request invite"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-[13px] text-ink-2">
          <Link href="/login" className="text-ink font-semibold underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
