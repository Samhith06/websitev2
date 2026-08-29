import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/typography';

/**
 * The same grid mechanics as the leaderboard, denser (UI Spec §26): 14px base,
 * 13px row padding, an actions column pinned right.
 *
 * Rows needing attention take a six-percent tint of their status colour across
 * the full width — enough to find while scanning, not enough to shout.
 */
export function AdminTable({
  columns,
  children,
  className,
  cols,
}: {
  columns: string[];
  children: React.ReactNode;
  className?: string;
  /** The grid template, shared by the header and every row. */
  cols: string;
}) {
  return (
    <div role="table" className={cn('overflow-hidden rounded-[3px] border border-line', className)}>
      <div role="row" className={cn('hidden bg-surface-2 lg:grid', cols)}>
        {columns.map((column, i) => (
          <div key={i} role="columnheader" className="px-4 py-2.5">
            <Label>{column}</Label>
          </div>
        ))}
      </div>
      <div role="rowgroup" className="bg-surface">
        {children}
      </div>
    </div>
  );
}

export function AdminRow({
  children,
  cols,
  tint,
  className,
}: {
  children: React.ReactNode;
  cols: string;
  tint?: 'gold' | 'danger' | 'brand';
  className?: string;
}) {
  const tints = {
    gold: 'bg-gold/[0.06]',
    danger: 'bg-danger/[0.06]',
    brand: 'bg-brand/[0.06]',
  } as const;

  return (
    <div
      role="row"
      className={cn(
        'grid gap-x-3 gap-y-1 border-t border-line px-4 py-3 first:border-t-0',
        'lg:items-center lg:gap-0 lg:px-0 lg:py-0',
        cols,
        tint && tints[tint],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Cell({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Shown before the value on mobile, where the header row is gone. */
  label?: string;
}) {
  return (
    <div role="cell" className={cn('min-w-0 text-[14px] lg:px-4 lg:py-[13px]', className)}>
      {label ? (
        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint lg:hidden">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The filter bar is its own card above the table. Filters live in the URL so a
 * moderator can send another moderator a link to exactly what they are looking
 * at.
 */
export function FilterBar({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-end justify-between gap-4 rounded-[3px] border border-line bg-surface px-4 py-3.5',
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** Status is a six-pixel dot plus a word, never colour alone. */
export function StatusPill({
  tone,
  children,
}: {
  tone: 'brand' | 'gold' | 'danger' | 'muted';
  children: React.ReactNode;
}) {
  const map = {
    brand: { dot: 'bg-brand', text: 'text-brand', border: 'border-brand-line', bg: 'bg-brand-bg' },
    gold: { dot: 'bg-gold', text: 'text-gold', border: 'border-gold-line', bg: 'bg-gold-bg' },
    danger: { dot: 'bg-danger', text: 'text-danger', border: 'border-danger-line', bg: 'bg-danger-bg' },
    muted: { dot: 'bg-faint', text: 'text-faint', border: 'border-line', bg: 'bg-surface-2' },
  } as const;
  const s = map[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[2px] border px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em]',
        s.border, s.bg, s.text,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', s.dot)} aria-hidden />
      {children}
    </span>
  );
}
