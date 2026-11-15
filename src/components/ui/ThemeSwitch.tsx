"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * The light/dark switch that sits in the top bar, where people look for it.
 * It names the theme you would switch to. "Match device" lives with the
 * full control (footer on the site; Account and the user menu in the app).
 */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // The theme is only known on the client; hold the label until then.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to the light theme" : "Switch to the dark theme"}
      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-inner border border-rule bg-transparent px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink hover:bg-panel ${className}`}
    >
      <span aria-hidden="true" className="inline-block h-[9px] w-[9px] border border-ink" style={{ background: dark ? "transparent" : "var(--vz-ink)" }} />
      <span suppressHydrationWarning>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
