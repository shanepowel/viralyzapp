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

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
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
