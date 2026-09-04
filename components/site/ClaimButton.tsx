'use client';

import { useState, useTransition } from 'react';
import { money } from '@/lib/format';
import { claim } from '@/app/(site)/milestones/actions';

/**
 * The claim button, and the confirmation that replaces it.
 *
 * The success copy promises a window rather than an instant, because payouts
 * are Matty tipping on Razed by hand. Saying "within 24 hours" and meaning it
 * beats saying "sent" and being wrong for a day.
 */
export function ClaimButton({ tierId, reward }: { tierId: number; reward: number }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="tag warn">Pending payout</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
      <button
        className="btn green sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await claim(tierId);
            if (result.ok) setDone(true);
            else setError(result.error);
          });
        }}
      >
        {pending ? 'Claiming…' : `Claim ${money(reward)}`}
      </button>
      {error ? (
        <span className="small" style={{ color: 'var(--red)', maxWidth: '32ch', textAlign: 'right' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
