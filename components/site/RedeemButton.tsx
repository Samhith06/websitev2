'use client';

import { useState, useTransition } from 'react';
import { coins } from '@/lib/format';
import { redeemItem } from '@/app/(site)/store/actions';

/**
 * Redeeming, with a confirm step.
 *
 * Coins are slow to earn — an hour of chat is twenty of them — so spending
 * eight thousand of them on a mis-tap would be a genuinely bad afternoon. The
 * confirm is one extra click and it says exactly what the balance becomes.
 */
export function RedeemButton({
  itemId,
  name,
  cost,
  balance,
  needsShipping,
}: {
  itemId: number;
  name: string;
  cost: number;
  balance: number;
  needsShipping: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="tag green">{done}</span>;
  }

  if (!confirming) {
    return (
      <>
        <button className="btn gold sm wide" onClick={() => setConfirming(true)}>
          Redeem
        </button>
        {error ? (
          <div className="small" style={{ color: 'var(--red)', marginTop: 6 }}>
            {error}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Redeem ${name}`}>
      <div className="mbox">
        <h2>Redeem {name}?</h2>
        <p>
          This spends <b style={{ color: 'var(--gold)' }}>{coins(cost)}</b> coins, leaving you{' '}
          {coins(balance - cost)}.{' '}
          {needsShipping
            ? "You'll be asked for a shipping address after a mod approves it."
            : 'It will be sent to your linked Razed account.'}
        </p>
        {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost wide" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </button>
          <button
            className="btn gold wide"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await redeemItem(itemId);
                if (result.ok) {
                  setDone(result.pendingReview ? 'Pending approval' : 'Redeemed');
                  setConfirming(false);
                } else {
                  setError(result.error);
                }
              });
            }}
          >
            {pending ? 'Redeeming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
