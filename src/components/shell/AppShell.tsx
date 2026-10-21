"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Compass,
  Image as ImageIcon,
  LogOut,
  Palette,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";
import { ClerkSignOut } from "@/components/shell/ClerkSignOut";

type Props = {
  children: ReactNode;
  userName?: string;
  plan?: string;
  balance?: number;
  isAdmin?: boolean;
  showOnboarding?: boolean;
  clerkEnabled?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Compass;
  group: string | null;
};

const nav: NavItem[] = [
  { href: "/discover", label: "Discover", icon: Compass, group: null },
  { href: "/brand", label: "Brand", icon: Palette, group: null },
  { href: "/studio", label: "Studio", icon: Sparkles, group: null },
  { href: "/creatives", label: "Creatives", icon: ImageIcon, group: null },
  { href: "/results", label: "Results", icon: BarChart3, group: null },
  { href: "/account", label: "Account", icon: Wallet, group: null },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .replace(".", "")
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({
  children,
  userName = "Creator",
  plan,
  balance,
  isAdmin = false,
  showOnboarding = false,
  clerkEnabled = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function dismissOnboarding() {
    await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    router.refresh();
  }

  const creditLabel = plan === "unlimited" ? "Unlimited credits" : `${balance ?? 0} credits`;
  const adminActive = pathname.startsWith("/admin");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[232px_1fr] min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <aside className="bg-[var(--card)] border-r border-[var(--line)] px-3.5 py-5 flex flex-col gap-1 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-[9px] font-display font-bold text-[17px] px-2.5 pb-[18px] pt-1">
          <span
            className="w-5 h-5 rounded-full border-[3px] border-[var(--violet)] inline-block"
            style={{ borderTopColor: "var(--s90)", transform: "rotate(-45deg)" }}
          />
          Viralyz
        </div>

        <div className="mx-1 mb-4">
          <Link
            href="/studio"
            className="btn-primary flex w-full items-center justify-center gap-2 font-semibold text-[13.5px] py-[11px] rounded-full border-none bg-[var(--violet)] text-white"
          >
            ✦&nbsp;&nbsp;New creative
          </Link>
          <p className="m-0 mt-2 px-1 font-mono text-[10px] text-[var(--ink-3)] text-center">
            {creditLabel}
          </p>
        </div>

        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item flex items-center gap-[11px] px-2.5 py-2 rounded-[10px] text-[13.5px] cursor-pointer border-l-[2.5px] ${
                active
                  ? "bg-[var(--violet-soft)] text-[var(--violet-deep)] font-semibold border-[var(--violet)]"
                  : "text-[var(--ink-2)] font-medium border-transparent"
              }`}
            >
              <Icon
                className="w-[17px] h-[17px] shrink-0"
                strokeWidth={2}
                style={{ opacity: active ? 1 : 0.75 }}
              />
              {item.label}
            </Link>
          );
        })}

        {isAdmin ? (
          <Link
            href="/admin"
            className={`nav-item flex items-center gap-[11px] px-2.5 py-2 rounded-[10px] text-[13.5px] cursor-pointer border-l-[2.5px] mt-2 ${
              adminActive
                ? "bg-[var(--violet-soft)] text-[var(--violet-deep)] font-semibold border-[var(--violet)]"
                : "text-[var(--ink-2)] font-medium border-transparent"
            }`}
          >
            <Settings className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
            Admin
          </Link>
        ) : null}

        <div className="mt-auto pt-3.5 px-2.5 border-t border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white font-display font-bold text-[13px]"
              style={{ background: "linear-gradient(135deg,#F2994A,#EB5757)" }}
            >
              {initials(userName)}
            </div>
            <div>
              <div className="font-semibold text-[13px] leading-tight">{userName}</div>
              <div className="text-[11px] text-[var(--ink-3)] mt-[3px]">{creditLabel}</div>
            </div>
            {clerkEnabled ? (
              <ClerkSignOut />
            ) : (
              <button
                type="button"
                onClick={() => void signOut()}
                title="Sign out"
                className="ml-auto p-0 border-none bg-transparent cursor-pointer text-[var(--ink)] opacity-40 hover:opacity-80"
                aria-label="Sign out"
              >
                <LogOut className="w-[15px]" strokeWidth={2} />
              </button>
            )}
          </div>
          <div className="text-[10.5px] text-[var(--ink-3)] pt-2.5 px-0">
            A Digiteq Holdings company
          </div>
        </div>
      </aside>

      <main className="px-4 md:px-9 pb-12 max-w-[1160px] w-full">
        {showOnboarding ? (
          <div className="mt-6 mb-2 rounded-[16px] border border-[rgba(108,76,241,0.35)] bg-[var(--violet-soft)] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="font-display font-semibold text-[15px]">Welcome — confirm your brand</div>
              <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">
                Set your colors, logo, and voice once, then generate on-brand ad creative from a
                reference in Discover.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/brand"
                className="inline-flex items-center justify-center rounded-full bg-[var(--violet)] text-white text-[13px] font-semibold px-4 py-2 no-underline"
              >
                Set up brand
              </Link>
              <button
                type="button"
                onClick={() => void dismissOnboarding()}
                className="rounded-full border border-[var(--line-strong)] bg-[var(--card)] text-[13px] px-3 py-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
