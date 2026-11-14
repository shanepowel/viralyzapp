import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginView } from "@/components/auth/LoginView";
import { isClerkEnabled, isDemoLoginEnabled, isInviteOnly } from "@/lib/env";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Viralyz: paid social ads, checked before you spend.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ store?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSession();
  if (session) {
    // Already signed in and arriving from viralyz.com with a shop link.
    const { store } = await searchParams;
    if (typeof store === "string" && /^https?:\/\//i.test(store)) {
      redirect(`/brand?import=${encodeURIComponent(store)}`);
    }
    redirect("/studio");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginView
        clerkEnabled={isClerkEnabled()}
        inviteOnly={isInviteOnly()}
        demoEnabled={isDemoLoginEnabled()}
      />
    </Suspense>
  );
}
