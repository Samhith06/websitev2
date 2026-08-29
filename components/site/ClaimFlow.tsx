'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dateRange, money } from '@/lib/format';
import { Button } from '@/components/ui/controls';
import { Banner, Card } from '@/components/ui/surfaces';
import { Display, Label, Num } from '@/components/ui/typography';
import type { Period } from '@/lib/types';

/**
 * The flow that replaces account linking (UI Spec §7).
 *
 * Step three is a *state of the claim*, not a one-time success screen — it is
 * what the viewer sees if they come back to the page a day later, so it is
 * built that way from the start.
 */
export function ClaimFlow({ period }: { period: Period }) {
  const [rank, setRank] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState<string | null>(null);

  const paying = period.rows.filter((r) => r.prize > 0);
  const chosen = paying.find((r) => r.rank === rank);
  const claimState = rank ? period.claimedRanks?.[rank] : undefined;

  if (reference && chosen) {
    return <Submitted reference={reference} period={period} rank={chosen.rank} amount={chosen.prize} />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      {/* ---------------------------------------------------------- */}
      {/* Step one — which position                                  */}
      {/* ---------------------------------------------------------- */}
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <Label>Step 1 — which position is yours</Label>
        </div>
        <div className="p-2">
          <ul className="space-y-1">
            {paying.map((row) => {
              const state = period.claimedRanks?.[row.rank];
              const selected = rank === row.rank;
              return (
                <li key={row.rank}>
                  <button
                    type="button"
                    onClick={() => setRank(row.rank)}
                    aria-pressed={selected}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-[3px] border px-4 py-3 text-left transition-colors duration-150',
                      selected
                        ? 'border-brand bg-brand-bg'
                        : 'border-transparent hover:border-line-2 hover:bg-surface-2',
                      state && !selected && 'opacity-55',
                    )}
                  >
                    <Num tone={selected ? 'brand' : 'muted'} className="w-8 shrink-0 text-[18px]">
                      {row.rank}
                    </Num>
                    <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                      {row.maskedUsername}
                    </span>
                    {state ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-[2px] border px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em]',
                          state === 'paid'
                            ? 'border-line bg-surface-2 text-faint'
                            : 'border-gold-line bg-gold-bg text-gold',
                        )}
                      >
                        {state === 'paid' ? 'Paid' : 'Claim pending'}
                      </span>
                    ) : null}
                    <Num tone="gold" className="shrink-0 text-[14px]">
                      {money(row.prize)}
                    </Num>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      {/* ---------------------------------------------------------- */}
      {/* Step two — prove it                                        */}
      {/* ---------------------------------------------------------- */}
      <Card className={cn('transition-opacity duration-150', !rank && 'pointer-events-none opacity-45')}>
        <div className="border-b border-line px-5 py-3.5">
          <Label>Step 2 — prove it</Label>
        </div>
        <div className="space-y-5 p-5">
          {claimState === 'pending' ? (
            // Don't race them. A second claimant is a flag for a moderator,
            // not a competition.
            <Banner tone="gold" icon={<Info size={16} />}>
              Another claim is being reviewed for this position. You can still submit yours — a
              moderator will look at both against Razed’s own figures.
            </Banner>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="razed-username" className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Your full Razed username
            </label>
            <input
              id="razed-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="exactly as it appears on Razed"
              className="h-10 w-full rounded-[3px] border border-line-2 bg-surface-2 px-3 font-mono text-[14px] text-ink placeholder:text-faint focus:border-brand"
            />
            <p className="text-[12.5px] leading-relaxed text-muted">
              A moderator checks this against Razed’s own figures before anything is paid. Claiming
              a position that is not yours costs you your account and every coin on it.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="payout-note" className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Payout note <span className="normal-case tracking-normal text-faint">(optional)</span>
            </label>
            <input
              id="payout-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="how you would prefer to be paid"
              className="h-10 w-full rounded-[3px] border border-line-2 bg-surface-2 px-3 text-[14px] text-ink placeholder:text-faint focus:border-brand"
            />
          </div>

          <Button
            full
            size="lg"
            disabled={!rank || username.trim().length < 3}
            onClick={() => setReference(`MS-CLM-${Math.floor(4000 + Math.random() * 5999)}`)}
          >
            Submit claim{chosen ? ` for ${money(chosen.prize)}` : ''}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Submitted({
  reference,
  period,
  rank,
  amount,
}: {
  reference: string;
  period: Period;
  rank: number;
  amount: number;
}) {
  return (
    <Card tone="brand" className="mx-auto max-w-2xl">
      <div className="border-b border-brand-line px-6 py-4">
        <Label className="flex items-center gap-2 text-brand">
          <Check size={14} />
          Claim submitted
        </Label>
      </div>
      <div className="p-6">
        <Display size="s" as="h2">
          Claim {reference}
        </Display>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-[3px] border border-brand-line bg-brand-line sm:grid-cols-3 [&>div]:bg-brand-bg">
          <div className="px-4 py-3.5">
            <Label className="mb-1.5">Period</Label>
            <dd className="font-mono text-[13.5px] tabular-nums text-ink">
              {dateRange(period.startsAt, period.endsAt)}
            </dd>
          </div>
          <div className="px-4 py-3.5">
            <Label className="mb-1.5">Position</Label>
            <dd className="font-mono text-[18px] tabular-nums text-ink">{rank}</dd>
          </div>
          <div className="px-4 py-3.5">
            <Label className="mb-1.5">Amount</Label>
            <dd className="font-mono text-[18px] tabular-nums text-gold">{money(amount)}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3 text-[14px] leading-relaxed text-ink-2">
          <p>
            A moderator will check the username you gave against the frozen snapshot from Razed.
            That normally takes under 48 hours, and always inside the 72-hour verification window.
          </p>
          <p>
            You will see the outcome on your account page, and in Discord if you have notifications
            on. Nothing else is needed from you in the meantime.
          </p>
        </div>

        <Link
          href="/me"
          className="mt-6 inline-flex text-[14px] text-brand underline underline-offset-2 hover:text-brand-dim"
        >
          Track it on your account →
        </Link>
      </div>
    </Card>
  );
}
