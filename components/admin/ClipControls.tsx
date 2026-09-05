'use client';

import { useState, useTransition } from 'react';
import { addClip, pinClip, publishClip, removeClip } from '@/app/(site)/admin/actions';

type Result = { ok: true; message: string } | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Adding                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The add form.
 *
 * The bet and payout fields appear only for a big win, because they are
 * required for one and meaningless for the other — showing them always would
 * mean either two ignored inputs or a validation error explaining that the
 * fields on screen do not apply.
 *
 * It defaults to draft. Publishing is a second, deliberate tick, which is what
 * keeps the public carousel curated rather than a firehose.
 */
export function AddClipForm() {
  const [kind, setKind] = useState<'clip' | 'big_win'>('clip');
  const [bet, setBet] = useState('');
  const [payout, setPayout] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const bigWin = kind === 'big_win';
  const ratio = Number(payout) / Number(bet);
  const preview = bigWin && Number(bet) > 0 && Number(payout) > 0 ? ratio : null;

  return (
    <form
      className="card"
      action={(data: FormData) =>
        start(async () => {
          const result: Result = await addClip(data);
          setNote(
            result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
          );
          if (result.ok) {
            setBet('');
            setPayout('');
            (document.getElementById('clip-form') as HTMLFormElement | null)?.reset();
            setKind('clip');
          }
        })
      }
      id="clip-form"
      style={{ marginBottom: 20 }}
    >
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Add a clip</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Kick, YouTube, Instagram or X. The embed and thumbnail are worked out from the link — for
        Kick and YouTube automatically, and the other two carry no thumbnail without an API call.
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="field">
          <label htmlFor="clip-kind">Kind</label>
          <select
            id="clip-kind"
            name="kind"
            className="inp"
            value={kind}
            onChange={(e) => setKind(e.target.value === 'big_win' ? 'big_win' : 'clip')}
          >
            <option value="clip">Clip</option>
            <option value="big_win">Big win</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="clip-occurred">When it happened</label>
          <input id="clip-occurred" name="occurredAt" className="inp" type="date" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="clip-url">URL</label>
        <input
          id="clip-url"
          name="url"
          className="inp"
          placeholder="https://kick.com/mattyspins/clips/clip_01H…"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="clip-title">Title — what people read in the carousel</label>
        <input
          id="clip-title"
          name="title"
          className="inp"
          placeholder="482x on Le Bandit"
          required
        />
      </div>

      {bigWin ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="field">
            <label htmlFor="clip-slot">Slot</label>
            <input id="clip-slot" name="slotName" className="inp" placeholder="Le Bandit" />
          </div>
          <div className="field">
            <label htmlFor="clip-bet">Bet</label>
            <input
              id="clip-bet"
              name="bet"
              className="inp"
              type="number"
              step="0.01"
              min="0"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="clip-payout">Payout</label>
            <input
              id="clip-payout"
              name="payout"
              className="inp"
              type="number"
              step="0.01"
              min="0"
              value={payout}
              onChange={(e) => setPayout(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {preview !== null ? (
        <div className="readout" style={{ borderTop: '1px solid var(--edge)' }}>
          <span>Multiplier shown on the card</span>
          <b style={{ color: 'var(--gold)' }}>{preview.toFixed(preview >= 10 ? 1 : 2)}×</b>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <label className="small" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <input type="checkbox" name="publish" /> Publish straight away
        </label>
        <label className="small" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <input type="checkbox" name="pinned" /> Pin it
        </label>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add clip'}
        </button>
        {note ? (
          <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
            {note.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Row controls                                                               */
/* -------------------------------------------------------------------------- */

function useAction() {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const result = await fn();
      setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });

  return { note, pending, run };
}

export function ClipRowActions({
  id,
  title,
  published,
  pinned,
  canDelete,
}: {
  id: string;
  title: string;
  published: boolean;
  pinned: boolean;
  canDelete: boolean;
}) {
  const { note, pending, run } = useAction();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          className={`btn sm ${published ? 'ghost' : 'green'}`}
          disabled={pending}
          onClick={() => run(() => publishClip(id, !published))}
        >
          {published ? 'Unpublish' : 'Publish'}
        </button>
        <button
          className="btn sm ghost"
          disabled={pending}
          onClick={() => run(() => pinClip(id, !pinned))}
        >
          {pinned ? 'Unpin' : 'Pin'}
        </button>
        {canDelete ? (
          <button className="btn sm danger" disabled={pending} onClick={() => setConfirming(true)}>
            Delete
          </button>
        ) : null}
      </div>

      {note ? (
        <div
          className="small"
          style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 5, textAlign: 'right' }}
        >
          {note.text}
        </div>
      ) : null}

      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Delete ${title}`}>
          <div className="mbox">
            <h2>Delete this clip?</h2>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px' }}>
                <b style={{ color: 'var(--text)' }}>{title}</b> is removed from the site and from
                the database. Unpublishing hides it just as well and keeps the row.
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
                  run(() => removeClip(id, title));
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
