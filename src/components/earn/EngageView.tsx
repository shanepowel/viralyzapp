"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

type Comment = {
  id: string;
  platform: string;
  authorName: string;
  body: string;
  contentTitle: string | null;
  reply: string | null;
};

export function EngageView({ comments: initial }: { comments: Comment[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reply(id: string) {
    const text = drafts[id]?.trim();
    if (!text) return;
    setBusyId(id);
    await fetch("/api/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reply: text }),
    });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="vfade">
      <div className="py-[22px] pb-6">
        <h1 className="font-display text-2xl font-bold m-0">Engage</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">
          Inbox from connected platforms. Reply and keep the thread.
        </p>
      </div>
      <div className="grid gap-3">
        {initial.map((c) => (
          <Panel key={c.id}>
            <div className="p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-3)] mb-1">
                {c.platform} · {c.authorName}
                {c.contentTitle ? ` · on ${c.contentTitle}` : ""}
              </div>
              <div className="text-[14px] mb-3">{c.body}</div>
              {c.reply ? (
                <div className="rounded-[10px] bg-[var(--s90-soft)] px-3.5 py-2.5 text-[13px]">
                  <span className="font-semibold text-[var(--s90)]">You · </span>
                  {c.reply}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={drafts[c.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder="Write a reply"
                    className="flex-1 rounded-full border border-[var(--line-strong)] px-4 py-2 text-[13px]"
                  />
                  <Button size="sm" disabled={busyId === c.id} onClick={() => void reply(c.id)}>
                    Reply
                  </Button>
                </div>
              )}
            </div>
          </Panel>
        ))}
        {initial.length === 0 && (
          <Panel>
            <div className="p-6 text-[var(--ink-2)]">
              No comments yet. Connect a platform from the dashboard to sync an inbox.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
