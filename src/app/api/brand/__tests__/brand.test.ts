import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const requireApiSessionMock = vi.fn();
vi.mock("@/lib/api", () => ({
  requireApiSession: () => requireApiSessionMock(),
}));

function asUser(userId: string) {
  requireApiSessionMock.mockResolvedValue({
    session: { userId, email: `${userId}@test.local`, name: "Test User" },
    user: { id: userId },
  });
}

let userAId: string;
let userBId: string;

beforeEach(async () => {
  const idA = randomUUID().slice(0, 8);
  const idB = randomUUID().slice(0, 8);
  const userA = await prisma.user.create({
    data: { email: `brand-a-${idA}@test.local`, name: "A", handle: `brand-a-${idA}` },
  });
  const userB = await prisma.user.create({
    data: { email: `brand-b-${idB}@test.local`, name: "B", handle: `brand-b-${idB}` },
  });
  userAId = userA.id;
  userBId = userB.id;
  requireApiSessionMock.mockReset();
});

afterEach(async () => {
  await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
});

const validProduct = {
  title: "Hand-Poured Candle",
  imageUrls: ["https://cdn.example.com/candle.jpg"],
};

describe("POST /api/brand", () => {
  it("requires a name", async () => {
    asUser(userAId);
    const { POST } = await import("@/app/api/brand/route");
    const res = await POST(
      new Request("http://localhost/api/brand", {
        method: "POST",
        body: JSON.stringify({ name: "", colors: [], product: validProduct }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("requires at least one product image", async () => {
    asUser(userAId);
    const { POST } = await import("@/app/api/brand/route");
    const res = await POST(
      new Request("http://localhost/api/brand", {
        method: "POST",
        body: JSON.stringify({
          name: "Hearth & Wick",
          colors: [],
          product: { title: "Candle", imageUrls: [] },
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("saves and confirms a valid brand", async () => {
    asUser(userAId);
    const { POST } = await import("@/app/api/brand/route");
    const res = await POST(
      new Request("http://localhost/api/brand", {
        method: "POST",
        body: JSON.stringify({ name: "Hearth & Wick", colors: ["#4b2e2e"], product: validProduct }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brand.name).toBe("Hearth & Wick");
    expect(body.brand.confirmedAt).not.toBeNull();
    expect(body.brand.products).toHaveLength(1);
  });

  it("updates the existing product on resubmission instead of creating another one", async () => {
    asUser(userAId);
    const { POST } = await import("@/app/api/brand/route");
    const submit = (product: typeof validProduct) =>
      POST(
        new Request("http://localhost/api/brand", {
          method: "POST",
          body: JSON.stringify({ name: "Hearth & Wick", colors: [], product }),
        }),
      );

    await submit(validProduct);
    const res = await submit({ ...validProduct, title: "Hand-Poured Candle (Large)" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brand.products).toHaveLength(1);
    expect(body.brand.products[0].title).toBe("Hand-Poured Candle (Large)");
  });
});

describe("GET /api/brand", () => {
  it("returns null when the user has no brand", async () => {
    asUser(userAId);
    const { GET } = await import("@/app/api/brand/route");
    const res = await GET();
    const body = await res.json();
    expect(body.brand).toBeNull();
  });

  it("never returns another user's brand", async () => {
    asUser(userAId);
    const { POST, GET } = await import("@/app/api/brand/route");
    await POST(
      new Request("http://localhost/api/brand", {
        method: "POST",
        body: JSON.stringify({ name: "Hearth & Wick", colors: [], product: validProduct }),
      }),
    );

    asUser(userBId);
    const res = await GET();
    const body = await res.json();
    expect(body.brand).toBeNull();
  });
});

describe("POST /api/brand/import", () => {
  it("returns 400 with blocked_address for a blocked URL", async () => {
    asUser(userAId);
    const { POST } = await import("@/app/api/brand/import/route");
    const res = await POST(
      new Request("http://localhost/api/brand/import", {
        method: "POST",
        body: JSON.stringify({ url: "http://127.0.0.1/" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("blocked_address");
  });

  it("rate-limits to 10 attempts per minute per user", async () => {
    asUser(userAId);
    const { POST } = await import("@/app/api/brand/import/route");
    const attempt = () =>
      POST(
        new Request("http://localhost/api/brand/import", {
          method: "POST",
          body: JSON.stringify({ url: "http://127.0.0.1/" }),
        }),
      );

    for (let i = 0; i < 10; i++) {
      const res = await attempt();
      expect(res.status).not.toBe(429);
    }
    const eleventh = await attempt();
    expect(eleventh.status).toBe(429);
  });
});
