'use client';

import { useState, useTransition } from 'react';
import {
  endTourney,
  forfeitTourney,
  nextTourneyBuy,
  removeTourney,
  removeTourneySignup,
  resolveTourney,
  seedTourney,
  skipTourney,
  startTourney,
  toggleTourneyRequests,
  undoTourneyResult,
  type Outcome,
} from '@/app/(site)/admin/actions';

type Note = { ok: boolean; text: string } | null;

/** One action in flight and what it said, as on every other admin screen. */
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

/* -------------------------------------------------------------------------- */

export function StartTourneyForm() {
  const { note, pending, run } = useAction();
  return (
    <form className="card" style={{ marginBottom: 18 }} action={(data: FormData) => run(() => startTourney(data))}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Open a slot tournament</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Chat signs up with <b>!sr &lt;slot&gt;</b>. When you seed the bracket, players are picked and shuffled at
        random — with too few, the bracket shrinks and some get a bye. Each match is one bonus buy per
        player, and the higher multiplier goes through; a tie means both buy again. The champion wins the
        prize.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="tourney-title">Name</label>
          <input id="tourney-title" name="title" className="inp" placeholder="Sunday Slot Cup" required />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="tourney-size">Bracket</label>
          <select id="tourney-size" name="size" className="inp" defaultValue="8">
            <option value="4">4 players</option>
            <option value="8">8 players</option>
            <option value="16">16 players</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
          <label htmlFor="tourney-prize">Champion prize (MC)</label>
          <input id="tourney-prize" name="prize" className="inp" type="number" min="0" step="1" defaultValue="500" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Opening…' : 'Open sign-ups'}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

/** Sign-ups: close or open !sr, then seed. */
export function SignupSwitches({
  gameId,
  requestsOpen,
  signups,
  size,
}: {
  gameId: number;
  requestsOpen: boolean;
  signups: number;
  size: number;
}) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || signups < 2}
          title={signups < 2 ? 'At least 2 players need to sign up' : undefined}
          onClick={() => {
            const extra = signups > size ? ` ${signups - size} of the ${signups} sign-ups will miss out, at random.` : '';
            if (window.confirm(`Seed the bracket now? Sign-ups close.${extra}`)) run(() => seedTourney(gameId));
          }}
        >
          {pending ? 'Seeding…' : `Seed the bracket (${signups} signed up)`}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => toggleTourneyRequests(gameId, !requestsOpen))}>
          {requestsOpen ? 'Close !sr' : 'Open !sr'}
        </button>
        <button
          className="btn ghost sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm('End this tournament before it starts? Nobody will be paid.')) run(() => endTourney(gameId));
          }}
        >
          End tournament
        </button>
      </div>
      <NoteText note={note} />
    </div>
  );
}

/**
 * The bracket's controls while it is played. The main button starts the next
 * buy in the current match; it is held back while a buy is in play or once
 * the final is decided.
 */
export function TourneySwitches({
  gameId,
  requestsOpen,
  nextLabel,
  inPlay,
  decided,
  canUndo,
  current,
}: {
  gameId: number;
  requestsOpen: boolean;
  /** "spinqueen's buy (Quarter-finals)", or null with no match to play. */
  nextLabel: string | null;
  inPlay: boolean;
  decided: boolean;
  canUndo: boolean;
  /** The current match's players, for Forfeit. */
  current: { a: string; b: string } | null;
}) {
  const { note, pending, run } = useAction();
  const blocked = inPlay ? 'Record the buy in play first' : decided ? 'The final is decided — end the tournament' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || blocked != null || !nextLabel}
          title={blocked ?? undefined}
          onClick={() => run(() => nextTourneyBuy(gameId))}
        >
          {pending ? 'Starting…' : nextLabel ? `Start ${nextLabel}` : 'Start next buy'}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => toggleTourneyRequests(gameId, !requestsOpen))}>
          {requestsOpen ? 'Close !sr' : 'Open !sr'}
        </button>
        {canUndo ? (
          <button className="btn ghost sm" disabled={pending} onClick={() => run(() => undoTourneyResult(gameId))}>
            Undo last result
          </button>
        ) : null}
        <button
          className={`btn sm ${decided ? 'gold' : 'ghost'}`}
          disabled={pending || inPlay}
          title={inPlay ? 'Record or skip the buy in play first' : undefined}
          onClick={() => {
            if (decided || window.confirm('End this tournament before the final is decided? Nobody will be paid.')) {
              run(() => endTourney(gameId));
            }
          }}
        >
          {decided ? 'End & crown the champion' : 'End tournament'}
        </button>
      </div>
      {current && !inPlay && !decided ? (
        <div style={{ ...row, alignItems: 'center' }}>
          <span className="small muted">Can&apos;t play?</span>
          {(['a', 'b'] as const).map((side) => (
            <button
              key={side}
              className="btn ghost sm"
              disabled={pending}
              onClick={() => {
                const loser = current[side];
                const winner = current[side === 'a' ? 'b' : 'a'];
                if (window.confirm(`${loser} forfeits the match, and ${winner} goes through?`)) {
                  run(() => forfeitTourney(gameId, side));
                }
              }}
            >
              Forfeit {current[side]}
            </button>
          ))}
        </div>
      ) : null}
      <NoteText note={note} />
    </div>
  );
}

/** The player's buy: what it cost and what it paid, or skip it. */
export function TourneyResultForm({ turnId }: { turnId: number }) {
  const { note, pending, run } = useAction();
  return (
    <div>
      <form style={row} action={(data: FormData) => run(() => resolveTourney(data))}>
        <input type="hidden" name="turnId" value={turnId} />
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="tourney-cost">Buy cost ($)</label>
          <input id="tourney-cost" name="buyCost" className="inp s" inputMode="decimal" placeholder="200" required autoFocus />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="tourney-payout">Paid ($)</label>
          <input id="tourney-payout" name="payout" className="inp s" inputMode="decimal" placeholder="0" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Record result'}
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={pending}
          title="The slot can't be played — still their turn; they can !sr another, or forfeit them"
          onClick={() => run(() => skipTourney(turnId))}
        >
          Skip
        </button>
      </form>
      <div style={{ marginTop: 8, minHeight: 18 }}>
        <NoteText note={note} />
      </div>
    </div>
  );
}

export function RemoveSignupButton({ entryId }: { entryId: number }) {
  const { note, pending, run } = useAction();
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => removeTourneySignup(entryId))}>
        Remove
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </>
  );
}

export function DeleteTourneyButton({ gameId, title }: { gameId: number; title: string }) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn ghost sm"
        style={{ color: 'var(--red)', borderColor: 'rgba(255, 92, 92, 0.35)' }}
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete "${title}" with its bracket, buys and sign-ups? This cannot be undone.`)) {
            run(() => removeTourney(gameId));
          }
        }}
      >
        {pending ? 'Deleting…' : 'Delete tournament'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </div>
  );
}
