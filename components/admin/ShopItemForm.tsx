'use client';

import { useState, useTransition } from 'react';
import { saveShopItem } from '@/app/(site)/admin/actions';
import type { StoredItem } from '@/lib/store/shop';

type Result = { ok: true; message: string } | { ok: false; error: string };

const CATEGORIES = ['entries', 'discord', 'merch', 'stream', 'tips'] as const;

/**
 * Adding an item, and editing one.
 *
 * The same form both ways, because the fields are identical and two that drift
 * apart is how "you can set a cooldown when you create it but not afterwards"
 * happens. `item` being present is the only difference: it fills the fields and
 * carries the id, which is what makes `upsertItem` update rather than insert.
 *
 * Editing a price cannot disturb anybody's history — `redemptions` copies the
 * cost onto its own row when the purchase is made — so this needs no
 * confirmation step, and the form says so rather than leaving it to be worried
 * about.
 */
export function ShopItemForm({ item }: { item?: StoredItem }) {
  const editing = Boolean(item);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <>
        <button
          className={editing ? 'btn sm ghost' : 'btn gold sm'}
          onClick={() => setOpen(true)}
        >
          {editing ? 'Edit' : 'Add an item'}
        </button>
        {note ? (
          <div
            className="small"
            style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 6 }}
          >
            {note.text}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={editing ? `Edit ${item!.name}` : 'Add an item'}>
      <form
        className="mbox"
        style={{ textAlign: 'left', maxWidth: 560 }}
        action={(data: FormData) =>
          start(async () => {
            const result: Result = await saveShopItem(data);
            setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
            if (result.ok) setOpen(false);
          })
        }
      >
        <h2 style={{ textAlign: 'center' }}>{editing ? `Edit ${item!.name}` : 'Add an item'}</h2>

        {editing ? <input type="hidden" name="id" value={item!.id} /> : null}

        <div className="field">
          <label htmlFor="item-name">Name</label>
          <input
            id="item-name"
            name="name"
            className="inp"
            defaultValue={item?.name ?? ''}
            placeholder="MattySpins hoodie"
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="item-desc">Description</label>
          <input
            id="item-desc"
            name="description"
            className="inp"
            defaultValue={item?.description ?? ''}
            placeholder="Heavyweight, embroidered mark. Sizes S to XXL."
          />
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="field">
            <label htmlFor="item-cost">Cost in coins</label>
            <input
              id="item-cost"
              name="cost"
              className="inp"
              type="number"
              min="1"
              step="1"
              defaultValue={item?.cost ?? ''}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="item-cat">Category</label>
            <select
              id="item-cat"
              name="category"
              className="inp"
              defaultValue={item?.category ?? 'entries'}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="field">
            <label htmlFor="item-stock">Stock — blank is unlimited</label>
            <input
              id="item-stock"
              name="stock"
              className="inp"
              type="number"
              min="0"
              step="1"
              defaultValue={item?.stock ?? ''}
              placeholder="∞"
            />
          </div>
          <div className="field">
            <label htmlFor="item-cooldown">Cooldown days — blank is none</label>
            <input
              id="item-cooldown"
              name="cooldownDays"
              className="inp"
              type="number"
              min="1"
              step="1"
              defaultValue={item?.cooldownDays ?? ''}
              placeholder="—"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 4 }}>
          <label className="small" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="checkbox" name="needsReview" defaultChecked={item?.needsReview ?? false} />{' '}
            A mod approves each order
          </label>
          <label className="small" style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Live in the
            store
          </label>
        </div>

        <p className="small muted" style={{ marginTop: 12 }}>
          {editing
            ? 'Changing the price never touches an existing order — the cost is copied onto the redemption when it is bought.'
            : 'Leave it not-live to stage an item and switch it on when the stream starts.'}
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn ghost wide" type="button" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </button>
          <button className="btn gold wide" type="submit" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add it'}
          </button>
        </div>

        {note && !note.ok ? (
          <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>
            {note.text}
          </div>
        ) : null}
      </form>
    </div>
  );
}
