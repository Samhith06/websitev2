import { cn } from '@/lib/cn';
import { Label, Num } from './typography';

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export type CardTone = 'default' | 'brand' | 'gold' | 'danger' | 'inset';

const tones: Record<CardTone, string> = {
  default: 'border-line bg-surface',
  brand: 'border-brand-line bg-brand-bg',
  gold: 'border-gold-line bg-gold-bg',
  danger: 'border-danger-line bg-danger-bg',
  inset: 'border-line bg-surface-2',
};

export function Card({
  tone = 'default',
  hover,
  className,
  children,
  ...rest
}: {
  tone?: CardTone;
  /** Cards brighten their border on hover — no lift, no shadow (§29). */
  hover?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[3px] border transition-colors duration-150',
        tones[tone],
        hover && 'hover:border-line-2',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  right,
}: {
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-line px-5 py-3.5', className)}>
      <div className="min-w-0">{children}</div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Hairline grid — §3                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A grid with a one-pixel gap over a `line`-coloured ground, each child painted
 * `surface`. Hairline dividers that never double at the joins. This builds the
 * stat strips, the prize tiers, the bet/win/multiplier row and every table.
 */
export function Hairlines({
  children,
  className,
  cols,
  tone = 'surface',
}: {
  children: React.ReactNode;
  className?: string;
  cols?: string;
  tone?: 'surface' | 'surface-2';
}) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-[3px] border border-line bg-line',
        tone === 'surface' ? '[&>*]:bg-surface' : '[&>*]:bg-surface-2',
        cols,
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat tile                                                                  */
/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  sub,
  tone = 'ink',
  className,
  children,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'ink' | 'gold' | 'brand' | 'danger' | 'muted';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('px-5 py-4', className)}>
      <Label className="mb-2">{label}</Label>
      {value !== undefined ? (
        <Num tone={tone} className="block text-[26px] leading-none lg:text-[30px]">
          {value}
        </Num>
      ) : null}
      {children}
      {sub ? <div className="mt-1.5 text-[12.5px] text-muted">{sub}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panels, banners, empty and loading states                                  */
/* -------------------------------------------------------------------------- */

export function Banner({
  tone = 'gold',
  children,
  className,
  icon,
}: {
  tone?: 'gold' | 'brand' | 'danger';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  const map = {
    gold: 'border-gold-line bg-gold-bg text-gold',
    brand: 'border-brand-line bg-brand-bg text-brand',
    danger: 'border-danger-line bg-danger-bg text-danger',
  } as const;
  return (
    <div
      role="status"
      className={cn('flex items-start gap-3 rounded-[3px] border px-4 py-3 text-[13.5px]', map[tone], className)}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 leading-snug">{children}</div>
    </div>
  );
}

/**
 * Never an empty grid. One line and, where there is one, the action that fixes
 * it (§28).
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[3px] border border-dashed border-line bg-surface px-6 py-12 text-center', className)}>
      <p className="text-[15px] text-ink-2">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-[13.5px] text-muted">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Skeletons at the real element's dimensions, never spinners (§28). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[3px] bg-surface-2', className)} aria-hidden />;
}

/** A section fails inline; the rest of the page still renders (§28). */
export function SectionError({ children }: { children: React.ReactNode }) {
  return (
    <Banner tone="danger">
      {children} <span className="text-ink-2">The rest of the page is unaffected.</span>
    </Banner>
  );
}
