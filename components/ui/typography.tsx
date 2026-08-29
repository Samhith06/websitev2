import { cn } from '@/lib/cn';

/**
 * The label style appears roughly eighty times (UI Spec §2). It is a component
 * on day one, for exactly that reason.
 */
export function Label({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'span' | 'h2' | 'h3' | 'p';
}) {
  return (
    <Tag
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.18em] text-muted',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Timestamps and counts. Faint is for meta only — never for anything a viewer must read. */
export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[11.5px] text-faint tabular-nums', className)}>{children}</span>;
}

/** The display face is uppercase only. It has no lowercase personality. */
export function Display({
  children,
  size = 'm',
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  size?: 'xl' | 'l' | 'm' | 's';
  className?: string;
  as?: 'div' | 'h1' | 'h2' | 'h3' | 'p' | 'span';
}) {
  const sizes = {
    xl: 'text-[44px] leading-[0.92] md:text-[62px] lg:text-[78px] lg:leading-[0.9]',
    l: 'text-[38px] leading-[0.95] md:text-[50px] lg:text-[64px]',
    m: 'text-[30px] leading-none md:text-[38px] lg:text-[46px]',
    s: 'text-[22px] leading-tight lg:text-[26px]',
  } as const;
  return <Tag className={cn('display', sizes[size], className)}>{children}</Tag>;
}

/** Eyebrow, title and an optional right-hand slot — the header of most sections. */
export function SectionHeading({
  eyebrow,
  title,
  right,
  className,
  size = 'm',
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  size?: 'l' | 'm' | 's';
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <Label className="mb-3 flex items-center gap-2">{eyebrow}</Label> : null}
        <Display size={size} as="h2">
          {title}
        </Display>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** Every number in a column is mono with tabular figures. */
export function Num({
  children,
  className,
  tone = 'ink',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'ink' | 'gold' | 'brand' | 'muted' | 'danger' | 'silver' | 'bronze';
}) {
  const tones = {
    ink: 'text-ink',
    gold: 'text-gold',
    brand: 'text-brand',
    muted: 'text-muted',
    danger: 'text-danger',
    silver: 'text-silver',
    bronze: 'text-bronze',
  } as const;
  return <span className={cn('font-mono tabular-nums', tones[tone], className)}>{children}</span>;
}
