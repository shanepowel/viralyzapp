"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
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

export function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function login(payload: { email: string; password: string; demo?: boolean }) {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not sign in.");
      return;
    }
    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void login({ email, password });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--paper)] text-[var(--ink)]">
      {/* Brand / marketing plane — viralyz.com voice + Signal tokens */}
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

          <div className="mt-8 grid grid-cols-2 gap-3 vfade" style={{ animationDelay: "60ms" }}>
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

          <div
            className="mt-8 rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-lift)] vfade"
            style={{ animationDelay: "120ms" }}
          >
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
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[var(--ink-3)]">{c.name}</span>
                  </div>
                  <div className="h-1 bg-[var(--tint)] rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full bg-[var(--s90)]"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                  <div className="font-mono text-[10px] text-[var(--ink-2)]">{c.val}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[12px] text-[var(--ink-2)] flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--s50-soft)] text-[var(--s50)] font-semibold px-2.5 py-1 text-[11px]">
                One fix left
              </span>
              trim the pause at 0:41{" "}
              <span className="font-mono text-[var(--s90)] font-semibold">+3</span>
            </div>
          </div>

          <p className="mt-auto pt-8 text-[10.5px] text-[var(--ink-3)] relative z-10">
            A Digiteq Holdings company · viralyz.com
          </p>
        </div>
      </section>

      {/* Auth form */}
      <section className="flex items-center justify-center px-6 sm:px-10 py-12 sm:py-16">
        <div className="w-full max-w-[400px] vfade">
          <h2 className="font-display text-[28px] font-bold m-0 tracking-[-0.02em]">
            Welcome back
          </h2>
          <p className="mt-2 text-[13.5px] text-[var(--ink-3)]">
            Sign in to score content, apply fixes, and grow your verified record.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
                className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)] placeholder:text-[var(--ink-3)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] text-[var(--ink)] outline-none transition-[border-color,box-shadow] focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)] placeholder:text-[var(--ink-3)]"
              />
            </label>

            <div className="flex items-center justify-between text-[12.5px]">
              <label className="flex items-center gap-2 text-[var(--ink-2)] cursor-pointer">
                <input type="checkbox" className="accent-[var(--violet)]" defaultChecked />
                Keep me signed in
              </label>
              <button
                type="button"
                className="text-[var(--violet-deep)] font-semibold bg-transparent border-none cursor-pointer p-0"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full py-3 text-[14px]" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11px] text-[var(--ink-3)] font-mono uppercase tracking-[0.08em]">
            <span className="flex-1 h-px bg-[var(--line)]" />
            or
            <span className="flex-1 h-px bg-[var(--line)]" />
          </div>

          <Button
            variant="outline"
            className="w-full py-3"
            disabled={pending}
            onClick={() => void login({ email: "maya@viralyz.com", password: "demo", demo: true })}
          >
            Continue as Maya R. · demo
          </Button>

          <p className="mt-8 text-[13px] text-[var(--ink-2)] text-center">
            New here?{" "}
            <Link href="/" className="text-[var(--violet-deep)] font-semibold">
              Score your first video free
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
