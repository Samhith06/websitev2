'use client';

import { useState, useTransition } from 'react';
import {
  cancelSplitSteal,
  drawSplitStealPairs,
  markSplitStealPaid,
  openSplitSteal,
  revealSplitSteal,
  type Outcome,
} from '@/app/(site)/admin/actions';

type Note = { ok: boolean; text: string } | null;

function useAction() {
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Outcome>) =>
    start(async () => {
      const result = await fn();
      setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });
  return { note, pending, run };
}

function NoteText({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
      {note.text}
    </span>
  );
}

const row = { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' } as const;

export function OpenSplitStealForm() {
  const { note, pending, run } = useAction();
  return (
    <form className="card" style={{ marginBottom: 18 }} action={(data: FormData) => run(() => openSplitSteal(data))}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Open a Split or Steal</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Members enter on <b>/split-or-steal</b> with $1,000 wagered this leaderboard period. When you draw, entrants are
        shuffled into pairs; each player then locks in Split or Steal on the site, and you reveal the pairs on stream.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="ss-title">Name</label>
          <input id="ss-title" name="title" className="inp" placeholder="Split or Steal" maxLength={80} />
        </div>
        <div className="field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
          <label htmlFor="ss-prize">Prize per pair ($)</label>
          <input id="ss-prize" name="prize" className="inp" inputMode="decimal" defaultValue="50" required />
        </div>
        <div className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}>
          <label htmlFor="ss-pairs">Pairs</label>
          <input id="ss-pairs" name="pairs" className="inp" type="number" min="1" max="100" step="1" defaultValue="5" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Opening…' : 'Open entries'}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

export function EntrySwitches({
  eventId,
  entries,
  pairs,
  isOwner,
}: {
  eventId: number;
  entries: number;
  pairs: number;
  isOwner: boolean;
}) {
  const { note, pending, run } = useAction();
  const drawn = Math.min(pairs, Math.floor(entries / 2));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || entries < 2}
          title={entries < 2 ? 'At least 2 people need to enter' : undefined}
          onClick={() => {
            const left = entries - drawn * 2;
            const extra = left > 0 ? ` ${left} of the ${entries} entrants will miss out, at random.` : '';
            if (window.confirm(`Close entries and draw ${drawn} pair${drawn === 1 ? '' : 's'}?${extra}`)) {
              run(() => drawSplitStealPairs(eventId));
            }
          }}
        >
          {pending ? 'Drawing…' : `Close entries and draw pairs (${entries} entered)`}
        </button>
        {isOwner ? <CancelButton eventId={eventId} run={run} pending={pending} /> : null}
      </div>
      <NoteText note={note} />
    </div>
  );
}

function CancelButton({
  eventId,
  run,
  pending,
}: {
  eventId: number;
  run: (fn: () => Promise<Outcome>) => void;
  pending: boolean;
}) {
  return (
    <button
      className="btn ghost sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm('Cancel this Split or Steal? Nobody will be paid.')) run(() => cancelSplitSteal(eventId));
      }}
    >
      Cancel event
    </button>
  );
}

export function RevealSwitches({
  eventId,
  hidden,
  isOwner,
}: {
  eventId: number;
  hidden: number;
  isOwner: boolean;
}) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || hidden === 0}
          onClick={() => {
            if (window.confirm(`Reveal all ${hidden} remaining pair${hidden === 1 ? '' : 's'}? Anyone who has not chosen forfeits.`)) {
              run(() => revealSplitSteal(eventId, 'all'));
            }
          }}
        >
          {pending ? 'Revealing…' : `Reveal all (${hidden} left)`}
        </button>
        {isOwner ? <CancelButton eventId={eventId} run={run} pending={pending} /> : null}
      </div>
      <NoteText note={note} />
    </div>
  );
}

export function RevealPairButton({ eventId, pairId, missing }: { eventId: number; pairId: number; missing: number }) {
  const { note, pending, run } = useAction();
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn sm"
        disabled={pending}
        onClick={() => {
          const warn = missing ? ` ${missing === 2 ? 'Neither player has' : 'One player has not'} chosen, and will forfeit.` : '';
          if (!warn || window.confirm(`Reveal this pair?${warn}`)) run(() => revealSplitSteal(eventId, pairId));
        }}
      >
        {pending ? '…' : 'Reveal'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </span>
  );
}

export function PaidButton({ pairId, paid }: { pairId: number; paid: boolean }) {
  const { note, pending, run } = useAction();
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button className={`btn sm${paid ? ' ghost' : ''}`} disabled={pending} onClick={() => run(() => markSplitStealPaid(pairId, !paid))}>
        {paid ? 'Undo paid' : 'Mark paid'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </span>
  );
}
