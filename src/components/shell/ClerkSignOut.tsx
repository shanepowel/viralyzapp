"use client";

import { useClerk } from "@clerk/nextjs";

export function ClerkSignOut() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => void signOut({ redirectUrl: "/" })}
      className="min-h-11 w-full cursor-pointer border-0 bg-transparent px-0 text-left text-[14px] font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
    >
      Sign out
    </button>
  );
}
