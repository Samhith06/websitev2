'use client';

import { useState, useTransition } from 'react';
import {
  closeRaffle,
  draw,
  freezeMonth,
  recheckBadges,
  recordPastMonth,
  sweepBadges,
  syncRazed,
} from '@/app/(site)/admin/actions';

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

/** Adds a finished month the site never froze, for its badges and the archive. */
export function RecordPastMonth({ defaultMonth }: { defaultMonth: string }) {
  const [month, setMonth] = useState(defaultMonth);
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 15, marginBottom: 4 }}>Record a past month</h2>
      <p className="small muted" style={{ margin: '0 0 12px', maxWidth: '72ch' }}>
        Reads a finished month from Razed and adds it to the archive, so Champion and Podium can be
        awarded from it. It queues no payouts, opens no claims and shows no prize amounts. Refused
        if a board already covers that month.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          className="inp s"
          type="month"
          aria-label="Month to record"
          max={defaultMonth}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          style={{ width: 180 }}
        />
        <ActionButton
          label="Record month"
          running="Recording…"
          confirm={{
            title: `Record ${month}?`,
            body: (
              <>
                <p style={{ margin: '0 0 10px' }}>
                  Razed&rsquo;s figures for that month are stored as its final results, and its
                  winner becomes Champion and its top 3 Podium, unless a later board has been
                  frozen.
                </p>
                <p style={{ margin: 0 }}>This cannot be undone.</p>
              </>
            ),
            go: 'Record it',
          }}
          run={() => recordPastMonth(month)}
        />
      </div>
    </div>
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

/**
 * Re-run every badge rule.
 *
 * No confirmation, because there is nothing to undo: the sweep only ever
 * awards, and awarding something already held is a no-op.
 */
export function SweepBadgesButton() {
  return <ActionButton label="Re-evaluate badges" running="Evaluating…" run={sweepBadges} />;
}

export function RecheckBadgesButton({ userId }: { userId: number }) {
  return (
    <ActionButton
      label="Re-check badges"
      running="Checking…"
      className="btn sm ghost"
      run={() => recheckBadges(userId)}
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
