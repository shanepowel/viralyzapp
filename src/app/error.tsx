"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-bg px-6 py-10 text-ink sm:px-12">
      <Logo />
      <div className="my-auto max-w-[640px] py-16">
        <p className="kicker m-0" style={{ color: "var(--vz-mark)" }}>
          Something broke on our side
        </p>
        <h1 className="font-display m-0 mt-3 text-[44px] sm:text-[60px]">This page did not load.</h1>
        <p className="m-0 mt-4 text-[16px] text-ink-2">
          Nothing was charged and your work is saved. Try again; if it keeps happening, send the reference below to
          hello@viralyz.com.
        </p>
        {error.digest ? <p className="m-0 mt-3 font-mono text-[12px] text-muted">Reference {error.digest}</p> : null}
        <div className="mt-8 flex flex-wrap gap-2">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <ButtonLink href="/studio" variant="outline">
            Go to Studio
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
