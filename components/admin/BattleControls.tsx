'use client';

import { useState, useTransition } from 'react';
import {
  dismissBattlePoolEntry,
  drawBattle,
  endBattle,
  removeBattle,
  resolveBattle,
  skipBattle,
  startBattle,
  toggleBattleRequests,
  undoBattleResult,
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

export function StartBattleForm() {
  const { note, pending, run } = useAction();
  return (
    <form className="card" style={{ marginBottom: 18 }} action={(data: FormData) => run(() => startBattle(data))}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Start a team battle</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Chat picks a side with <b>!sr &lt;team&gt; &lt;slot&gt;</b> — plain <b>!sr &lt;slot&gt;</b> goes on the
        smaller team — and stays on it. Draws alternate between the teams, and each buy adds its multiplier
        to its team&apos;s total. After the buys per team, the higher total wins (a tie plays one more buy
        each), and the pot is split evenly across the winning team&apos;s linked members.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 200px', marginBottom: 0 }}>
          <label htmlFor="battle-title">Name</label>
          <input id="battle-title" name="title" className="inp" placeholder="Saturday Team Battle" required />
        </div>
        <div className="field" style={{ flex: '1 1 110px', marginBottom: 0 }}>
          <label htmlFor="battle-a">Team 1</label>
          <input id="battle-a" name="teamA" className="inp" defaultValue="Blue" maxLength={16} pattern="[A-Za-z0-9]{1,16}" required />
        </div>
        <div className="field" style={{ flex: '1 1 110px', marginBottom: 0 }}>
          <label htmlFor="battle-b">Team 2</label>
          <input id="battle-b" name="teamB" className="inp" defaultValue="Red" maxLength={16} pattern="[A-Za-z0-9]{1,16}" required />
        </div>
        <div className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}>
          <label htmlFor="battle-rounds">Buys per team</label>
          <input id="battle-rounds" name="rounds" className="inp" type="number" min="1" max="50" step="1" defaultValue="5" required />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="battle-prize">Pot (MC)</label>
          <input id="battle-prize" name="prize" className="inp" type="number" min="0" step="1" defaultValue="500" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start battle'}
        </button>
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>
        Team names are one word, so chat can type them before a slot: <code>!sr blue sweet bonanza</code>.
      </p>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

/**
 * The battle's controls in the order a stream uses them. Drawing is the main
 * button; it is held back while a buy is in play or once the battle is
 * decided, since the next step then is recording the result or ending it.
 */
export function BattleSwitches({
  gameId,
  requestsOpen,
  nextTeam,
  waiting,
  inPlay,
  decided,
  canUndo,
}: {
  gameId: number;
  requestsOpen: boolean;
  /** The name of the team whose turn it is, or null once decided. */
  nextTeam: string | null;
  /** Waiting members on that team. */
  waiting: number;
  inPlay: boolean;
  decided: boolean;
  canUndo: boolean;
}) {
  const { note, pending, run } = useAction();
  const drawBlocked = inPlay
    ? 'Record the buy in play first'
    : decided
      ? 'The battle is decided — end it'
      : waiting === 0
        ? `Nobody on ${nextTeam} is waiting`
        : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || drawBlocked != null}
          title={drawBlocked ?? undefined}
          onClick={() => run(() => drawBattle(gameId))}
        >
          {pending ? 'Drawing…' : nextTeam ? `Draw for ${nextTeam} (${waiting} waiting)` : 'Draw'}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => toggleBattleRequests(gameId, !requestsOpen))}>
          {requestsOpen ? 'Close !sr' : 'Open !sr'}
        </button>
        {canUndo ? (
          <button className="btn ghost sm" disabled={pending} onClick={() => run(() => undoBattleResult(gameId))}>
            Undo last result
          </button>
        ) : null}
        <button
          className={`btn sm ${decided ? 'gold' : 'ghost'}`}
          disabled={pending || inPlay}
          title={inPlay ? 'Record or skip the buy in play first' : undefined}
          onClick={() => {
            if (decided || window.confirm('End this battle before it is decided? Nobody will be paid.')) {
              run(() => endBattle(gameId));
            }
          }}
        >
          {decided ? 'End battle & pay the team' : 'End battle'}
        </button>
      </div>
      <NoteText note={note} />
    </div>
  );
}

/** The drawn member's buy: what it cost and what it paid, or skip it. */
export function BattleResultForm({ turnId }: { turnId: number }) {
  const { note, pending, run } = useAction();
  return (
    <div>
      <form style={row} action={(data: FormData) => run(() => resolveBattle(data))}>
        <input type="hidden" name="turnId" value={turnId} />
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="battle-cost">Buy cost ($)</label>
          <input id="battle-cost" name="buyCost" className="inp s" inputMode="decimal" placeholder="200" required autoFocus />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="battle-payout">Paid ($)</label>
          <input id="battle-payout" name="payout" className="inp s" inputMode="decimal" placeholder="0" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Record result'}
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={pending}
          title="The slot can't be played — still the same team's turn, and they can !sr again"
          onClick={() => run(() => skipBattle(turnId))}
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

export function DismissBattleEntryButton({ entryId }: { entryId: number }) {
  const { note, pending, run } = useAction();
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => dismissBattlePoolEntry(entryId))}>
        Remove
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </>
  );
}

export function DeleteBattleButton({ gameId, title }: { gameId: number; title: string }) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn ghost sm"
        style={{ color: 'var(--red)', borderColor: 'rgba(255, 92, 92, 0.35)' }}
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete "${title}" and all its buys and members? This cannot be undone.`)) {
            run(() => removeBattle(gameId));
          }
        }}
      >
        {pending ? 'Deleting…' : 'Delete battle'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </div>
  );
}
