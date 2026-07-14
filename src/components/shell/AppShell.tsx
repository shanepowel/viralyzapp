"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Calendar,
  Clapperboard,
  FileText,
  Home,
  Image as ImageIcon,
  Library,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

type Props = {
  children: ReactNode;
  userName?: string;
  momentum?: number[];
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  group: string | null;
  badge?: string;
};

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: Home, group: null },
  { href: "/library", label: "Library", icon: Library, group: null, badge: "24" },
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

export function AppShell({ children, userName = "Maya R.", momentum = [5, 7, 6, 9, 11, 14] }: Props) {
  const pathname = usePathname();

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
            href="/"
            className="btn-primary flex w-full items-center justify-center gap-2 font-semibold text-[13.5px] py-[11px] rounded-full border-none bg-[var(--violet)] text-white"
          >
            ✦&nbsp;&nbsp;Score content
          </Link>
        </div>

        {navWithGroups.map(({ item, showGroup }) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/content")
              : pathname === item.href;
          const Icon = item.icon;
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
                {item.badge && (
                  <span className="ml-auto font-mono text-[10px] bg-[var(--tint)] rounded-full px-[7px] py-px text-[var(--ink-3)]">
                    {item.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}

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
            <Settings className="ml-auto w-[15px] opacity-40" strokeWidth={2} />
          </div>
          <div className="text-[10.5px] text-[var(--ink-3)] pt-2.5 px-0">
            A Digiteq Holdings company
          </div>
        </div>
      </aside>

      <main className="px-4 md:px-9 pb-12 max-w-[1160px] w-full">{children}</main>
    </div>
  );
}
