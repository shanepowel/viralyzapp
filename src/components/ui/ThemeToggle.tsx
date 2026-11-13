"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match device" },
] as const;

/** Light / Dark / Match device, as a segmented control with words rather than icons. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Theme is only known on the client; render unselected until then.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "light") : null;

  return (
    <div role="radiogroup" aria-label="Colour theme" className={`inline-flex border border-rule ${className}`}>
      {OPTIONS.map((opt, i) => {
        const checked = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setTheme(opt.value)}
            className={`min-h-9 cursor-pointer border-0 px-3 text-[13px] font-medium ${i > 0 ? "border-l border-rule" : ""} ${
              checked ? "bg-ink text-bg" : "bg-transparent text-ink hover:bg-panel"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
