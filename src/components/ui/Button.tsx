import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "mark";
type Size = "sm" | "md";

/**
 * Rectangular button with a 2px corner. Primary is solid ink, outline is a
 * 1px ink rule, ghost is an underlined text action, and "mark" (red) is kept
 * for fixes on a marked ad and for destructive actions.
 */
export function buttonClasses(variant: Variant = "primary", size: Size = "md", className = "") {
  const padding = size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-4 text-[14px]";
  const base = `inline-flex items-center justify-center gap-2 font-semibold rounded-inner whitespace-nowrap cursor-pointer no-underline disabled:cursor-not-allowed disabled:opacity-40 ${padding}`;

  let styles = "";
  switch (variant) {
    case "primary":
      styles = "btn-primary border border-btn bg-btn text-btn-ink";
      break;
    case "outline":
      styles = "btn-outline border border-rule bg-transparent text-ink";
      break;
    case "ghost":
      styles = "btn-ghost border border-transparent bg-transparent text-ink underline underline-offset-4 decoration-line";
      break;
    case "mark":
      styles = "btn-mark border border-mark bg-mark text-bg";
      break;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
  return `${base} ${styles} ${className}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  size?: Size;
};

export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: Props) {
  return (
    <button className={buttonClasses(variant, size, className)} type={rest.type ?? "button"} {...rest}>
      {children}
    </button>
  );
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/** The same button as a link. Internal paths use next/link. */
export function ButtonLink({ href, variant = "primary", size = "md", className = "", children, ...rest }: LinkProps) {
  const classes = buttonClasses(variant, size, className);
  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} {...rest}>
      {children}
    </a>
  );
}
