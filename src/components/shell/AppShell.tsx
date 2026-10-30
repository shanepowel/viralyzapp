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
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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

const adminItem: NavItem = { href: "/admin", label: "Admin", icon: Settings, group: null };

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
  const items = isAdmin ? [...nav, adminItem] : nav;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const signOutButton = clerkEnabled ? (
    <ClerkSignOut />
  ) : (
    <button
      type="button"
      onClick={() => void signOut()}
      title="Sign out"
      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-muted hover:bg-panel hover:text-ink"
      aria-label="Sign out"
    >
      <LogOut className="w-[15px]" strokeWidth={2} />
    </button>
  );

  return (
    <div className="md:grid md:grid-cols-[248px_1fr] min-h-screen bg-bg text-ink">
      {/* Mobile: a top bar and a scrolling row of sections. */}
      <header className="md:hidden sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          <Link href="/discover" aria-label="Viralyz home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted tabular">{creditLabel}</span>
            <Link
              href="/studio"
              className="btn-primary inline-flex min-h-9 items-center rounded-full bg-btn px-3.5 text-[13px] font-semibold text-btn-ink"
            >
              New
            </Link>
          </div>
        </div>
        <nav aria-label="Sections" className="flex gap-1 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`nav-item shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${
                isActive(item.href) ? "bg-btn text-btn-ink font-semibold" : "text-muted font-medium"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <aside className="hidden md:flex bg-bg border-r border-line px-4 py-5 flex-col gap-1 sticky top-0 h-screen overflow-y-auto">
        <Link href="/discover" aria-label="Viralyz home" className="px-2.5 pb-5 pt-1">
          <Logo />
        </Link>

        <div className="mb-5">
          <Link
            href="/studio"
            className="btn-primary flex w-full min-h-11 items-center justify-center gap-2 font-semibold text-[14px] rounded-full bg-btn text-btn-ink"
          >
            <Sparkles className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            New creative
          </Link>
          <p className="m-0 mt-2 text-[12px] text-muted text-center tabular">{creditLabel}</p>
        </div>

        <nav aria-label="Sections" className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-item flex items-center gap-3 px-3 min-h-10 rounded-full text-[14px] ${
                  item.href === "/admin" ? "mt-3" : ""
                } ${active ? "bg-panel text-ink font-semibold" : "text-muted font-medium"}`}
              >
                <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-line flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-1">
            <div
              className="w-[34px] h-[34px] shrink-0 rounded-full flex items-center justify-center bg-ink text-bg font-semibold text-[12px]"
              aria-hidden="true"
            >
              {initials(userName)}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] leading-tight truncate">{userName}</div>
              <div className="text-[12px] text-muted mt-[2px] tabular">{creditLabel}</div>
            </div>
            {signOutButton}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] text-muted">Digiteq Holdings</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="px-4 md:px-10 pb-16 max-w-[1240px] w-full">
        {showOnboarding ? (
          <div className="mt-6 rounded-card border border-line bg-panel dots px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold text-[15px]">Welcome. Start with your brand.</div>
              <ol className="m-0 mt-2 p-0 list-none flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
                <li>01 · Confirm colours, logo and voice</li>
                <li>02 · Pick a reference in Discover</li>
                <li>03 · Generate and pre-flight in Studio</li>
              </ol>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/brand"
                className="btn-primary inline-flex min-h-10 items-center justify-center rounded-full bg-btn text-btn-ink text-[13px] font-semibold px-4"
              >
                Set up brand
              </Link>
              <button
                type="button"
                onClick={() => void dismissOnboarding()}
                className="btn-outline min-h-10 rounded-full border border-line bg-card text-ink text-[13px] px-4 cursor-pointer"
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
