"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Calendar,
  Clapperboard,
  FileText,
  Home,
  Image as ImageIcon,
  Library,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { ClerkSignOut } from "@/components/shell/ClerkSignOut";

type Props = {
  children: ReactNode;
  userName?: string;
  momentum?: number[];
  plan?: string;
  creditsRemaining?: number;
  libraryCount?: number;
  isAdmin?: boolean;
  showOnboarding?: boolean;
  clerkEnabled?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  group: string | null;
  badgeKey?: "library";
};

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: Home, group: null },
  { href: "/library", label: "Library", icon: Library, group: null, badgeKey: "library" },
  { href: "/hook-lab", label: "Hook Lab", icon: Sparkles, group: "Create" },
  { href: "/script-doctor", label: "Script Doctor", icon: FileText, group: "Create" },
  { href: "/thumbnails", label: "Thumbnails", icon: ImageIcon, group: "Create" },
  { href: "/captions", label: "Captions", icon: MessageSquare, group: "Create" },
  { href: "/calendar", label: "Calendar", icon: Calendar, group: "Grow" },
  { href: "/trends", label: "Trends", icon: TrendingUp, group: "Grow" },
  { href: "/competitors", label: "Competitors", icon: Target, group: "Grow" },
  { href: "/media-kit", label: "Media Kit", icon: Clapperboard, group: "Earn" },
  { href: "/engage", label: "Engage", icon: Users, group: "Earn" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "Earn" },
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

function withGroupHeaders(items: NavItem[]) {
  let lastGroup: string | null = null;
  return items.map((item) => {
    const showGroup = Boolean(item.group && item.group !== lastGroup);
    if (item.group) lastGroup = item.group;
    return { item, showGroup };
  });
}

const navWithGroups = withGroupHeaders(nav);

export function AppShell({
  children,
  userName = "Creator",
  momentum = [5, 7, 6, 9, 11, 14],
  plan,
  creditsRemaining,
  libraryCount,
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

  const creditLabel =
    plan === "unlimited" ? "Unlimited scores" : `${creditsRemaining ?? 0} scores left`;
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
            href="/score"
            className="btn-primary flex w-full items-center justify-center gap-2 font-semibold text-[13.5px] py-[11px] rounded-full border-none bg-[var(--violet)] text-white"
          >
            ✦&nbsp;&nbsp;Score content
          </Link>
          <p className="m-0 mt-2 px-1 font-mono text-[10px] text-[var(--ink-3)] text-center">
            {creditLabel}
          </p>
        </div>

        {navWithGroups.map(({ item, showGroup }) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const badge =
            item.badgeKey === "library" && libraryCount != null ? String(libraryCount) : null;
          return (
            <div key={item.href}>
              {showGroup && item.group && (
                <div className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-[var(--ink-3)] px-2.5 pt-3.5 pb-1.5">
                  {item.group}
                </div>
              )}
              <Link
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
                {badge && (
                  <span className="ml-auto font-mono text-[10px] bg-[var(--tint)] rounded-full px-[7px] py-px text-[var(--ink-3)]">
                    {badge}
                  </span>
                )}
              </Link>
            </div>
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
              <div className="flex items-end gap-0.5 h-3.5 mt-[3px]">
                {momentum.map((h, i) => (
                  <i
                    key={i}
                    className="w-1 rounded-sm block"
                    style={{
                      height: `${h}px`,
                      background: i >= momentum.length - 3 ? "var(--s90)" : "var(--line-strong)",
                    }}
                  />
                ))}
              </div>
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
              <div className="font-display font-semibold text-[15px]">Welcome — score your first video</div>
              <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">
                Upload any short-form clip. You&apos;ll get a Viralyz Score, strengths, and next moves
                in under a minute.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/score"
                className="inline-flex items-center justify-center rounded-full bg-[var(--violet)] text-white text-[13px] font-semibold px-4 py-2 no-underline"
              >
                Score a video
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
