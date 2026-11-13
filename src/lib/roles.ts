import { isAdminEmail } from "@/lib/env";

export const ROLES = ["user", "admin", "superadmin"] as const;

export type Role = (typeof ROLES)[number];

/** Operator account. Used when SUPER_ADMIN_EMAILS is unset. */
export const DEFAULT_SUPER_ADMIN_EMAIL = "shane.powell@bmkrs.com";

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

export function superAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS?.trim();
  const source = raw ? raw : DEFAULT_SUPER_ADMIN_EMAIL;
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string): boolean {
  return superAdminEmails().includes(email.toLowerCase());
}

/** Role written on a brand-new account. Staff lists only ever promote. */
export function roleForNewAccount(email: string): Role {
  if (isSuperAdminEmail(email)) return "superadmin";
  if (isAdminEmail(email)) return "admin";
  return "user";
}

/**
 * Raises a role when the email is on a staff list. Never demotes: an admin
 * granted in the product stays an admin after they are removed from the env list.
 */
export function promotedRole(email: string, current: string): Role {
  if (isSuperAdminEmail(email)) return "superadmin";
  if (isAdminEmail(email) && current === "user") return "admin";
  if (isRole(current)) return current;
  return "user";
}

export type AssignRoleDecision = "ok" | "forbidden" | "locked" | "invalid";

/** Super admins may set seller or admin. They cannot change themselves or another super admin. */
export function assignRoleDecision(
  actor: { role: string; email: string },
  targetEmail: string,
  next: string,
): AssignRoleDecision {
  if (actor.role !== "superadmin") return "forbidden";
  if (actor.email.toLowerCase() === targetEmail.toLowerCase()) return "locked";
  if (isSuperAdminEmail(targetEmail)) return "locked";
  if (next !== "user" && next !== "admin") return "invalid";
  return "ok";
}
