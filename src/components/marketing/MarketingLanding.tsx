"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SiteNav } from "@/components/marketing/SiteNav";

const STEPS = [
  {
    n: "01",
    title: "Score",
    body: "Upload a draft. Get a score out of 100 before you post — opening, visuals, pacing, words, timing.",
  },
  {
    n: "02",
    title: "Fix",
    body: "Every weak moment comes with a concrete fix and how many points it is worth.",
  },
  {
    n: "03",
    title: "Ship",
    body: "Schedule into your peak slot. Track predicted vs real so the model stays honest.",
  },
] as const;

export function MarketingLanding() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] overflow-x-hidden">
      <SiteNav />

      <section className="relative min-h-[calc(100vh-72px)] flex flex-col justify-center px-6 sm:px-10 pb-16">
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 70% 20%, rgba(108,76,241,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 15% 80%, rgba(15,169,104,0.08), transparent 50%), linear-gradient(180deg, #FAFAF7 0%, #F3F1EB 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231B1826' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 max-w-[1160px] mx-auto w-full grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div className="vfade">
            <h1 className="font-display text-[clamp(2.75rem,6vw,4.25rem)] font-bold leading-[1.05] tracking-[-0.03em] m-0 mb-5">
              Viralyz
            </h1>
            <p className="font-display text-[clamp(1.35rem,2.5vw,1.85rem)] font-semibold text-[var(--ink-2)] leading-snug m-0 mb-4 max-w-[28ch]">
              Score the draft before you post.
            </p>
            <p className="text-[15px] text-[var(--ink-2)] max-w-[38ch] m-0 mb-8 leading-relaxed">
              Opening, visuals, pacing, words, timing — a score out of 100 with fixes that actually move the number.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login?mode=signup">
                <Button className="!px-6 !py-3 !text-[14px]">Score your first video</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="!px-6 !py-3 !text-[14px]">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          <div
            className="relative vfade rounded-[20px] bg-[var(--card)] border border-[var(--line)] shadow-[var(--shadow-lift)] p-6 sm:p-8"
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-1">
                  Score results — example
                </div>
                <div className="font-display text-[18px] font-semibold">3 mistakes killing your hook</div>
              </div>
              <ScoreRing score={89} size="sm" />
            </div>
            <div className="space-y-3">
              {[
                { label: "Opening", score: 19 },
                { label: "Visuals", score: 18 },
                { label: "Pacing", score: 17 },
                { label: "Words", score: 18 },
                { label: "Timing", score: 17 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-16 text-[12.5px] text-[var(--ink-2)]">{row.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--tint)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--violet)]"
                      style={{
                        width: `${(row.score / 20) * 100}%`,
                        animation: "vfade 0.6s ease both",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11.5px] text-[var(--ink-3)] w-10 text-right">
                    {row.score}/20
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 mb-0 text-[12.5px] text-[var(--ink-3)] leading-relaxed">
              Ready to post. One small fix would make it great.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--card)] px-6 sm:px-10 py-16">
        <div className="max-w-[1160px] mx-auto">
          <h2 className="font-display text-[28px] font-bold m-0 mb-2">How it works</h2>
          <p className="text-[var(--ink-2)] m-0 mb-10 max-w-[42ch]">
            One loop from draft to posted — no dashboards full of noise.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="font-mono text-[11px] text-[var(--violet)] mb-2">{s.n}</div>
                <h3 className="font-display text-[18px] font-semibold m-0 mb-2">{s.title}</h3>
                <p className="text-[13.5px] text-[var(--ink-2)] m-0 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 sm:px-10 py-8 text-center text-[11px] text-[var(--ink-3)]">
        A Digiteq Holdings company ·{" "}
        <Link href="/login" className="underline underline-offset-2">
          Open the app
        </Link>
      </footer>
    </div>
  );
}
