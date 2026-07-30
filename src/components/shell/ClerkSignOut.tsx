"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

export function ClerkSignOut() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => void signOut({ redirectUrl: "/" })}
      title="Sign out"
      className="ml-auto p-0 border-none bg-transparent cursor-pointer text-[var(--ink)] opacity-40 hover:opacity-80"
      aria-label="Sign out"
    >
      <LogOut className="w-[15px]" strokeWidth={2} />
    </button>
  );
}
