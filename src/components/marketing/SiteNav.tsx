"use client";

import Link from "next/link";
import { useId, useState } from "react";

const SITE = "https://viralyz.com";

type MegaLink = { href: string; ico: string; title: string; desc: string };
type MegaCol = { heading: string; links: MegaLink[] };
type NavItem = {
  label: string;
  href: string;
  cols?: MegaCol[];
  feature?: { href: string; title: string; desc: string };
};

const NAV: NavItem[] = [
  {
    label: "Platform",
    href: `${SITE}/platform`,
    cols: [
      {
        heading: "Score & fix",
        links: [
          { href: "/score", ico: "Sc", title: "Video scoring", desc: "Score out of 100 in 30 seconds" },
          { href: "/hook-lab", ico: "Hk", title: "Hook tester", desc: "Ten opening lines, ranked" },
          { href: "/script-doctor", ico: "Tp", title: "Teleprompter", desc: "Script feedback while you record" },
        ],
      },
      {
        heading: "Grow",
        links: [
          { href: "/thumbnails", ico: "Th", title: "Thumbnail tests", desc: "Compare against your feed rivals" },
          { href: "/analytics", ico: "An", title: "Analytics", desc: "Track score trends over time" },
          {
            href: `${SITE}/platform#integrations`,
            ico: "Ap",
            title: "Integrations",
            desc: "TikTok, YouTube, Instagram, X",
          },
        ],
      },
    ],
    feature: {
      href: "/score",
      title: "New: live score while recording",
      desc: "See your number before you even post",
    },
  },
  {
    label: "For creators",
    href: `${SITE}/for-creators`,
    cols: [
      {
        heading: "Get discovered",
        links: [
          {
            href: `${SITE}/for-creators#profile`,
            ico: "Pr",
            title: "Verified profile",
            desc: "Real numbers, checked hourly",
          },
          { href: "/media-kit", ico: "Mk", title: "Media kit builder", desc: "One link brands can trust" },
          {
            href: `${SITE}/tools/engagement-calculator`,
            ico: "Rt",
            title: "Rate calculator",
            desc: "Suggested rates by niche",
          },
        ],
      },
      {
        heading: "Learn",
        links: [
          { href: `${SITE}/blog`, ico: "Ac", title: "Creator academy", desc: "Courses on scoring higher" },
          {
            href: `${SITE}/for-creators#stories`,
            ico: "St",
            title: "How creators use it",
            desc: "Score, fix, and build a verified record",
          },
          { href: `${SITE}/affiliates`, ico: "Cm", title: "Community", desc: "Swap notes with other creators" },
        ],
      },
    ],
  },
  {
    label: "For brands",
    href: `${SITE}/for-brands`,
    cols: [
      {
        heading: "Find talent",
        links: [
          {
            href: `${SITE}/creators`,
            ico: "Se",
            title: "Search creators",
            desc: "Filter by niche, score, platform",
          },
          {
            href: `${SITE}/for-brands#campaigns`,
            ico: "Cg",
            title: "Campaign manager",
            desc: "Brief, book, and pay in one place",
          },
          {
            href: `${SITE}/report`,
            ico: "Vd",
            title: "Verified data",
            desc: "No self-reported follower counts",
          },
        ],
      },
      {
        heading: "Proof",
        links: [
          {
            href: `${SITE}/for-brands#cases`,
            ico: "Cs",
            title: "How campaigns work",
            desc: "Brief, book, and pay in one place",
          },
          { href: `${SITE}/pricing`, ico: "Ag", title: "Agencies", desc: "Manage multiple client rosters" },
          {
            href: `${SITE}/contact`,
            ico: "Sl",
            title: "Talk to sales",
            desc: "Book a walkthrough for your team",
          },
        ],
      },
    ],
  },
  {
    label: "Resources",
    href: `${SITE}/blog`,
    cols: [
      {
        heading: "Learn",
        links: [
          { href: `${SITE}/blog`, ico: "Bl", title: "Blog", desc: "Scoring breakdowns & case studies" },
          {
            href: `${SITE}/tools`,
            ico: "To",
            title: "Free tools",
            desc: "Calculators and checkers, no signup",
          },
          { href: `${SITE}/contact#help`, ico: "He", title: "Help center", desc: "Guides and how-tos" },
        ],
      },
      {
        heading: "Build",
        links: [
          {
            href: `${SITE}/platform#api`,
            ico: "Ap",
            title: "API docs",
            desc: "Pull scores into your own tools",
          },
          { href: `${SITE}/about`, ico: "Ab", title: "About Viralyz", desc: "What we build and why" },
          { href: `${SITE}/affiliates`, ico: "Af", title: "Affiliates", desc: "Earn by sharing Viralyz" },
        ],
      },
    ],
  },
];

