"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

type Mode = "signin" | "signup";

export function LoginView() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [mode, setMode] = useState<Mode>(
    search.get("mode") === "signup" ? "signup" : "signin",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function finishOk() {
    startTransition(() => {
      router.push(next);
      router.refresh();
    });
  }

  async function login(payload: { email: string; password: string; demo?: boolean }) {
    setError(null);
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
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create account.");
      return;
    }
    await finishOk();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "signin") void login({ email, password });
    else void signup();
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
          <div className="flex gap-2 p-1 rounded-full bg-[var(--tint)] mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
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

          <h2 className="font-display text-[28px] font-bold m-0 tracking-[-0.02em]">
            {mode === "signin" ? "Welcome back" : "Start scoring free"}
          </h2>
          <p className="mt-2 text-[13.5px] text-[var(--ink-3)]">
            {mode === "signin"
              ? "Sign in to score content, apply fixes, and grow your verified record."
              : "Create an account — 10 free scores on the Creator credits plan."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[var(--ink-3)]">
                Password
              </span>
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[14px] border border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 text-[14px] outline-none focus:border-[var(--violet)] focus:shadow-[0_0_0_3px_var(--violet-soft)]"
              />
            </label>

            {error && (
              <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full py-3 text-[14px]" disabled={pending}>
              {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
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
            onClick={() => void login({ email: "maya@viralyz.com", password: "demo1234", demo: true })}
          >
            Continue as Maya R. · demo
          </Button>
        </div>
      </section>
    </div>
  );
}
