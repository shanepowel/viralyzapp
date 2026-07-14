import { AppShell } from "@/components/shell/AppShell";
import Link from "next/link";

type Props = {
  title: string;
  subtitle: string;
};

export function PlaceholderScreen({ title, subtitle }: Props) {
  return (
    <AppShell>
      <div className="vfade py-[22px]">
        <h1 className="font-display text-2xl font-bold m-0">{title}</h1>
        <p className="text-[13px] text-[var(--ink-3)] mt-1">{subtitle}</p>
        <div className="mt-8 bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-6">
          <p className="text-[var(--ink-2)] m-0">
            This screen reuses the Viralyz shell and design tokens. Build it next using the
            Dashboard + Score Results pattern library.
          </p>
          <Link href="/" className="inline-block mt-4 text-[var(--violet-deep)] font-semibold text-[13px]">
            ← Back to Home
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
