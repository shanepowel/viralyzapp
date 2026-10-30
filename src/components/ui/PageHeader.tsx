import type { ReactNode } from "react";

/** Page title in the wide display cut, with an optional line of context and actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pt-8 pb-6">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] sm:text-[34px] m-0">{title}</h1>
        {description ? <p className="m-0 mt-2 max-w-[620px] text-[14px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
