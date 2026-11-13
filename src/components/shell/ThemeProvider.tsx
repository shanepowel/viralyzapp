"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light by default; dark via data-theme="dark" on <html>, same as the
 * marketing site. "Match device" is a choice the user makes, not the default.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      enableColorScheme={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
