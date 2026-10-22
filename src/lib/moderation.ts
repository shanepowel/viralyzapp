/**
 * Screens a model-written image prompt before it reaches the image
 * provider. Rule-based on purpose: every block names the rule that fired,
 * so a failed variant can say why. Narrow patterns, not a full classifier —
 * the copy model is also instructed to avoid all of this (see copy.ts).
 */

type ModerationRule = { id: string; reason: string; pattern: RegExp };

const RULES: ModerationRule[] = [
  {
    id: "real_person_likeness",
    reason: "asks for a real or famous person's likeness",
    pattern:
      /\b(?:celebrit(?:y|ies)|famous (?:person|people|actor|actress|athlete|singer|influencer)|look-?alike|likeness of|resembl(?:es|ing) (?:a |the )?(?:famous|real|well-known)|in the style of [A-Z][a-z]+ [A-Z][a-z]+)\b/i,
  },
  {
    id: "sexual_content",
    reason: "asks for sexual or nude content",
    pattern: /\b(?:nude|naked|nsfw|topless|explicit|sexual|lingerie model|erotic)\b/i,
  },
  {
    id: "violence",
    reason: "asks for violence or gore",
    pattern: /\b(?:gore|gory|bloody|blood-soaked|corpse|dead body|violence|violent|wounded)\b/i,
  },
  {
    id: "rendered_text",
    reason: "asks the image model to render text, which our compositor owns",
    pattern: /\b(?:with (?:the )?(?:text|words|caption|headline|slogan)|text that says|words? reading)\b/i,
  },
];

export function moderateImagePrompt(prompt: string): { ok: true } | { ok: false; rule: string; reason: string } {
  for (const rule of RULES) {
    if (rule.pattern.test(prompt)) {
      return { ok: false, rule: rule.id, reason: rule.reason };
    }
  }
  return { ok: true };
}
