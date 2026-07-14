import { statusChip } from "@/lib/score-bands";

type Props = {
  status: string;
};

export function Chip({ status }: Props) {
  const chip = statusChip(status);
  return (
    <span
      className="text-[11px] font-semibold rounded-full px-[11px] py-1 inline-block"
      style={{ background: chip.bg, color: chip.color }}
    >
      {chip.label}
    </span>
  );
}
