'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, dateTime, duration } from '@/lib/format';
import { Label } from '@/components/ui/typography';
import type { LedgerEntry } from '@/lib/types';

/**
 * A plain table (UI Spec §25): date, reason in words rather than codes, the
 * change with sign and colour, and the running balance.
 *
 * Watch ticks aggregate by session rather than listing forty individual
 * three-minute rows — but the aggregate expands to the raw entries on click,
 * because "where did my coins go" needs a real answer.
 *
 * Adjustments always show the moderator's reason inline. An unexplained
 * deduction is the fastest way to lose someone.
 */
export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-[3px] border border-line">
      <div className="hidden grid-cols-[190px_1fr_120px_130px] bg-surface-2 lg:grid">
        {['Date', 'Reason', 'Change', 'Balance'].map((h) => (
          <div key={h} className={cn('px-4 py-2.5', h !== 'Reason' && h !== 'Date' && 'text-right')}>
            <Label>{h}</Label>
          </div>
        ))}
      </div>

      <div className="bg-surface">
        {entries.map((entry) => {
          const expandable = Boolean(entry.session);
          const open = expanded === entry.id;

          return (
            <div key={entry.id} className="border-t border-line first:border-t-0">
              <div
                className={cn(
                  'grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 px-4 py-3.5',
                  'lg:grid-cols-[190px_1fr_120px_130px] lg:items-center lg:gap-0 lg:px-0 lg:py-0',
                )}
              >
                <div className="order-2 font-mono text-[11.5px] tabular-nums text-faint lg:order-none lg:px-4 lg:py-3.5">
                  {dateTime(entry.createdAt)}
                </div>

                <div className="order-1 min-w-0 lg:order-none lg:px-4 lg:py-3.5">
                  {expandable ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : entry.id)}
                      aria-expanded={open}
                      className="flex items-center gap-1.5 text-left text-[14px] text-ink transition-colors duration-150 hover:text-brand-dim"
                    >
                      {entry.reason} — {coins(Math.abs(entry.delta))} MC
                      <ChevronDown size={14} className={cn('text-muted transition-transform duration-150', open && 'rotate-180')} />
                    </button>
                  ) : (
                    <span className="text-[14px] text-ink">{entry.reason}</span>
                  )}

                  {entry.detail ? (
                    <span className="mt-0.5 block font-mono text-[12px] text-muted">{entry.detail}</span>
                  ) : null}
                  {entry.moderator ? (
                    <span className="mt-0.5 block text-[12.5px] text-muted">{entry.moderator}</span>
                  ) : null}
                </div>

                <div
                  className={cn(
                    'order-3 text-right font-mono text-[14px] tabular-nums lg:order-none lg:px-4 lg:py-3.5',
                    entry.delta >= 0 ? 'text-brand' : 'text-danger',
                  )}
                >
                  {entry.delta >= 0 ? '+' : '−'}
                  {coins(Math.abs(entry.delta))}
                </div>

                <div className="order-4 hidden text-right font-mono text-[14px] tabular-nums text-ink-2 lg:order-none lg:block lg:px-4 lg:py-3.5">
                  {coins(entry.balance)}
                </div>
              </div>

              {open && entry.session ? (
                <div className="border-t border-line bg-surface-2 px-4 py-3">
                  <p className="font-mono text-[12px] text-muted">
                    {entry.session.ticks} ticks over {duration(entry.session.seconds)} · 1 MC per
                    3 minutes × {Math.round(entry.delta / entry.session.ticks)} multiplier
                    {entry.session.ticks >= 20 ? ' · includes the full-hour bonus' : ''}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
