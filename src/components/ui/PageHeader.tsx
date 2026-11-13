import type { ReactNode } from "react";

/** Page title: optional mono kicker, an 800-weight headline, one line of context, actions on the right. */
export function PageHeader({
  title,
  kicker,
  description,
  actions,
}: {
  title: string;
  kicker?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? <p className="kicker m-0 mb-2">{kicker}</p> : null}
        <h1 className="font-display m-0 text-[30px] sm:text-[40px]">{title}</h1>
        {description ? <p className="m-0 mt-3 max-w-[640px] text-[15px] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
