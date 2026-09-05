'use client';

import { useState, useTransition } from 'react';
import { killGames, saveGameLimits, setGameAvailable } from '@/app/(site)/admin/actions';
import { coins } from '@/lib/format';
import type { GameSlug } from '@/lib/types';

type Result = { ok: true; message: string } | { ok: false; error: string };

function useSwitch() {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const result = await fn();
      setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });

  return { note, pending, run };
}

/* -------------------------------------------------------------------------- */
/* Site-wide                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The kill switch.
 *
 * Killing is one press and takes effect on the next request, because the whole
 * point of it is the moment you need it. Turning games *back on* is the half
 * that asks for confirmation — the switch is usually down because something was
 * wrong, and restoring it before that is understood is the expensive mistake,
 * not flipping it off unnecessarily.
 */
export function KillSwitch({ killed }: { killed: boolean }) {
  const { note, pending, run } = useSwitch();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className={`tag ${killed ? 'red' : 'green'}`}>{killed ? 'Killed' : 'On'}</span>
        <button
          className={`btn sm ${killed ? 'green' : 'danger'}`}
          disabled={pending}
          onClick={() => (killed ? setConfirming(true) : run(() => killGames(true)))}
        >
          {pending ? 'Saving…' : killed ? 'Turn games back on' : 'Stop all games'}
        </button>
        {note ? (
          <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
            {note.text}
          </span>
        ) : null}
      </div>

      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Turn games back on">
          <div className="mbox">
            <h2>Turn games back on?</h2>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px' }}>
                Every game that is not individually switched off becomes playable again on the next
                request, and the API starts accepting bets immediately.
              </p>
              <p style={{ margin: 0 }}>
                Games that were turned off one at a time stay off — this only lifts the site-wide
                stop.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="btn green wide"
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  run(() => killGames(false));
                }}
              >
                Turn them on
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* One game                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One game's switch.
 *
 * `killed` is passed in so the row can say "off — everything is" rather than
 * claiming a game is on while the site-wide stop is holding it shut.
 * `gameIsPlayable` checks the kill switch first, and a screen that showed
 * otherwise would be lying about the thing it exists to report.
 */
export function GameSwitch({
  slug,
  name,
  disabled,
  killed,
  limits,
  defaults,
}: {
  slug: GameSlug;
  name: string;
  disabled: boolean;
  killed: boolean;
  /** The limits in force, whether overridden or inherited. */
  limits: { minBet: number; maxBet: number; overridden: boolean };
  /** What the game falls back to with no override, shown as the placeholder. */
  defaults: { minBet: number; maxBet: number };
}) {
  const { note, pending, run } = useSwitch();
  const [editing, setEditing] = useState(false);
  const [savedNote, setSavedNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  return (
    <div className="linkrow" style={{ flexWrap: 'wrap', gap: 8 }}>
      <span className="lk">
        {name}
        <span className="small muted" style={{ marginLeft: 8, fontFamily: 'var(--mono)' }}>
          {coins(limits.minBet)}–{coins(limits.maxBet)} MC
          {limits.overridden ? '' : ' · default'}
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        {note ? (
          <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
            {note.text}
          </span>
        ) : null}
        <span className={`tag ${disabled ? 'red' : killed ? 'warn' : 'green'}`}>
          {disabled ? 'Off' : killed ? 'Off — all games are' : 'On'}
        </span>
        <button className="btn sm ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Close' : 'Limits'}
        </button>
        <button
          className={`btn sm ${disabled ? 'green' : 'ghost'}`}
          disabled={pending}
          onClick={() => run(() => setGameAvailable(slug, disabled))}
        >
          {pending ? '…' : disabled ? 'Turn on' : 'Turn off'}
        </button>
      </span>

      {editing ? (
        <form
          style={{
            flexBasis: '100%',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            paddingTop: 10,
          }}
          action={(data: FormData) =>
            startSave(async () => {
              data.set('slug', slug);
              const result = await saveGameLimits(data);
              setSavedNote(
                result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
              );
              if (result.ok) setEditing(false);
            })
          }
        >
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={`${slug}-min`}>Min bet</label>
            <input
              id={`${slug}-min`}
              name="minBet"
              className="inp s"
              type="number"
              min="1"
              step="1"
              style={{ width: 110 }}
              defaultValue={limits.overridden ? limits.minBet : ''}
              placeholder={String(defaults.minBet)}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor={`${slug}-max`}>Max bet</label>
            <input
              id={`${slug}-max`}
              name="maxBet"
              className="inp s"
              type="number"
              min="1"
              step="1"
              style={{ width: 110 }}
              defaultValue={limits.overridden ? limits.maxBet : ''}
              placeholder={String(defaults.maxBet)}
            />
          </div>
          <button className="btn sm gold" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save limits'}
          </button>
          <span className="small muted" style={{ flex: 1, minWidth: 220 }}>
            Blank uses the shipped default. Takes effect on the next round — the server checks it
            every time, so an open tab cannot bet over it.
          </span>
        </form>
      ) : null}

      {savedNote ? (
        <span
          className="small"
          style={{ flexBasis: '100%', color: savedNote.ok ? 'var(--green)' : 'var(--red)' }}
        >
          {savedNote.text}
        </span>
      ) : null}
    </div>
  );
}
