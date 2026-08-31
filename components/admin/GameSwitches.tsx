'use client';

import { useState, useTransition } from 'react';
import { Power } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { toggleGame, toggleKillSwitch, type ActionResult } from '@/app/admin/games/actions';
import type { GameSlug } from '@/lib/types';

/**
 * The kill switch and the per-game toggles — the parts of this screen that
 * actually change something.
 *
 * The kill switch asks twice. It is the most disruptive button in admin, and
 * the difference between meaning it and brushing it is one click otherwise.
 */
export function KillSwitch({ killed, isOwner }: { killed: boolean; isOwner: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function flip() {
    start(async () => {
      setResult(await toggleKillSwitch(!killed));
      setConfirming(false);
    });
  }

  return (
    <Card tone={killed ? 'danger' : 'default'} className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-start gap-3">
          <Power size={18} className={cn('mt-0.5 shrink-0', killed ? 'text-danger' : 'text-muted')} />
          <div>
            <p className="text-[15px] text-ink">
              {killed ? 'Every game is currently disabled' : 'Kill switch'}
            </p>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
              Disables every game instantly, without a deploy. The lobby is replaced by a single
              message and every play endpoint refuses. Rounds already in progress still settle.
            </p>
            {result ? (
              <p
                className={cn('mt-2 text-[13px]', result.ok ? 'text-brand' : 'text-danger')}
                role="status"
              >
                {result.ok ? result.message : result.error}
              </p>
            ) : null}
          </div>
        </div>

        {!isOwner ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            Owner only
          </span>
        ) : confirming ? (
          <span className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant={killed ? 'primary' : 'danger'} onClick={flip} disabled={pending}>
              {pending ? 'Working…' : killed ? 'Yes, bring them back' : 'Yes, disable everything'}
            </Button>
          </span>
        ) : (
          <Button variant={killed ? 'primary' : 'danger'} onClick={() => setConfirming(true)}>
            {killed ? 'Bring games back' : 'Disable every game'}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function GameToggle({
  slug,
  enabled,
  disabled,
  isOwner,
}: {
  slug: GameSlug;
  enabled: boolean;
  disabled: boolean;
  isOwner: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="flex items-center gap-2">
      {result && !result.ok ? (
        <span className="text-[11.5px] text-danger">{result.error}</span>
      ) : null}
      <label
        className={cn(
          'flex items-center gap-2 text-[12.5px] text-muted',
          isOwner && !disabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled || pending || !isOwner}
          onChange={(e) =>
            start(async () => setResult(await toggleGame(slug, e.target.checked)))
          }
          className="size-4 accent-[#2B8FFF]"
        />
        Enabled
      </label>
    </span>
  );
}
