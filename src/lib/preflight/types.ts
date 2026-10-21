export type FactorResult = {
  id: string;
  label: string;
  kind: "computed" | "rule" | "model";
  status: "scored" | "unavailable";
  value?: number;
  passed?: boolean;
  evidence: string;
  source?: string;
};

export type Placement = {
  id: "meta_feed_1x1" | "meta_feed_4x5" | "story_9x16" | "tiktok_9x16";
  width: number;
  height: number;
  safeZone: { top: number; bottom: number; left: number; right: number };
  headlineMax: number;
  primaryMax: number;
  source: string;
};

export type TextBox = {
  role: "headline" | "price" | "cta";
  x: number;
  y: number;
  w: number;
  h: number;
  fg: string;
  bg: string;
  overflowed: boolean;
  // Not in the original interface sketch, but checkCharLimits has nothing
  // else to measure a character count against — without it, that factor
  // could never fail the way its own test requires.
  text: string;
};

export type CompositeLayout = {
  width: number;
  height: number;
  textBoxes: TextBox[];
};
