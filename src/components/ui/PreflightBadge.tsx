import { CheckChip } from "@/components/ui/CheckChip";

type Props = { headline: number | null; counted: number; total: number };

/** The headline pre-flight number. Its basis (checks counted) is in the tooltip; cards show "n of m passed" beside it. */
export function PreflightBadge({ headline, counted, total }: Props) {
  if (headline == null) {
    return <CheckChip state="locked" label="Not enough checks to score" />;
  }

  const state = headline >= 80 ? "pass" : headline >= 50 ? "warn" : "fail";
  return (
    <span title={`Scored on ${counted} of ${total} checks`}>
      <CheckChip state={state} label={`Pre-flight ${headline}`} />
    </span>
  );
}
