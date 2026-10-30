"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ClerkSsoButtons } from "@/components/auth/ClerkSsoButtons";
import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

const STEPS = [
  { n: "01", title: "Discover", body: "Browse real running ads in your category, pulled from ad libraries." },
  { n: "02", title: "Brand", body: "Confirm your colors, logo, and voice once — every ad reuses them." },
  { n: "03", title: "Studio", body: "Generate on-brand variants against a reference angle in minutes." },
  { n: "04", title: "Results", body: "Import real spend data and see which pre-flight checks actually predicted it." },
] as const;

type Mode = "signin" | "signup" | "reset" | "set-password";

type Props = {
  clerkEnabled?: boolean;
  inviteOnly?: boolean;
  demoEnabled?: boolean;
};

export function LoginView({
  clerkEnabled = false,
  inviteOnly = true,
  demoEnabled = false,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/discover";
  const resetToken = search.get("reset") ?? "";
  const inviteFromUrl = search.get("invite") ?? "";
  const [mode, setMode] = useState<Mode>(() => {
    if (resetToken) return "set-password";
    if (search.get("mode") === "signup") return "signup";
    if (search.get("mode") === "reset") return "reset";
    return "signin";
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function finishOk() {
    startTransition(() => {
      router.push(next);
      router.refresh();
    });
  }

  async function login(payload: { email?: string; password?: string; demo?: boolean }) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not sign in.");
      return;
    }
    await finishOk();
  }

  async function signup() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        inviteCode: inviteCode.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create account.");
      return;
    }
    await finishOk();
  }

  async function requestReset() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not start reset.");
      return;
    }
    setNotice(
      typeof data.devLink === "string"
        ? `Reset link (dev): ${data.devLink}`
        : "If that email exists, we sent a reset link.",
    );
  }

  async function confirmReset() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not reset password.");
      return;
    }
    setNotice("Password updated. You can sign in now.");
    setMode("signin");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signin") void login({ email, password });
    else if (mode === "signup") void signup();
    else if (mode === "reset") void requestReset();
    else void confirmReset();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1fr] bg-bg text-ink">
      <section className="p-3 sm:p-4 order-2 lg:order-1">
        <div className="relative h-full overflow-hidden rounded-panel bg-inv text-inv-ink px-6 sm:px-10 py-8 sm:py-12 flex flex-col">
          <div className="flex flex-col h-full max-w-[540px]">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-inv-ink" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 14 14">
                  <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="var(--vz-inv)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-display text-[21px] leading-none">viralyz</span>
            </div>

            <div className="mt-12 sm:mt-16 vfade">
              <h1 className="font-display text-[38px] sm:text-[52px] m-0">
                Make the ad. Check it. Then spend on it.
              </h1>
              <p className="mt-5 text-[15px] text-inv-muted max-w-[30rem] leading-relaxed">
                On-brand variants for every placement, each checked for contrast, safe zones, ratio,
                copy length and policy before you put budget behind it.
              </p>
            </div>

            <ol className="mt-10 m-0 p-0 list-none flex flex-col">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4 border-t border-inv-line py-3.5">
                  <span className="text-[13px] text-inv-muted tabular w-6 shrink-0">{s.n}</span>
                  <div>
                    <div className="font-semibold text-[14px]">{s.title}</div>
                    <p className="m-0 mt-0.5 text-[13px] text-inv-muted leading-snug">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-auto pt-8 text-[12px] text-inv-muted">A Digiteq Holdings company · viralyz.com</p>
          </div>
        </div>
      </section>

      <section className="order-1 lg:order-2 flex items-center justify-center px-6 sm:px-10 py-12 sm:py-16">
        <div className="w-full max-w-[400px] vfade">
          {mode === "signin" || mode === "signup" ? (
            <div className="flex gap-2 p-1 rounded-full bg-[var(--tint)] mb-6">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setNotice(null);
                  }}
                  className={`flex-1 rounded-full py-2 text-[13px] font-semibold border-none cursor-pointer ${
                    mode === m
                      ? "bg-[var(--card)] text-[var(--ink)] shadow-float"
                      : "bg-transparent text-[var(--ink-3)]"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          ) : null}

          <h2 className="font-display text-[32px] m-0">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? inviteOnly
                  ? "Join the beta"
                  : "Get started free"
                : mode === "reset"
                  ? "Reset password"
                  : "Choose a new password"}
          </h2>
          <p className="mt-2 text-[13.5px] text-[var(--ink-3)]">
            {mode === "signin"
              ? "Sign in to generate ad creative and check it before you spend."
              : mode === "signup"
                ? inviteOnly
                  ? "Invite-only beta — 10 free credits to generate creative."
                  : "Create an account — 10 free credits to generate creative."
                : mode === "reset"
                  ? "We’ll email a one-time link if the account exists."
                  : "Enter a new password for your account."}
          </p>

          {clerkEnabled && (mode === "signin" || mode === "signup") ? (
            <div className="mt-6">
              <ClerkSsoButtons inviteOnly={inviteOnly} />
              <div className="my-4 flex items-center gap-3 text-[12px] text-muted">
                <span className="flex-1 h-px bg-[var(--line)]" />
                or email
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {mode === "signup" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted">Name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maya R."
                  className={inputClasses}
                />
              </label>
            )}
            {mode !== "set-password" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  className={inputClasses}
                />
              </label>
            ) : null}
            {mode !== "reset" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted">Password</span>
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "signin" ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClasses}
                />
              </label>
            ) : null}
            {mode === "signup" && inviteOnly ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-muted">Invite code</span>
                <input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="VLZ…"
                  className={inputClasses}
                />
              </label>
            ) : null}

            {error && (
              <Notice tone="error">{error}</Notice>
            )}
            {notice && (
              <Notice>
                <span className="break-all">{notice}</span>
              </Notice>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : "Update password"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12.5px]">
            {mode === "signin" ? (
              <button
                type="button"
                className="border-none bg-transparent p-0 cursor-pointer text-ink font-semibold underline underline-offset-4"
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setNotice(null);
                }}
              >
                Forgot password?
              </button>
            ) : (
              <button
                type="button"
                className="border-none bg-transparent p-0 cursor-pointer text-ink font-semibold underline underline-offset-4"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
              >
                Back to sign in
              </button>
            )}
            {inviteOnly ? (
              <Link href="/waitlist" className="text-ink font-semibold underline underline-offset-4">
                Join the waitlist
              </Link>
            ) : null}
          </div>

          {demoEnabled && (mode === "signin" || mode === "signup") ? (
            <>
              <div className="my-6 flex items-center gap-3 text-[12px] text-muted">
                <span className="flex-1 h-px bg-[var(--line)]" />
                or
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>

              {/* No credentials in the client bundle — the server resolves the demo account. */}
              <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => void login({ demo: true })}
              >
                Explore with sample data
              </Button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