function isExternal(href: string) {
  return href.startsWith("http");
}

function NavAnchor({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

export function SiteNav() {
  const toggleId = useId();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="vz-nav-root">
      <nav className="vz-nav" aria-label="Primary">
        <NavAnchor href="/" className="vz-brand">
          <span className="vz-mark" aria-hidden />
          Viralyz
        </NavAnchor>

        <div className="vz-nav-links">
          {NAV.map((item) => (
            <div
              key={item.label}
              className="vz-nav-item"
              onMouseEnter={() => setOpen(item.label)}
              onMouseLeave={() => setOpen(null)}
            >
              <NavAnchor
                href={item.href}
                className="vz-nav-trigger"
                aria-expanded={open === item.label}
                aria-haspopup={item.cols ? true : undefined}
              >
                {item.label}
                {item.cols ? <span className="vz-caret" aria-hidden /> : null}
              </NavAnchor>
              {item.cols && open === item.label ? (
                <div className="vz-mega" role="menu" aria-label={item.label}>
                  {item.cols.map((col) => (
                    <div key={col.heading} className="vz-mega-col">
                      <h5>{col.heading}</h5>
                      {col.links.map((link) => (
                        <NavAnchor key={link.title} href={link.href} className="vz-mega-link">
                          <span className="vz-ico">{link.ico}</span>
                          <span className="vz-txt">
                            <strong>{link.title}</strong>
                            <span>{link.desc}</span>
                          </span>
                        </NavAnchor>
                      ))}
                    </div>
                  ))}
                  {item.feature ? (
                    <NavAnchor href={item.feature.href} className="vz-mega-feat">
                      <span
                        className="vz-mega-feat-art"
                        style={{ background: "linear-gradient(135deg, #F2C94C, #F2994A)" }}
                        aria-hidden
                      />
                      <div className="vz-txt">
                        <strong>{item.feature.title}</strong>
                        <span>{item.feature.desc}</span>
                      </div>
                    </NavAnchor>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          <NavAnchor href={`${SITE}/pricing`} className="vz-nav-trigger vz-nav-plain">
            Pricing
          </NavAnchor>
        </div>

        <div className="vz-nav-actions">
          <NavAnchor href="/login" className="vz-signin">
            Sign in
          </NavAnchor>
          <NavAnchor href="/login?mode=signup" className="vz-btn-primary">
            Start free
          </NavAnchor>
          <label className="vz-hamburger" htmlFor={toggleId} aria-label="Menu">
            <span />
            <span />
            <span />
          </label>
        </div>
      </nav>

      <input
        type="checkbox"
        id={toggleId}
        className="vz-nav-toggle"
        aria-hidden
      />
      <div className="vz-mobile-panel">
        {NAV.map((item) => (
          <details key={item.label} className="vz-m-group">
            <summary>{item.label}</summary>
            <div className="vz-m-sub">
              <NavAnchor href={item.href}>Overview</NavAnchor>
              {item.cols?.flatMap((col) =>
                col.links.map((link) => (
                  <NavAnchor key={link.title} href={link.href}>
                    {link.title}
                  </NavAnchor>
                )),
              )}
              {item.feature ? (
                <NavAnchor href={item.feature.href}>{item.feature.title}</NavAnchor>
              ) : null}
            </div>
          </details>
        ))}
        <NavAnchor href={`${SITE}/pricing`} className="vz-m-plain">
          Pricing
        </NavAnchor>
        <NavAnchor href={`${SITE}/tools`} className="vz-m-plain">
          Free tools
        </NavAnchor>
        <NavAnchor href={`${SITE}/contact`} className="vz-m-plain">
          Contact
        </NavAnchor>
        <div className="vz-m-actions">
          <NavAnchor href="/login" className="vz-btn-ghost">
            Sign in
          </NavAnchor>
          <NavAnchor href="/login?mode=signup" className="vz-btn-primary">
            Start free
          </NavAnchor>
          <NavAnchor href="/score" className="vz-btn-ghost">
            Score a video
          </NavAnchor>
        </div>
      </div>
    </div>
  );
}
