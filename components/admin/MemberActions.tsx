'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Button, Input } from '@/components/ui/controls';
import { Label } from '@/components/ui/typography';
import { adjustCoins, setFrozen, type ActionResult } from '@/app/admin/members/actions';

/**
 * The two controls on this screen that actually move something.
 *
 * The reason field is mandatory for a reason: six months later the audit log
 * needs to say why an account got 500 coins, and "adjustment" is not an answer.
 * It is stored on the ledger row itself, not only in the audit log, so it
 * travels with the movement it explains.
 */
export function MemberActions({
  userId,
  username,
  frozen,
}: {
  userId: number;
  username: string;
  frozen: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function apply() {
    const data = new FormData();
    data.set('userId', String(userId));
    data.set('amount', amount);
    data.set('reason', reason);
    start(async () => {
      const outcome = await adjustCoins(data);
      setResult(outcome);
      if (outcome.ok) {
        setAmount('');
        setReason('');
      }
    });
  }

  return (
    <div className="border-t border-line px-4 py-4">
      <Label className="mb-2">Coin adjustment</Label>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="mb-1.5">Amount</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-9 w-28 text-[13px]"
          />
        </div>
        <div className="min-w-[240px] flex-1">
          <Label className="mb-1.5">Reason (required)</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="why this adjustment is being made"
            className="h-9 text-[13px]"
          />
        </div>
        <Button size="sm" onClick={apply} disabled={pending || !amount || !reason.trim()}>
          {pending ? 'Applying…' : 'Apply adjustment'}
        </Button>
        <Button
          size="sm"
          variant={frozen ? 'outline' : 'danger'}
          disabled={pending}
          onClick={() =>
            start(async () =>
              setResult(await setFrozen(userId, !frozen, `Frozen from admin — ${username}`)),
            )
          }
        >
          {frozen ? 'Unfreeze earning' : 'Freeze earning'}
        </Button>
      </div>

      {result ? (
        <p
          className={cn('mt-3 text-[13px] leading-relaxed', result.ok ? 'text-brand' : 'text-danger')}
          role="status"
        >
          {result.ok ? result.message : result.error}
        </p>
      ) : null}

      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        A moderator’s adjustment is capped at 500 MC; above that it is refused and needs an owner.
        Every adjustment writes an audit row naming the admin and carrying this reason, and a
        negative one cannot take a balance below zero.
      </p>
    </div>
  );
}
