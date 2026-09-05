'use client';

import { useState, useTransition } from 'react';
import { addRaffle } from '@/app/(site)/admin/actions';
import { coins } from '@/lib/format';

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Creating a raffle.
 *
 * The slug is derived from the title as you type and stays editable — it is
 * the public URL, and a mod should not have to think about it while still
 * being able to fix it when the derived one reads badly.
 *
 * Collapsed behind a button because this screen's job during a stream is
 * closing and drawing the raffles that already exist; creating one is the
 * occasional act, and a permanent form at the top pushes the working list
 * below the fold.
 */
export function AddRaffleForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [cost, setCost] = useState('0');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const derived = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const effectiveSlug = slugTouched ? slug : derived;

  const costNumber = Number(cost);
  const free = Number.isFinite(costNumber) && costNumber === 0;

  if (!open) {
    return (
      <div style={{ marginBottom: 18 }}>
        <button className="btn gold sm" onClick={() => setOpen(true)}>
          Create a raffle
        </button>
        {note ? (
          <div className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 8 }}>
            {note.text}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="card"
      style={{ marginBottom: 18 }}
      action={(data: FormData) =>
        start(async () => {
          data.set('slug', effectiveSlug);
          const result: Result = await addRaffle(data);
          setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
          if (result.ok) {
            setOpen(false);
            setTitle('');
            setSlug('');
            setSlugTouched(false);
            setCost('0');
          }
        })
      }
    >
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Create a raffle</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        The draw seed is committed and its hash published the moment this opens, so the winner is
        fixed before anybody has entered. It opens immediately — there is no draft state.
      </p>

      <div className="field">
        <label htmlFor="raffle-title">Prize</label>
        <input
          id="raffle-title"
          name="title"
          className="inp"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="PlayStation 5 Slim"
          required
          autoFocus
        />
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="field">
          <label htmlFor="raffle-value">What it is worth</label>
          <input
            id="raffle-value"
            name="valueLabel"
            className="inp"
            placeholder="£480"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="raffle-slug">URL</label>
          <input
            id="raffle-slug"
            className="inp"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="playstation-5-slim"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="raffle-desc">Description</label>
        <input
          id="raffle-desc"
          name="description"
          className="inp"
          placeholder="Disc edition, sealed, posted anywhere he can legally post it."
        />
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="field">
          <label htmlFor="raffle-cost">Entry cost — 0 is free</label>
          <input
            id="raffle-cost"
            name="cost"
            className="inp"
            type="number"
            min="0"
            step="1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="raffle-max">Max entries each</label>
          <input
            id="raffle-max"
            name="maxEntries"
            className="inp"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
          />
        </div>
        <div className="field">
          <label htmlFor="raffle-closes">Closes</label>
          <input
            id="raffle-closes"
            name="closesAt"
            className="inp"
            type="datetime-local"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="raffle-symbol">Symbol</label>
          <input id="raffle-symbol" name="symbol" className="inp" defaultValue="✦" maxLength={4} />
        </div>
      </div>

      <div className="readout" style={{ borderTop: '1px solid var(--edge)' }}>
        <span>Entry</span>
        <b style={{ color: free ? 'var(--green)' : 'var(--gold)' }}>
          {free ? 'Free' : coins(Number.isFinite(costNumber) ? costNumber : 0)}
        </b>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn ghost sm" type="button" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
        <button className="btn gold sm" type="submit" disabled={pending || !title.trim()}>
          {pending ? 'Opening…' : 'Open the raffle'}
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
