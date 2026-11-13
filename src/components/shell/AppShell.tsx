"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClerkSignOut } from "@/components/shell/ClerkSignOut";
import { buttonClasses } from "@/components/ui/Button";
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

type NavItem = { href: string; label: string };

/** The work, in the order it happens. Studio is home. */
const primary: NavItem[] = [
  { href: "/studio", label: "Studio" },
  { href: "/creatives", label: "Creatives" },
  { href: "/discover", label: "Discover" },
  { href: "/brand", label: "Brand" },
  { href: "/results", label: "Results" },
];

const account: NavItem = { href: "/account", label: "Account" };
const admin: NavItem = { href: "/admin", label: "Admin" };

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the user menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen && !moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMoreOpen(false);
      }
    }
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen, moreOpen]);

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

  const unlimited = plan === "unlimited";
  const creditCount = unlimited ? "Unlimited" : String(balance ?? 0);
  const creditLabel = unlimited ? "Unlimited credits" : `${balance ?? 0} credits`;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const secondary = isAdmin ? [account, admin] : [account];
  const moreActive = isActive("/results") || isActive("/account") || isActive("/admin");

  const signOutControl = clerkEnabled ? (
    <ClerkSignOut />
  ) : (
    <button
      type="button"
      onClick={() => void signOut()}
      className="min-h-11 w-full cursor-pointer border-0 bg-transparent px-0 text-left text-[14px] font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
    >
      Sign out
    </button>
  );

  const link = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`nav-item relative inline-flex h-14 items-center px-0.5 text-[14px] ${
          active
            ? "font-semibold text-ink after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[3px] after:bg-ink"
            : "font-medium text-muted"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-bg">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 md:px-8">
          <Link href="/studio" aria-label="Viralyz, go to Studio" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
            {primary.map(link)}
          </nav>

          <div className="ml-auto flex items-center gap-4 md:gap-5">
            <Link
              href="/account"
              className="nav-item font-mono text-[12px] text-muted"
              aria-label={`${creditLabel}. Open account`}
            >
              <span className="font-medium text-ink">{creditCount}</span>
              {unlimited ? null : <span className="hidden sm:inline"> credits</span>}
              {unlimited ? null : <span className="sm:hidden"> cr</span>}
            </Link>
            <Link href="/studio?new=1" className={buttonClasses("primary", "sm")}>
              New batch
            </Link>
            <nav aria-label="Account" className="hidden items-center gap-5 md:flex">
              {secondary.map(link)}
            </nav>
            <div ref={menuRef} className="relative hidden md:block">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`${userName}: theme and sign out`}
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-rule bg-transparent font-mono text-[12px] font-medium text-ink hover:bg-panel"
              >
                {initials(userName)}
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="vfade absolute right-0 top-[calc(100%+8px)] z-40 w-[280px] border border-rule bg-card p-4 shadow-float"
                >
                  <p className="kicker m-0">Signed in as</p>
                  <p className="m-0 mt-1 truncate text-[15px] font-semibold">{userName}</p>
                  <p className="m-0 mt-0.5 font-mono text-[12px] text-muted">{creditLabel}</p>
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="kicker m-0 mb-2">Theme</p>
                    <ThemeToggle />
                  </div>
                  <div className="mt-3 border-t border-line pt-1">{signOutControl}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-28 md:px-8 md:pb-16">
        {showOnboarding ? (
          <section aria-label="Getting started" className="mt-6 border-y border-rule py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="kicker m-0">First run</p>
                <p className="font-display m-0 mt-1.5 text-[22px]">Three steps to ads that are checked before you spend.</p>
                <ol className="m-0 mt-3 grid list-none gap-x-6 gap-y-1 p-0 text-[13px] text-ink-2 sm:grid-cols-3">
                  <li>
                    <span className="font-mono text-muted">1 </span>Confirm your colours, logo and voice
                  </li>
                  <li>
                    <span className="font-mono text-muted">2 </span>Pick a reference in Discover
                  </li>
                  <li>
                    <span className="font-mono text-muted">3 </span>Make a batch and clear its marks
                  </li>
                </ol>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href="/brand" className={buttonClasses("primary", "sm")}>
                  Set up brand
                </Link>
                <button type="button" onClick={() => void dismissOnboarding()} className={buttonClasses("outline", "sm")}>
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        ) : null}
        {children}
      </main>

      {/* Mobile: a bottom tab bar, with the less-used sections behind More. */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-rule bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.slice(0, 4).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-14 items-center justify-center text-[12px] ${
                active
                  ? "font-semibold text-ink before:absolute before:inset-x-3 before:top-[-1px] before:h-[3px] before:bg-ink"
                  : "font-medium text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
          className={`relative flex h-14 cursor-pointer items-center justify-center border-0 bg-transparent text-[12px] ${
            moreActive
              ? "font-semibold text-ink before:absolute before:inset-x-3 before:top-[-1px] before:h-[3px] before:bg-ink"
              : "font-medium text-muted"
          }`}
        >
          More
        </button>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 cursor-default border-0 bg-scrim"
          />
          <div className="vfade absolute inset-x-0 bottom-0 border-t border-rule bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
            <div className="flex items-baseline justify-between">
              <p className="m-0 truncate text-[15px] font-semibold">{userName}</p>
              <p className="m-0 font-mono text-[12px] text-muted">{creditLabel}</p>
            </div>
            <ul className="m-0 mt-3 list-none border-t border-rule p-0">
              {[primary[4], ...secondary].map((item) => (
                <li key={item.href} className="border-b border-line">
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className="flex min-h-12 items-center justify-between text-[15px] font-medium"
                  >
                    {item.label}
                    <span aria-hidden="true" className="font-mono text-muted">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <p className="kicker m-0 mb-2">Theme</p>
              <ThemeToggle />
            </div>
            <div className="mt-2">{signOutControl}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
