import { afterEach, describe, expect, it } from "vitest";

describe("GET /api/cron/studio", () => {
  const previous = process.env.CRON_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  it("refuses a call that does not carry the cron secret", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const { GET } = await import("@/app/api/cron/studio/route");
    const res = await GET(new Request("http://localhost/api/cron/studio"));
    expect(res.status).toBe(401);
  });
});
