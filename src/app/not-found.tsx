import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-bg px-6 py-10 text-ink sm:px-12">
      <Logo />
      <div className="my-auto max-w-[640px] py-16">
        <p className="kicker m-0">Error 404</p>
        <h1 className="font-display m-0 mt-3 text-[44px] sm:text-[64px]">There is no page at this address.</h1>
        <p className="m-0 mt-4 text-[16px] text-ink-2">
          The link may be old, or the address may have a typo. Your ads and credits are untouched.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonLink href="/studio">Go to Studio</ButtonLink>
          <ButtonLink href="/creatives" variant="outline">
            See your creatives
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
