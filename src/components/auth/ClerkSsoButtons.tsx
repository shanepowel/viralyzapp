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
      <SignInButton mode="modal" forceRedirectUrl="/studio">
        <Button type="button" className="w-full">
          Continue with Google or SSO
        </Button>
      </SignInButton>
      {!inviteOnly ? (
        <SignUpButton mode="modal" forceRedirectUrl="/studio">
          <Button type="button" variant="outline" className="w-full">
            Create an account with SSO
          </Button>
        </SignUpButton>
      ) : (
        <p className="m-0 text-[13px] text-ink-2">
          SSO works for invited accounts. If you are new, use your invite code below or join the waitlist.
        </p>
      )}
    </div>
  );
}
