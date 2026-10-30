import { Archivo } from "next/font/google";

/** Archivo, variable with a width axis — the only family, as on the marketing site. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
