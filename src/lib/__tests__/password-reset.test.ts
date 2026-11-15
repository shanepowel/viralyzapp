import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/auth-handlers";
import { passwordResetBody, passwordResetDeliveryEnabled } from "@/lib/password-reset";
import { verifiedClerkEmail } from "@/lib/users";

describe("password reset delivery", () => {
  it("does not mint reset tokens in production when email is not configured", () => {
    expect(passwordResetDeliveryEnabled("production", false)).toBe(false);
    expect(passwordResetDeliveryEnabled("production", true)).toBe(true);
    expect(passwordResetDeliveryEnabled("development", false)).toBe(true);
    expect(passwordResetDeliveryEnabled("test", false)).toBe(true);
  });

  it("never puts the reset link in a production response", () => {
    expect(
      passwordResetBody({
        mocked: true,
        link: "https://app.viralyz.com/login?reset=secret",
        nodeEnv: "production",
      }),
    ).toEqual({ ok: true });
  });

  it("keeps the reset link on the local sign-in screen", () => {
    expect(
      passwordResetBody({
        mocked: true,
        link: "http://localhost:3000/login?reset=secret",
        nodeEnv: "development",
      }),
    ).toEqual({ ok: true, devLink: "http://localhost:3000/login?reset=secret" });
  });
});

describe("sign-in payloads", () => {
  it("rejects a role or plan sent with signup or login", () => {
    expect(
      signupSchema.safeParse({
        name: "Seller",
        email: "seller@example.com",
        password: "password1",
        role: "superadmin",
      }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: "seller@example.com",
        password: "password1",
        role: "superadmin",
        plan: "unlimited",
      }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({
        name: "Seller",
        email: "seller@example.com",
        password: "password1",
      }).success,
    ).toBe(true);
  });
});

describe("clerk inbox", () => {
  it("ignores an unverified address that matches a staff inbox", () => {
    expect(
      verifiedClerkEmail({
        primaryEmailAddress: {
          emailAddress: "shane.powell@bmkrs.com",
          verification: { status: "unverified" },
        },
      }),
    ).toBeNull();
    expect(
      verifiedClerkEmail({
        primaryEmailAddress: {
          emailAddress: "shane.powell@bmkrs.com",
          verification: { status: "verified" },
        },
      }),
    ).toBe("shane.powell@bmkrs.com");
  });
});
