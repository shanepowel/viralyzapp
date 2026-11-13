import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { mono, sans } from "@/app/fonts";
import { ThemeProvider } from "@/components/shell/ThemeProvider";
import { isClerkEnabled } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Viralyz", template: "%s | Viralyz" },
  description: "Make the ad. Check it. Then spend on it.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F4F1" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = isClerkEnabled() ? (
    <ClerkProvider signInUrl="/login" signUpUrl="/login" afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  ) : (
    children
  );

  return (
    // next-themes sets data-theme before paint, so the server markup differs by design.
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>{content}</ThemeProvider>
      </body>
    </html>
  );
}
