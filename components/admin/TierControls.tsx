'use client';

import { useState, useTransition } from 'react';
import { removeTier, toggleTier } from '@/app/(site)/admin/actions';

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Switching a tier off, and deleting one.
 *
 * Two controls rather than one because they mean different things. Switching
 * off takes a tier off the ladder and keeps every claim against it, which is
 * what you want for a tier people have already been paid at. Deleting removes
 * the row, and the server refuses it the moment a claim exists — the button is
 * hidden in that case too, so the refusal is the backstop rather than the
 * explanation.
 */
export function TierControls({
  tierId,
  name,
  active,
  claims,
}: {
  tierId: number;
  name: string;
  active: boolean;
  claims: number;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const result = await fn();
      setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });

  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          className="btn sm ghost"
          type="button"
          disabled={pending}
          title={active ? 'Take it off the ladder' : 'Put it back on the ladder'}
          onClick={() => run(() => toggleTier(tierId, !active, name))}
        >
          {active ? 'Switch off' : 'Switch on'}
        </button>
        {claims === 0 ? (
          <button
            className="btn sm danger"
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        ) : null}
      </div>

      {note ? (
        <div
          className="small"
          style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 5 }}
        >
          {note.text}
        </div>
      ) : null}

      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Delete ${name}`}>
          <div className="mbox">
            <h2>Delete {name}?</h2>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px' }}>
                Nobody has claimed this tier, so there is no payout history to lose. The ladder
                renumbers itself around the gap.
              </p>
              <p style={{ margin: 0 }}>This cannot be undone.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="btn danger wide"
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  run(() => removeTier(tierId, name));
                }}
              >
                Delete it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
