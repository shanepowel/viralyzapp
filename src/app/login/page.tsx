import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginView } from "@/components/auth/LoginView";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in · Viralyz",
  description: "Sign in to Viralyz — see if content will work before you spend a penny on it.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--paper)]" />}>
      <LoginView />
    </Suspense>
  );
}
