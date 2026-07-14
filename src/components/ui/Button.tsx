import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  const padding = size === "sm" ? "px-[13px] py-[7px] text-[12.5px]" : "px-4 py-[9px] text-[13.5px]";
  const base = `inline-flex items-center justify-center gap-2 font-semibold rounded-full cursor-pointer font-[family-name:var(--font-body)] ${padding}`;

  let styles = "";
  switch (variant) {
    case "primary":
      styles = "btn-primary border-none bg-[var(--violet)] text-white";
      break;
    case "outline":
      styles =
        "btn-outline border-[1.5px] border-[var(--line-strong)] bg-[var(--card)] text-[var(--ink)]";
      break;
    case "ghost":
      styles = "btn-ghost border-none bg-transparent text-[var(--ink-2)]";
      break;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }

  return (
    <button className={`${base} ${styles} ${className}`} type={rest.type ?? "button"} {...rest}>
      {children}
    </button>
  );
}
