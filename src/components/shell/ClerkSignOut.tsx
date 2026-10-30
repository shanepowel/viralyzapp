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
      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-muted hover:bg-panel hover:text-ink"
      aria-label="Sign out"
    >
      <LogOut className="w-[15px]" strokeWidth={2} />
    </button>
  );
}
