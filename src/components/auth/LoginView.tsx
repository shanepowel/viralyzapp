"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ClerkSsoButtons } from "@/components/auth/ClerkSsoButtons";
import { Button } from "@/components/ui/Button";
import { ScoreRing } from "@/components/ui/ScoreRing";

const STEPS = [
  { n: "01", title: "Score", body: "Upload a video. Get a score out of 100 in under 30 seconds." },
  { n: "02", title: "Fix", body: "Every problem comes with a fix and how many points it is worth." },
  { n: "03", title: "Learn", body: "We track real performance so your scores get sharper over time." },
  { n: "04", title: "Earn", body: "Your history becomes a verified profile brands can hire from." },
] as const;

const COMPONENTS = [
  { name: "Opening", val: "19/20", pct: 95 },
  { name: "Visuals", val: "18/20", pct: 90 },
  { name: "Pacing", val: "17/20", pct: 85 },
  { name: "Words", val: "18/20", pct: 90 },
  { name: "Timing", val: "17/20", pct: 85 },
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
  const next = search.get("next") || "/score";
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--paper)] text-[var(--ink)]">
      <section className="relative overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--line)] px-6 sm:px-10 py-8 sm:py-12 flex flex-col">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(108,76,241,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(15,169,104,0.08), transparent 50%), linear-gradient(165deg, #FAFAF7 0%, #F1EFEA 45%, #EFEBFF 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(27,24,38,0.06) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative z-10 flex flex-col h-full max-w-[520px]">
          <div className="flex items-center gap-[9px] font-display font-bold text-[17px]">
            <span
              className="w-5 h-5 rounded-full border-[3px] border-[var(--violet)] inline-block"
              style={{ borderTopColor: "var(--s90)", transform: "rotate(-45deg)" }}
            />
            Viralyz
          </div>

          <div className="mt-10 sm:mt-14 vfade">
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--violet-deep)] mb-3">
              Creators · Brands · Proof
            </p>
            <h1 className="font-display text-[34px] sm:text-[42px] font-bold leading-[1.08] m-0 tracking-[-0.02em]">
              See if content will work before you spend a penny on it.
            </h1>
            <p className="mt-4 text-[15px] text-[var(--ink-2)] max-w-[28rem] leading-relaxed">
              Four steps. From guessing to getting paid. Score, fix, learn — then get hired on a
              verified record.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-[14px] border border-[var(--line)] bg-[var(--card)]/80 backdrop-blur-sm p-3.5 shadow-[var(--shadow)]"
              >
                <div className="font-mono text-[10px] text-[var(--ink-3)] mb-1">{s.n}</div>
                <div className="font-display font-semibold text-[14px]">{s.title}</div>
                <p className="m-0 mt-1 text-[11.5px] text-[var(--ink-2)] leading-snug">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-lift)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
                  morning-routine-v2.mp4
                </div>
                <div className="text-[12px] text-[var(--s90)] font-semibold mt-0.5">READY</div>
              </div>
              <ScoreRing score={89} size="sm" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {COMPONENTS.map((c) => (
                <div key={c.name}>
                  <div className="h-1 bg-[var(--tint)] rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full bg-[var(--s90)]" style={{ width: `${c.pct}%` }} />
                  </div>
                  <div className="font-mono text-[10px] text-[var(--ink-2)]">{c.val}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-auto pt-8 text-[10.5px] text-[var(--ink-3)] relative z-10">
            A Digiteq Holdings company · viralyz.com
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 sm:px-10 py-12 sm:py-16">
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
                      ? "bg-[var(--card)] text-[var(--ink)] shadow-[var(--shadow)]"
                      : "bg-transparent text-[var(--ink-3)]"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          ) : null}

          <h2 className="font-display text-[28px] font-bold m-0 tracking-[-0.02em]">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? inviteOnly
                  ? "Join the beta"
                  : "Start scoring free"
                : mode === "reset"
                  ? "Reset password"
                  : "Choose a new password"}
          </h2>
          <p className="mt-2 text-[13.5px] text-[var(--ink-3)]">
            {mode === "signin"
              ? "Sign in to score content, apply fixes, and grow your verified record."
              : mode === "signup"
                ? inviteOnly
                  ? "Invite-only beta — 10 free scores on the Creator credits plan."
                  : "Create an account — 10 free scores on the Creator credits plan."
                : mode === "reset"
                  ? "We’ll email a one-time link if the account exists."
                  : "Enter a new password for your account."}
          </p>

          {clerkEnabled && (mode === "signin" || mode === "signup") ? (
            <div className="mt-6">
              <ClerkSsoButtons inviteOnly={inviteOnly} />
              <div className="my-4 flex items-center gap-3 text-[11px] text-[var(--ink-3)] font-mono uppercase tracking-[0.08em]">
                <span className="flex-1 h-px bg-[var(--line)]" />
                or email
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {mode === "signup" && (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                  Name
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maya R."
                  className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)]"
                />
              </label>
            )}
            {mode !== "set-password" ? (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)]"
                />
              </label>
            ) : null}
            {mode !== "reset" ? (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "signin" ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)]"
                />
              </label>
            ) : null}
            {mode === "signup" && inviteOnly ? (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                  Invite code
                </span>
                <input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="VLZ…"
                  className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)]"
                />
              </label>
            ) : null}

            {error && (
              <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-[10px] bg-[var(--s90-soft)] text-[var(--ink-2)] text-[12.5px] px-3.5 py-2.5 break-all">
                {notice}
              </div>
            )}

            <Button type="submit" className="w-full py-3 text-[14px]" disabled={pending}>
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
                className="border-none bg-transparent p-0 cursor-pointer text-[var(--violet-deep)] font-semibold"
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
                className="border-none bg-transparent p-0 cursor-pointer text-[var(--violet-deep)] font-semibold"
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
              <Link href="/waitlist" className="text-[var(--violet-deep)] font-semibold no-underline">
                Join the waitlist
              </Link>
            ) : null}
          </div>

          {demoEnabled && (mode === "signin" || mode === "signup") ? (
            <>
              <div className="my-6 flex items-center gap-3 text-[11px] text-[var(--ink-3)] font-mono uppercase tracking-[0.08em]">
                <span className="flex-1 h-px bg-[var(--line)]" />
                or
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>

              {/* No credentials in the client bundle — the server resolves the demo account. */}
              <Button
                variant="outline"
                className="w-full py-3"
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
