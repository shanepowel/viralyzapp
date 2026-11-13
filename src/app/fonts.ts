import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";

/** Schibsted Grotesk: every word in the interface. Headlines at 800, reading text at 400. */
export const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-vz",
  display: "swap",
});

/** IBM Plex Mono: anything measured, small caps labels, and (in italic) margin notes. */
export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-mono-vz",
  display: "swap",
});
