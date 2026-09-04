'use client';

import { useState, useTransition } from 'react';
import { closeRaffle, draw, freezeMonth, syncRazed } from '@/app/(site)/admin/actions';

type Result = { ok: boolean; message?: string; error?: string };

/** A button that runs one action and reports what happened beside itself. */
function ActionButton({
  label,
  running,
  className = 'btn sm',
  confirm,
  run,
}: {
  label: string;
  running: string;
  className?: string;
  confirm?: { title: string; body: React.ReactNode; go: string };
  run: () => Promise<Result>;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      const result = await run();
      setNote({ ok: result.ok, text: result.ok ? (result.message ?? 'Done') : (result.error ?? 'Failed') });
    });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          className={className}
          disabled={pending}
          onClick={() => (confirm ? setOpen(true) : go())}
        >
          {pending ? running : label}
        </button>
        {note ? (
          <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
            {note.text}
          </span>
        ) : null}
      </div>

      {open && confirm ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={confirm.title}>
          <div className="mbox">
            <h2>{confirm.title}</h2>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>
              {confirm.body}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn gold wide"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  go();
                }}
              >
                {confirm.go}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SyncRazedButton() {
  return <ActionButton label="Sync now" running="Syncing…" run={syncRazed} />;
}

export function FreezeMonthButton() {
  return (
    <ActionButton
      label="Freeze month"
      running="Freezing…"
      confirm={{
        title: 'Freeze this month?',
        body: (
          <>
            <p style={{ margin: '0 0 10px' }}>
              The standings are read from Razed once and stored. From that moment the month is a
              record rather than a live query, and a later restatement by Razed cannot move a board
              somebody has already been paid against.
            </p>
            <p style={{ margin: 0 }}>This cannot be undone.</p>
          </>
        ),
        go: 'Freeze and queue payouts',
      }}
      run={freezeMonth}
    />
  );
}

export function DrawRaffleButton({ raffleId, title }: { raffleId: number; title: string }) {
  return (
    <ActionButton
      label="Draw now"
      running="Drawing…"
      className="btn green sm"
      confirm={{
        title: `Draw ${title}?`,
        body: (
          <>
            <p style={{ margin: '0 0 10px' }}>
              The winner is picked from the seed committed when this raffle was created, and that
              seed is then published so anyone can check the draw.
            </p>
            <p style={{ margin: 0 }}>This cannot be undone.</p>
          </>
        ),
        go: 'Draw the winner',
      }}
      run={() => draw(raffleId)}
    />
  );
}

export function CloseRaffleButton({ raffleId }: { raffleId: number }) {
  return (
    <ActionButton
      label="Close entries"
      running="Closing…"
      className="btn sm ghost"
      run={() => closeRaffle(raffleId)}
    />
  );
}
