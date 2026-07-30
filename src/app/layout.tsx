import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { isClerkEnabled } from "@/lib/env";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-loaded",
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Viralyz",
  description: "Creator scoring dashboard — Signal design system",
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
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body
        className="min-h-full"
        style={
          {
            ["--font-display" as string]: "var(--font-display-loaded), 'Bricolage Grotesque', sans-serif",
            ["--font-body" as string]: "var(--font-body-loaded), Inter, system-ui, sans-serif",
            ["--font-mono" as string]: "var(--font-mono-loaded), 'JetBrains Mono', monospace",
          } as React.CSSProperties
        }
      >
        {content}
      </body>
    </html>
  );
}
