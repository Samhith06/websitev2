'use client';

import { useState, useTransition } from 'react';
import { coins } from '@/lib/format';
import { adjustBalance } from '@/app/(site)/admin/actions';

/**
 * Adding or removing coins from one account.
 *
 * The dialog shows the resulting balance before the button is pressed, because
 * the sign is the easiest thing in the world to get backwards and a −5,000
 * meant as +5,000 is a bad afternoon for whoever is on the other end.
 *
 * Nothing here edits a balance. It writes an ordinary ledger row, so the member
 * sees the reason in their own coin history alongside every other movement.
 */
export function AdjustBalance({
  userId,
  username,
  balance,
}: {
  userId: number;
  username: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const delta = Number(amount);
  const valid = Number.isInteger(delta) && delta !== 0;
  const after = valid ? balance + delta : balance;
  const wouldGoNegative = valid && after < 0;

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>
        Adjust
      </button>

      {note ? (
        <div className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 5 }}>
          {note.text}
        </div>
      ) : null}

      {open ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Adjust ${username}`}>
          <div className="mbox" style={{ textAlign: 'left' }}>
            <h2 style={{ textAlign: 'center' }}>Adjust {username}</h2>
            <p style={{ textAlign: 'center' }}>
              They currently hold <b style={{ color: 'var(--gold)' }}>{coins(balance)}</b>. This
              writes a normal ledger row, so they will see the reason in their coin history.
            </p>

            <div className="field">
              <label htmlFor="adjust-amount">Amount — negative to remove</label>
              <input
                id="adjust-amount"
                className="inp"
                type="number"
                step="1"
                placeholder="e.g. 500 or -500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="adjust-reason">Reason — the member reads this</label>
              <input
                id="adjust-reason"
                className="inp"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="compensation for the raffle bug"
              />
            </div>

            <div className="readout" style={{ borderTop: '1px solid var(--edge)' }}>
              <span>Balance after</span>
              <b style={{ color: wouldGoNegative ? 'var(--red)' : 'var(--gold)' }}>
                {valid ? coins(after) : coins(balance)}
              </b>
            </div>

            {wouldGoNegative ? (
              <div className="small" style={{ color: 'var(--red)', marginTop: 8 }}>
                That would take them below zero. A balance cannot go negative.
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                className="btn ghost wide"
                onClick={() => {
                  setOpen(false);
                  setAmount('');
                  setReason('');
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                className={`btn wide ${delta < 0 ? 'danger' : 'gold'}`}
                disabled={pending || !valid || !reason.trim() || wouldGoNegative}
                onClick={() =>
                  start(async () => {
                    const data = new FormData();
                    data.set('userId', String(userId));
                    data.set('delta', String(delta));
                    data.set('reason', reason);
                    const result = await adjustBalance(data);
                    setNote(
                      result.ok
                        ? { ok: true, text: result.message }
                        : { ok: false, text: result.error },
                    );
                    if (result.ok) {
                      setOpen(false);
                      setAmount('');
                      setReason('');
                    }
                  })
                }
              >
                {pending
                  ? 'Saving…'
                  : delta < 0
                    ? `Remove ${coins(Math.abs(delta) || 0)}`
                    : `Add ${coins(delta || 0)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
