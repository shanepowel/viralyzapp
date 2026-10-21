"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { VariantCard, type CreativeDTO } from "@/components/studio/VariantCard";

const POLL_INTERVAL_MS = 2000;

export function CreativesView({ initialCreatives }: { initialCreatives: CreativeDTO[] }) {
  const [creatives, setCreatives] = useState<CreativeDTO[]>(initialCreatives);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pollCreative(id: string) {
    async function tick() {
      const res = await fetch(`/api/studio/creatives/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreatives((prev) => prev.map((c) => (c.id === id ? toDTO(data.creative) : c)));
      if (data.creative.status === "pending" || data.creative.status === "generating") {
        setTimeout(() => void tick(), POLL_INTERVAL_MS);
      }
    }
    void tick();
  }

  async function regenerate(creative: CreativeDTO) {
    setRegeneratingId(creative.id);
    setError(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: creative.productId,
          placement: creative.placement,
          angles: [creative.angle],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "insufficient_credits" ? "Not enough credits to regenerate." : "Could not regenerate.",
        );
        return;
      }
      const [newId] = data.creativeIds as string[];
      setCreatives((prev) => [
        { ...creative, id: newId, tag: "", status: "pending", compositeUrl: null, checks: [] },
        ...prev.filter((c) => c.id !== creative.id),
      ]);
      pollCreative(newId);
    } finally {
      setRegeneratingId(null);
    }
  }

  if (creatives.length === 0) {
    return (
      <Panel>
        <div className="p-6 text-[13px] text-[var(--ink-2)]">
          Nothing generated yet. Head to the Studio to create your first variants.
        </div>
      </Panel>
    );
  }

  return (
    <div className="vfade">
      {error && (
        <div className="rounded-[10px] bg-[var(--s30-soft)] text-[var(--s30)] text-[12.5px] px-3.5 py-2.5 mb-5">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {creatives.map((creative) => (
          <VariantCard
            key={creative.id}
            creative={creative}
            onRegenerate={() => void regenerate(creative)}
            regenerating={regeneratingId === creative.id}
          />
        ))}
      </div>
    </div>
  );
}

function toDTO(raw: {
  id: string;
  tag: string;
  angle: string;
  placement: string;
  productId: string;
  status: CreativeDTO["status"];
  headline: string | null;
  compositeUrl: string | null;
  aiGenerated: boolean;
  checks: Array<{ headline: number | null; headlineBasis: unknown; factors: unknown }>;
}): CreativeDTO {
  return {
    id: raw.id,
    tag: raw.tag,
    angle: raw.angle,
    placement: raw.placement,
    productId: raw.productId,
    status: raw.status,
    headline: raw.headline,
    compositeUrl: raw.compositeUrl,
    aiGenerated: raw.aiGenerated,
    checks: raw.checks.map((c) => ({
      headline: c.headline,
      headlineBasis: c.headlineBasis as { counted: number; total: number },
      factors: c.factors as CreativeDTO["checks"][number]["factors"],
    })),
  };
}
