import { notFound } from "next/navigation";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { formatViews } from "@/lib/score-bands";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export default async function PublicKitPage({ params }: Props) {
  const { handle } = await params;
  const user = await prisma.user.findUnique({
    where: { handle },
    include: {
      mediaKit: true,
      content: {
        where: { NOT: { title: { startsWith: "Archive" } } },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            include: { score: true },
          },
        },
        take: 6,
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!user) notFound();

  const scores = user.content
    .map((c) => c.versions[0]?.score?.overallScore)
    .filter((s): s is number => s != null);
  const avg =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 70;
  const kit = user.mediaKit;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] px-6 py-12">
      <div className="max-w-[720px] mx-auto vfade">
        <div className="flex items-center gap-[9px] font-display font-bold text-[17px] mb-10">
          <span
            className="w-5 h-5 rounded-full border-[3px] border-[var(--violet)] inline-block"
            style={{ borderTopColor: "var(--s90)", transform: "rotate(-45deg)" }}
          />
          Viralyz
        </div>

        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[20px] p-8 shadow-[var(--shadow)]">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-display font-bold text-[18px]"
              style={{ background: "linear-gradient(135deg,#F2994A,#EB5757)" }}
            >
              {user.name
                .split(/\s+/)
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <h1 className="font-display text-[28px] font-bold m-0">{user.name}</h1>
              <div className="text-[13px] text-[var(--ink-3)] mt-1">
                @{user.handle} ·{" "}
                <span className="text-[var(--s90)] font-semibold">Viralyz Verified</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div>
              <div className="text-[12px] text-[var(--ink-3)] mb-2">Score</div>
              <ScoreRing score={avg} size="sm" />
            </div>
            <div>
              <div className="text-[12px] text-[var(--ink-3)]">Followers</div>
              <div className="font-display text-[28px] font-bold">
                {kit ? formatViews(kit.followers) : "—"}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-[var(--ink-3)]">Engagement</div>
              <div className="font-display text-[28px] font-bold">
                {kit ? `${kit.engagementPct}%` : "—"}
              </div>
            </div>
          </div>

          <h2 className="font-display text-[18px] font-semibold mb-3">Recent proof</h2>
          <div className="grid gap-2">
            {user.content.map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center py-2 border-b border-[var(--line)] last:border-0"
              >
                <span className="text-[13px] font-medium">{c.title}</span>
                {c.versions[0]?.score && <ScoreRing score={c.versions[0].score.overallScore} />}
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-[10.5px] text-[var(--ink-3)] mt-8">
          A Digiteq Holdings company · Numbers verified on Viralyz
        </p>
      </div>
    </div>
  );
}
