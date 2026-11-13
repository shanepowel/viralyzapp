"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ClerkSsoButtons } from "@/components/auth/ClerkSsoButtons";
import { Button } from "@/components/ui/Button";
import { FieldLabel, inputClasses } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { Notice } from "@/components/ui/Notice";

const STEPS = [
  { n: "1", title: "Brand", body: "Confirm your colours, logo and voice once. Every ad reuses them." },
  { n: "2", title: "Studio", body: "Make a batch across placements and angles. Each ad is checked as it lands." },
  { n: "3", title: "Marks", body: "Anything that must change is marked in red on the proof, with the reason." },
  { n: "4", title: "Results", body: "Import real spend and see whether the checks held up." },
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
  const next = search.get("next") || "/studio";
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

  const heading =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? inviteOnly
          ? "Join the beta"
          : "Create your account"
        : mode === "reset"
          ? "Reset your password"
          : "Choose a new password";
  const sub =
    mode === "signin"
      ? "Pick up where you left off."
      : mode === "signup"
        ? inviteOnly
          ? "The beta is by invite. You start with 10 credits, one per ad."
          : "You start with 10 credits, one per ad."
        : mode === "reset"
          ? "If the account exists, we will email a one-time link."
          : "Enter a new password for your account.";
  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };
  const textLink =
    "min-h-9 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-ink underline underline-offset-4";

  return (
    <div className="grid min-h-screen bg-bg text-ink lg:grid-cols-[1.1fr_1fr]">
      <section className="order-2 flex flex-col px-6 py-10 sm:px-12 lg:order-1 lg:border-r lg:border-rule lg:py-12">
        <Logo />
        <div className="vfade mt-12 max-w-[560px] lg:mt-20">
          <p className="kicker m-0">Paid social ads, checked before you spend</p>
          <h1 className="font-display m-0 mt-3 text-[40px] sm:text-[52px]">Make the ad. Mark it up. Then spend on it.</h1>
          <p className="m-0 mt-5 max-w-[30rem] text-[16px] text-ink-2">
            On-brand ads for every placement, each one measured for contrast, safe zone, ratio, length and policy
            before any budget goes behind it.
          </p>
        </div>

        <ol className="m-0 mt-10 max-w-[560px] list-none border-t border-rule p-0">
          {STEPS.map((s) => (
            <li key={s.n} className="grid grid-cols-[28px_110px_1fr] gap-2 border-b border-line py-3 text-[14px]">
              <span className="font-mono text-[12px] text-muted">{s.n}</span>
              <span className="font-semibold">{s.title}</span>
              <span className="text-ink-2">{s.body}</span>
            </li>
          ))}
        </ol>

        <p className="m-0 mt-auto pt-10 font-mono text-[11px] text-muted">A Digiteq Holdings company / viralyz.com</p>
      </section>

      <section className="order-1 flex items-center justify-center px-6 py-12 sm:px-10 lg:order-2 lg:py-16">
        <div className="vfade w-full max-w-[400px]">
          {mode === "signin" || mode === "signup" ? (
            <div role="tablist" aria-label="Sign in or create an account" className="mb-8 grid grid-cols-2 border border-rule">
              {(["signin", "signup"] as const).map((m, i) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`min-h-11 cursor-pointer border-0 text-[14px] font-semibold ${i > 0 ? "border-l border-rule" : ""} ${
                    mode === m ? "bg-ink text-bg" : "bg-transparent text-ink hover:bg-panel"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          ) : null}

          <h2 className="font-display m-0 text-[34px]">{heading}</h2>
          <p className="m-0 mt-2 text-[14px] text-ink-2">{sub}</p>

          {clerkEnabled && (mode === "signin" || mode === "signup") ? (
            <div className="mt-6">
              <ClerkSsoButtons inviteOnly={inviteOnly} />
              <p className="kicker m-0 border-t border-line pt-3">Or use email</p>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {mode === "signup" && (
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Name</FieldLabel>
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses}
                />
              </label>
            )}
            {mode !== "set-password" ? (
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourshop.com"
                  className={inputClasses}
                />
              </label>
            ) : null}
            {mode !== "reset" ? (
              <label className="flex flex-col gap-1.5">
                <FieldLabel>{mode === "signin" ? "Password" : "Password, 8 characters or more"}</FieldLabel>
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "signin" ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClasses}
                />
              </label>
            ) : null}
            {mode === "signup" && inviteOnly ? (
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Invite code</FieldLabel>
                <input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="VLZ…"
                  className={`${inputClasses} font-mono`}
                />
              </label>
            ) : null}

            {error && <Notice tone="error">{error}</Notice>}
            {notice && (
              <Notice>
                <span className="break-all">{notice}</span>
              </Notice>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "One moment…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : "Update password"}
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            {mode === "signin" ? (
              <button type="button" className={textLink} onClick={() => switchMode("reset")}>
                Forgot password?
              </button>
            ) : (
              <button type="button" className={textLink} onClick={() => switchMode("signin")}>
                Back to sign in
              </button>
            )}
            {inviteOnly ? (
              <Link href="/waitlist" className="text-[13px] font-semibold text-ink underline underline-offset-4">
                Join the waitlist
              </Link>
            ) : null}
          </div>

          {demoEnabled && (mode === "signin" || mode === "signup") ? (
            <div className="mt-8 border-t border-line pt-5">
              {/* No credentials in the client bundle: the server resolves the demo account. */}
              <Button variant="outline" className="w-full" disabled={pending} onClick={() => void login({ demo: true })}>
                Look around with sample data
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
