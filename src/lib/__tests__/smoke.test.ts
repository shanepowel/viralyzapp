import { describe, expect, it } from "vitest";
import { parseSession, serializeSession } from "@/lib/session-cookie";

describe("session cookie", () => {
  const user = { userId: "user_1", email: "a@example.com", name: "Ada" };

  it("round-trips a valid session", async () => {
    const cookie = await serializeSession(user);
    const parsed = await parseSession(cookie);
    expect(parsed).toEqual({ ...user, iat: expect.any(Number) });
  });

  it("rejects a tampered value", async () => {
    const cookie = await serializeSession(user);
    const tampered = cookie.slice(0, -1) + (cookie.at(-1) === "a" ? "b" : "a");
    expect(await parseSession(tampered)).toBeNull();
  });
});
