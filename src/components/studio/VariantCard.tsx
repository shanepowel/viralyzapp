"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { PreflightBadge } from "@/components/ui/PreflightBadge";

export type FactorResultDTO = {
  id: string;
  label: string;
  kind: "computed" | "rule" | "model";
  status: "scored" | "unavailable";
  passed?: boolean;
  evidence: string;
};

export type CreativeDTO = {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  status: "pending" | "generating" | "ready" | "failed";
  headline: string | null;
  compositeUrl: string | null;
  aiGenerated: boolean;
  checks: Array<{
    headline: number | null;
    headlineBasis: { counted: number; total: number };
    factors: FactorResultDTO[];
  }>;
};

const KIND_LABEL: Record<FactorResultDTO["kind"], string> = {
  computed: "Computed",
  rule: "Rule",
  model: "AI-assessed",
};

function FactorRow({ factor }: { factor: FactorResultDTO }) {
  const color = factor.status === "unavailable" ? "var(--ink-3)" : factor.passed ? "var(--s90)" : "var(--s30)";
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span
        className="font-mono text-[9.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 shrink-0 bg-[var(--tint)]"
        style={{ color }}
      >
        {KIND_LABEL[factor.kind]}
      </span>
      <div className="flex-1 text-[12px]">
        <div className="font-medium text-[var(--ink)]">{factor.label}</div>
        <div className="text-[var(--ink-3)]">{factor.evidence}</div>
      </div>
    </div>
  );
}

export function VariantCard({
  creative,
  onRegenerate,
  regenerating,
}: {
  creative: CreativeDTO;
  onRegenerate: () => void;
  regenerating?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const latestCheck = creative.checks[0];

  async function copyTag() {
    try {
      await navigator.clipboard.writeText(creative.tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) — the
      // tag is still visible on the card to copy by hand.
    }
  }

  return (
    <Panel>
      <div className="p-4 flex flex-col gap-3">
        <div className="aspect-square rounded-[12px] bg-[var(--line)] overflow-hidden flex items-center justify-center">
          {creative.compositeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.compositeUrl}
              alt={creative.headline ?? "Generated ad"}
              className="w-full h-full object-cover"
            />
          ) : creative.status === "failed" ? (
            <span className="text-[12px] text-[var(--s30)]">Generation failed</span>
          ) : (
            <span className="text-[12px] text-[var(--ink-3)]">
              {creative.status === "pending" ? "Queued…" : "Generating…"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {creative.tag ? (
            <button
              type="button"
              onClick={() => void copyTag()}
              className="font-mono text-[11px] text-[var(--ink-3)] bg-transparent border-none cursor-pointer p-0"
            >
              {copied ? "Copied!" : creative.tag}
            </button>
          ) : (
            <span />
          )}
          {latestCheck && (
            <PreflightBadge
              headline={latestCheck.headline}
              counted={latestCheck.headlineBasis.counted}
              total={latestCheck.headlineBasis.total}
            />
          )}
        </div>

        {creative.aiGenerated && (
          <div className="text-[11px] text-[var(--ink-3)]">
            AI-generated — disclose this per your ad platform&apos;s policy.
          </div>
        )}

        {latestCheck && latestCheck.factors.length > 0 && (
          <div className="border-t border-[var(--line)] pt-1">
            {latestCheck.factors.map((factor) => (
              <FactorRow key={factor.id} factor={factor} />
            ))}
          </div>
        )}

        {(creative.status === "failed" || creative.status === "ready") && (
          <Button
            size="sm"
            variant={creative.status === "failed" ? "outline" : "ghost"}
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? "Regenerating…" : creative.status === "failed" ? "Retry" : "Regenerate this one"}
          </Button>
        )}
      </div>
    </Panel>
  );
}
