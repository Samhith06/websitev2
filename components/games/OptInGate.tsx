'use client';

import { useState } from 'react';
import { LIMITS } from '@/lib/games';
import { Button, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Display, Label } from '@/components/ui/typography';

/**
 * The gate a viewer sees the first time they open the games section, before
 * anything is playable (UI Spec §32).
 *
 * No hype, no animation, no jackpot imagery. This screen is the site being
 * honest about what it is about to offer, and it should read that way.
 */
export function OptInGate() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="container-page py-16 lg:py-24">
      <Card className="mx-auto max-w-lg">
        <div className="p-7 lg:p-9">
          <Label className="mb-4">Games · off by default</Label>
          <Display size="m" as="h1">
            You must be 18 or over
          </Display>

          <ul className="mt-7 space-y-4 border-y border-line py-6">
            <Point>
              Matty Coins are earned by watching. They cannot be bought, they have no cash value,
              and there is no payment path anywhere on this site.
            </Point>
            <Point>
              Every round can be checked afterwards. The server commits to a seed before you play
              and reveals it when you rotate, so any result can be recomputed by anyone.
            </Point>
            <Point>
              The house keeps a small edge, printed on every paytable and calculated from that
              exact table. Over enough rounds you will end up slightly down. That is the
              arithmetic, not the luck.
            </Point>
          </ul>


          <label className="mt-6 flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-ink-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#2B8FFF]"
            />
            I confirm I am 18 or over and I want the games section switched on.
          </label>

          <Button full size="lg" className="mt-6" disabled={!confirmed}>
            Turn on games
          </Button>

          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            You can switch these off again at any time, instantly, from your account.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
      <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
