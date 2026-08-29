'use client';

import { useState } from 'react';
import { coins } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import type { PlayLimits } from '@/lib/types';

/**
 * Its own block on the account page, not a settings sub-page (UI Spec §37).
 *
 * There is no daily wager limit — that control was removed deliberately. What
 * remains is the session reminder, which states plainly where you are, and the
 * switch that turns the games off entirely for a period you choose. Both are
 * enforced on the server; neither is a warning dressed up as a feature.
 */
export function LimitsBlock({ limits }: { limits: PlayLimits }) {
  const [reminder, setReminder] = useState(limits.sessionReminderMinutes);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ------------------------------------------------------------- */}
      {/* Session reminder                                              */}
      {/* ------------------------------------------------------------- */}
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <Label>Session reminder</Label>
        </div>
        <div className="p-5">
          <p className="mb-4 text-[13.5px] leading-relaxed text-muted">
            How often the site interrupts to tell you where you are. It cannot be turned off
            entirely.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {[30, 60, 120].map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setReminder(minutes)}
                aria-pressed={reminder === minutes}
                className={cn(
                  'h-9 rounded-[6px] border px-3.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150',
                  reminder === minutes
                    ? 'border-brand-line bg-brand-bg text-brand'
                    : 'border-line bg-surface text-muted hover:border-line-2',
                )}
              >
                Every {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[6px] border border-line bg-surface-2 px-4 py-4">
            <Label className="mb-3">What you will see</Label>
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Played</dt>
                <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink">1h 00m</dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Wagered</dt>
                <dd className="mt-1 font-mono text-[16px] tabular-nums text-ink">
                  {coins(limits.wageredToday)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Net</dt>
                <dd
                  className={cn(
                    'mt-1 font-mono text-[16px] tabular-nums',
                    limits.netToday < 0 ? 'text-danger' : 'text-gold',
                  )}
                >
                  {limits.netToday >= 0 ? '+' : '−'}
                  {coins(Math.abs(limits.netToday))}
                </dd>
              </div>
            </dl>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Blunt numbers, no encouragement either way.
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Today so far                                                  */}
      {/* ------------------------------------------------------------- */}
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <Label>Today so far</Label>
        </div>
        <div className="p-5">
          <div className="grid gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-2 [&>div]:bg-surface-2">
            <div className="px-4 py-4">
              <Label className="mb-2">Wagered</Label>
              <Num className="text-[24px] leading-none">{coins(limits.wageredToday)}</Num>
            </div>
            <div className="px-4 py-4">
              <Label className="mb-2">Net</Label>
              <Num
                tone={limits.netToday < 0 ? 'danger' : 'gold'}
                className="text-[24px] leading-none"
              >
                {limits.netToday >= 0 ? '+' : '−'}
                {coins(Math.abs(limits.netToday))}
              </Num>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            A running total, not a cap — there is no daily wager limit. Per-round limits still
            apply: 10–100 MC a round, and a round can win at most 20,000 MC.
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Turn games off                                                */}
      {/* ------------------------------------------------------------- */}
      <Card className="lg:col-span-2">
        <div className="border-b border-line px-5 py-3.5">
          <Label>Turn games off</Label>
        </div>
        <div className="p-5">
          <p className="max-w-3xl text-[14px] leading-relaxed text-ink-2">
            This hides the games from your navigation and blocks every play endpoint on the server
            for the period you choose. The rest of the site — coins, shop, giveaways, the board —
            keeps working exactly as it does now.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {[
              { key: 'day', label: 'For a day' },
              { key: 'week', label: 'For a week' },
              { key: 'month', label: 'For a month' },
              { key: 'forever', label: 'Permanently' },
            ].map((option) => (
              <Button
                key={option.key}
                variant={option.key === 'forever' ? 'danger' : 'outline'}
                onClick={() => setConfirming(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {confirming ? (
            <div className="mt-5 rounded-[6px] border border-line-2 bg-surface-2 px-5 py-4">
              <p className="text-[14px] leading-relaxed text-ink">
                {confirming === 'forever'
                  ? 'This cannot be undone. Games will be gone from your account permanently, and no moderator can reverse it.'
                  : `This cannot be lifted early. Games come back on their own at the end of the ${confirming}, and nothing you or a moderator does will bring them back sooner.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button variant={confirming === 'forever' ? 'danger' : 'primary'}>
                  Yes, turn games off
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
