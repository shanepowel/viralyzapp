import { afterEach, describe, expect, it } from "vitest";
import {
  assignRoleDecision,
  DEFAULT_SUPER_ADMIN_EMAIL,
  promotedRole,
  roleForNewAccount,
} from "@/lib/roles";

const ORIGINAL_SUPER = process.env.SUPER_ADMIN_EMAILS;
const ORIGINAL_ADMIN = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL_SUPER === undefined) delete process.env.SUPER_ADMIN_EMAILS;
  else process.env.SUPER_ADMIN_EMAILS = ORIGINAL_SUPER;
  if (ORIGINAL_ADMIN === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN;
});

describe("staff roles", () => {
  it("treats the operator address as super admin when the env list is unset", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(roleForNewAccount(DEFAULT_SUPER_ADMIN_EMAIL)).toBe("superadmin");
    expect(promotedRole(DEFAULT_SUPER_ADMIN_EMAIL, "user")).toBe("superadmin");
  });

  it("keeps an explicitly configured super-admin list", () => {
    process.env.SUPER_ADMIN_EMAILS = "ops@example.com";
    expect(roleForNewAccount(DEFAULT_SUPER_ADMIN_EMAIL)).toBe("user");
    expect(roleForNewAccount("ops@example.com")).toBe("superadmin");
  });

  it("promotes an admin-list address from seller to admin and does not demote", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "studio@example.com";
    expect(promotedRole("studio@example.com", "user")).toBe("admin");
    expect(promotedRole("studio@example.com", "admin")).toBe("admin");
    expect(promotedRole("someone@example.com", "admin")).toBe("admin");
  });

  it("lets only a super admin assign seller or admin, and locks super admins", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    const actor = { role: "superadmin", email: "ops@example.com" };
    expect(assignRoleDecision(actor, "seller@example.com", "admin")).toBe("ok");
    expect(assignRoleDecision({ role: "admin", email: "studio@example.com" }, "seller@example.com", "admin")).toBe(
      "forbidden",
    );
    expect(assignRoleDecision(actor, actor.email, "admin")).toBe("locked");
    expect(assignRoleDecision(actor, DEFAULT_SUPER_ADMIN_EMAIL, "user")).toBe("locked");
    expect(assignRoleDecision(actor, "seller@example.com", "superadmin")).toBe("invalid");
  });
});
