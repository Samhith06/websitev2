'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { coins } from '@/lib/format';
import { enter } from '@/app/(site)/raffles/actions';
import type { Raffle } from '@/lib/store/raffles';

function endsIn(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * One raffle.
 *
 * The odds line is the honest version of what people are actually asking when
 * they buy a second ticket, so it is shown rather than left to be worked out —
 * and it recalculates against the real entry count, not an optimistic one.
 */
export function RaffleCard({
  raffle,
  signedIn,
  entries: initialEntries,
}: {
  raffle: Raffle;
  signedIn: boolean;
  entries: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = raffle.entryCount + (entries - initialEntries);
  const odds = entries > 0 && total > 0 ? ((entries / total) * 100).toFixed(2) : null;
  const atCap = entries >= raffle.maxEntries;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await enter(raffle.id);
      if (result.ok) setEntries(result.entries);
      else setError(result.error);
    });
  }

  return (
    <div className="raffle">
      <div className="rimg">
        {raffle.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={raffle.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="sym" aria-hidden>
            {raffle.symbol}
          </span>
        )}
        <span className={`badge tag ${raffle.cost === 0 ? 'green' : 'gold'}`}>
          {raffle.cost === 0 ? 'Free entry' : `${coins(raffle.cost)} coins`}
        </span>
      </div>

      <div className="rb">
        <div className="rt">{raffle.title}</div>
        {raffle.valueLabel ? <div className="rv">{raffle.valueLabel}</div> : null}

        <div className="rmeta">
          <span>
            Entries <b>{coins(total)}</b>
          </span>
          <span>
            Ends in <b>{endsIn(raffle.closesAt)}</b>
          </span>
        </div>

        {raffle.maxEntries > 1 ? (
          <div className="rmeta" style={{ borderTop: 0, paddingTop: 0 }}>
            <span>
              Max <b>{raffle.maxEntries}</b> per person
            </span>
            <span>
              Yours <b>{entries}</b>
            </span>
          </div>
        ) : null}

        {odds ? <div className="odds">Your odds: {odds}%</div> : null}
        {error ? (
          <div className="odds" style={{ color: 'var(--red)' }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          {!signedIn ? (
            <Link className="btn pri wide discord" href="/api/auth/signin?callbackUrl=/raffles">
              Sign in to enter
            </Link>
          ) : atCap ? (
            <button className="btn green wide" disabled>
              ✓ {raffle.maxEntries > 1 ? `${entries} entered` : 'Entered'}
            </button>
          ) : (
            <>
              <button className="btn pri wide" onClick={submit} disabled={pending}>
                {pending
                  ? 'Entering…'
                  : raffle.cost === 0
                    ? 'Enter free'
                    : `Enter for ${coins(raffle.cost)}`}
              </button>
              {raffle.maxEntries > 1 ? (
                <div className="small muted" style={{ marginTop: 7, textAlign: 'center' }}>
                  {raffle.cost === 0 ? 'Free' : `${coins(raffle.cost)} coins`} per entry
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
