import Link from "next/link";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type Variant = "primary" | "outline" | "ghost" | "danger" | "discord" | "gold";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Blue is the only loud colour. Never amber text on a blue fill.
  primary:
    "bg-brand text-brand-ink border border-brand hover:bg-brand-dim hover:border-brand-dim",
  outline:
    "bg-transparent text-ink border border-line-2 hover:border-brand hover:text-brand-dim",
  ghost:
    "bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-surface-2",
  danger:
    "bg-transparent text-danger border border-danger/45 hover:bg-danger/10 hover:border-danger",
  // The one place another brand's colour is allowed (§21).
  discord: "bg-discord text-white border border-discord hover:brightness-110",
  gold: "bg-gold text-brand-ink border border-gold hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-10 px-4 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

type ButtonBaseProps = {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
};

function buttonClass({
  variant = "primary",
  size = "md",
  full,
  className,
}: ButtonBaseProps) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[3px] font-medium",
    "transition-all duration-200 ease-out",
    "disabled:pointer-events-none disabled:opacity-45",
    "btn-enhanced",
    variants[variant],
    sizes[size],
    full && "w-full",
    className,
  );
}

export function Button({
  variant,
  size,
  full,
  className,
  children,
  ...rest
}: ButtonBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={buttonClass({ variant, size, full, className, children })}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Every interactive element is a real button or link (§30). */
export function ButtonLink({
  href,
  variant,
  size,
  full,
  className,
  children,
  external,
  ...rest
}: ButtonBaseProps & {
  href: string;
  external?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const cls = buttonClass({ variant, size, full, className, children });
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className={cls}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Chips — filter rows are tab lists with a proper selected state (§30)        */
/* -------------------------------------------------------------------------- */

export function Chip({
  active,
  className,
  children,
  as = "button",
  href,
  ...rest
}: {
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  as?: "button" | "link" | "span";
  href?: string;
} & React.HTMLAttributes<HTMLElement>) {
  const cls = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-[2px] border px-3",
    "font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150",
    active
      ? "border-brand-line bg-brand-bg text-brand"
      : "border-line bg-surface text-muted hover:border-line-2 hover:text-ink-2",
    className,
  );

  if (as === "link" && href) {
    return (
      <Link href={href} role="tab" aria-selected={active} className={cls}>
        {children}
      </Link>
    );
  }
  if (as === "span") {
    return (
      <span className={cls} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cls}
      {...(rest as object)}
    >
      {children}
    </button>
  );
}

export function ChipRow({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {children}
    </div>
  );
}

/** A pill count badge — the one pill-shaped thing on the site. */
export function CountBadge({
  children,
  tone = "gold",
}: {
  children: React.ReactNode;
  tone?: "gold" | "brand" | "danger";
}) {
  const tones = {
    gold: "bg-gold-bg text-gold border-gold-line",
    brand: "bg-brand-bg text-brand border-brand-line",
    danger: "bg-danger-bg text-danger border-danger-line",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 font-mono text-[10.5px] tabular-nums",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[3px] border border-line-2 bg-surface-2 px-3",
        "font-mono text-[14px] tabular-nums text-ink placeholder:text-faint",
        "transition-colors duration-150 focus:border-brand",
        "disabled:opacity-45",
        className,
      )}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[12.5px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Status is always a dot and a word, never colour alone (§30). */
export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: "brand" | "gold" | "danger" | "muted" | "live";
  children?: React.ReactNode;
  className?: string;
}) {
  const dots = {
    brand: "bg-brand",
    gold: "bg-gold",
    danger: "bg-danger",
    muted: "bg-faint",
    live: "bg-live",
  } as const;
  const text = {
    brand: "text-brand",
    gold: "text-gold",
    danger: "text-danger",
    muted: "text-faint",
    live: "text-live",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]",
        text[tone],
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", dots[tone])}
        aria-hidden
      />
      {children}
    </span>
  );
}
