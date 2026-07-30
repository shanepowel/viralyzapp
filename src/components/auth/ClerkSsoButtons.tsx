"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";

type Props = {
  inviteOnly: boolean;
};

/** Only mount inside ClerkProvider (when Clerk keys are configured). */
export function ClerkSsoButtons({ inviteOnly }: Props) {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <SignInButton mode="modal" forceRedirectUrl="/score">
        <Button type="button" className="w-full py-3 text-[14px]">
          Continue with Google / SSO
        </Button>
      </SignInButton>
      {!inviteOnly ? (
        <SignUpButton mode="modal" forceRedirectUrl="/score">
          <Button type="button" variant="outline" className="w-full py-3">
            Create account with SSO
          </Button>
        </SignUpButton>
      ) : (
        <p className="m-0 text-[12px] text-[var(--ink-3)] text-center">
          SSO sign-in works for invited accounts. New testers need an invite code below — or join the
          waitlist.
        </p>
      )}
    </div>
  );
}
