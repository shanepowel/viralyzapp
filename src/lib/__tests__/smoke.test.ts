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
    // Flip the payload's first character, not the signature's last one: a
    // trailing base64url character can carry unused padding bits, so
    // mutating it doesn't always change the decoded bytes (the signature
    // would still verify). The payload is compared as the raw signed
    // string, not decoded, so any character change there is guaranteed to
    // invalidate the signature.
    const tampered = (cookie[0] === "a" ? "b" : "a") + cookie.slice(1);
    expect(await parseSession(tampered)).toBeNull();
  });
});
