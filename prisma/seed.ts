import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.scoreJob.deleteMany();
  await prisma.actualPerformance.deleteMany();
  await prisma.fix.deleteMany();
  await prisma.retentionCurve.deleteMany();
  await prisma.score.deleteMany();
  await prisma.contentVersion.deleteMany();
  await prisma.content.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.mediaKit.deleteMany();
  await prisma.platform.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Maya R.",
      avatarUrl: null,
      plan: "unlimited",
      platforms: {
        create: [
          { provider: "tiktok", handle: "@mayacooks", syncStatus: "ok" },
          { provider: "instagram", handle: "@mayacooks", syncStatus: "ok" },
          { provider: "youtube", handle: "MayaCooks", syncStatus: "ok" },
        ],
      },
      mediaKit: {
        create: {
          viewsThisWeek: 142,
          newOrdersCount: 2,
          lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      },
      insights: {
        create: [
          {
            icon: "?",
            statement: "Questions in your first line do 2.1 times better than statements.",
            supportingNote: "Based on your last 34 posts",
            metricKey: "question_hook_lift",
            sampleSize: 34,
          },
          {
            icon: "◷",
            statement: "Tuesday and Thursday, 6pm are your strongest slots.",
            supportingNote: "From your real results",
            metricKey: "slot_strength",
            sampleSize: 34,
          },
          {
            icon: "▭",
            statement: "40 to 60 second videos hold your viewers best.",
            supportingNote: "Longer ones lose people at the midpoint",
            metricKey: "duration_bucket_retention",
            sampleSize: 28,
          },
        ],
      },
    },
    include: { platforms: true },
  });

  const tiktok = user.platforms.find((p) => p.provider === "tiktok")!;
  const ig = user.platforms.find((p) => p.provider === "instagram")!;
  const yt = user.platforms.find((p) => p.provider === "youtube")!;

  const kitchen = await prisma.content.create({
    data: {
      userId: user.id,
      platformId: tiktok.id,
      title: "Kitchen hacks pt.3",
      durationSec: 42,
      thumbnailUrl: "linear-gradient(135deg,#F2994A,#EB5757)",
      status: "draft",
    },
  });

  const pasta = await prisma.content.create({
    data: {
      userId: user.id,
      platformId: ig.id,
      title: "5 minute pasta, honestly",
      durationSec: 38,
      thumbnailUrl: "linear-gradient(135deg,#6C4CF1,#3D2A9E)",
      status: "tracking",
      postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  const qa = await prisma.content.create({
    data: {
      userId: user.id,
      platformId: tiktok.id,
      title: "Q&A: your cooking fails",
      durationSec: 64,
      thumbnailUrl: "linear-gradient(135deg,#56CCF2,#2F80ED)",
      status: "scheduled",
      scheduledFor: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
  });

  const market = await prisma.content.create({
    data: {
      userId: user.id,
      platformId: yt.id,
      title: "Behind the scenes, market run",
      durationSec: 492,
      thumbnailUrl: "linear-gradient(135deg,#27AE60,#145A32)",
      status: "posted",
      postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // Kitchen v1
  const kitchenV1 = await prisma.contentVersion.create({
    data: {
      contentId: kitchen.id,
      versionNumber: 1,
      score: {
        create: {
          overallScore: 74,
          componentScores: { opening: 12, visuals: 16, pacing: 15, words: 15, timing: 16 },
          componentNotes: {
            opening: "Payoff arrives too late in the first nine seconds.",
            visuals: "Bright, readable, a clear face. Works at feed size.",
            pacing: "One slow moment at 0:41 where the shot holds still.",
            words: "Caption and tags are solid. Good niche tag mix.",
            timing: "Tonight at 6pm is your peak. Scheduled slot is good.",
          },
          verdict: "Needs a stronger open before posting.",
          predictedViewsLow: 120000,
          predictedViewsHigh: 180000,
          confidencePct: 72,
          sampleSize: 41,
        },
      },
    },
  });

  // Kitchen v2 (current)
  const kitchenV2 = await prisma.contentVersion.create({
    data: {
      contentId: kitchen.id,
      versionNumber: 2,
      score: {
        create: {
          overallScore: 87,
          componentScores: { opening: 19, visuals: 18, pacing: 15, words: 18, timing: 17 },
          componentNotes: {
            opening: "Strong. The payoff lands in the first second.",
            visuals: "Bright, readable, a clear face. Works at feed size.",
            pacing: "One slow moment at 0:41 where the shot holds still.",
            words: "Caption and tags are solid. Good niche tag mix.",
            timing: "Tonight at 6pm is your peak. Scheduled slot is good.",
          },
          verdict: "Ready to post. One small fix would make it great.",
          predictedViewsLow: 180000,
          predictedViewsHigh: 240000,
          confidencePct: 78,
          sampleSize: 41,
          computedAt: new Date(Date.now() - 2 * 60 * 1000),
        },
      },
      fixes: {
        create: [
          {
            title: "Trim the pause at 0:41",
            description:
              "The shot holds still for four seconds while you plate up. People start leaving here.",
            suggestionText:
              "Cut to the close-up at 0:43 two seconds earlier, or add a text overlay over the pause.",
            pointValue: 3,
            railSeverity: "med",
            applied: false,
          },
          {
            title: "Rewrite the first line",
            description: "Version 1 buried the payoff at nine seconds in.",
            suggestionText: '"I have been cutting onions wrong for 20 years."',
            pointValue: 9,
            railSeverity: "high",
            applied: true,
            appliedAt: new Date(Date.now() - 10 * 60 * 1000),
            pointsEarned: 9,
          },
          {
            title: "Bigger thumbnail text",
            description: "The old text disappeared at feed size.",
            suggestionText: 'Three words, high contrast: "ONIONS. YOU\'RE WRONG."',
            pointValue: 4,
            railSeverity: "med",
            applied: true,
            appliedAt: new Date(Date.now() - 10 * 60 * 1000),
            pointsEarned: 4,
          },
        ],
      },
      retentionCurve: {
        create: {
          curvePoints: [
            { tSeconds: 0, pctRemaining: 100 },
            { tSeconds: 10, pctRemaining: 92 },
            { tSeconds: 20, pctRemaining: 84 },
            { tSeconds: 30, pctRemaining: 76 },
            { tSeconds: 41, pctRemaining: 62 },
            { tSeconds: 42, pctRemaining: 58 },
          ],
          riskMomentSec: 41,
          riskNote: "Risk moment at 0:41. The still shot loses people. The fix above deals with this.",
        },
      },
    },
  });

  void kitchenV1;
  void kitchenV2;

  await prisma.contentVersion.create({
    data: {
      contentId: pasta.id,
      versionNumber: 1,
      score: {
        create: {
          overallScore: 91,
          componentScores: { opening: 19, visuals: 19, pacing: 18, words: 18, timing: 17 },
          componentNotes: {
            opening: "Hook lands immediately.",
            visuals: "Clear plating shots.",
            pacing: "Tight cuts throughout.",
            words: "Strong caption.",
            timing: "Posted in a peak window.",
          },
          verdict: "Performing above prediction.",
          predictedViewsLow: 220000,
          predictedViewsHigh: 280000,
          confidencePct: 80,
          sampleSize: 41,
        },
      },
    },
  });

  await prisma.actualPerformance.create({
    data: { contentId: pasta.id, actualViews: 312000 },
  });

  await prisma.contentVersion.create({
    data: {
      contentId: qa.id,
      versionNumber: 1,
      score: {
        create: {
          overallScore: 72,
          componentScores: { opening: 15, visuals: 14, pacing: 14, words: 15, timing: 14 },
          componentNotes: {
            opening: "Solid question open.",
            visuals: "A bit dark in the first frame.",
            pacing: "Holds attention through the middle.",
            words: "Good reply cadence.",
            timing: "Scheduled for a strong slot.",
          },
          verdict: "Good draft. Schedule when ready.",
          predictedViewsLow: 80000,
          predictedViewsHigh: 110000,
          confidencePct: 70,
          sampleSize: 41,
        },
      },
    },
  });

  await prisma.contentVersion.create({
    data: {
      contentId: market.id,
      versionNumber: 1,
      score: {
        create: {
          overallScore: 58,
          componentScores: { opening: 12, visuals: 13, pacing: 10, words: 12, timing: 11 },
          componentNotes: {
            opening: "Slow start for Shorts/TikTok pace.",
            visuals: "Market light is nice but busy.",
            pacing: "Midpoint drop-off risk.",
            words: "Caption could lead with the tip.",
            timing: "Off-peak publish window.",
          },
          verdict: "Missed the predicted range — useful training signal.",
          predictedViewsLow: 40000,
          predictedViewsHigh: 50000,
          confidencePct: 65,
          sampleSize: 41,
        },
      },
    },
  });

  await prisma.actualPerformance.create({
    data: { contentId: market.id, actualViews: 23000 },
  });

  // Extra scored posts for monthly averages / accuracy window
  for (let i = 0; i < 8; i++) {
    const c = await prisma.content.create({
      data: {
        userId: user.id,
        platformId: tiktok.id,
        title: `Archive clip ${i + 1}`,
        durationSec: 40 + i,
        thumbnailUrl: "linear-gradient(135deg,#F1EFEA,#D6D2C8)",
        status: "posted",
        postedAt: new Date(Date.now() - (i + 6) * 24 * 60 * 60 * 1000),
      },
    });
    const predicted = 50000 + i * 8000;
    const actual = i % 3 === 0 ? predicted - 12000 : predicted + 5000;
    await prisma.contentVersion.create({
      data: {
        contentId: c.id,
        versionNumber: 1,
        score: {
          create: {
            overallScore: 68 + (i % 5) * 3,
            componentScores: { opening: 14, visuals: 14, pacing: 13, words: 14, timing: 13 },
            componentNotes: {
              opening: "Archive scoring note.",
              visuals: "Archive scoring note.",
              pacing: "Archive scoring note.",
              words: "Archive scoring note.",
              timing: "Archive scoring note.",
            },
            verdict: "Archived.",
            predictedViewsLow: predicted - 10000,
            predictedViewsHigh: predicted + 10000,
            confidencePct: 70,
            sampleSize: 34,
          },
        },
      },
    });
    await prisma.actualPerformance.create({
      data: { contentId: c.id, actualViews: actual },
    });
  }

  console.log("Seeded Viralyz demo data for", user.name);
  console.log("Hero content id:", kitchen.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
