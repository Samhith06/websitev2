'use client';

import { useState, useTransition } from 'react';
import { removeShopItem } from '@/app/(site)/admin/actions';

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Deleting an item from the catalogue.
 *
 * Only offered for an item nobody has ever bought. Anything with orders against
 * it is switched off in the edit form instead: the item leaves the shop and
 * every redemption stays where a moderator can still read it. The server
 * refuses the delete on the same grounds, so this button being absent is the
 * courtesy and the refusal is the rule.
 */
export function ShopItemDelete({ itemId, name }: { itemId: number; name: string }) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        className="btn sm danger"
        type="button"
        disabled={pending}
        title="Remove it from the catalogue"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>

      {note ? (
        <div
          className="small"
          style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 5 }}
        >
          {note.text}
        </div>
      ) : null}

      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Delete ${name}`}>
          <div className="mbox">
            <h2>Delete {name}?</h2>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px' }}>
                Nobody has bought this one, so there is no order history to lose. It disappears from
                the store and from this table.
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
                  start(async () => {
                    const result: Result = await removeShopItem(itemId, name);
                    setNote(
                      result.ok
                        ? { ok: true, text: result.message }
                        : { ok: false, text: result.error },
                    );
                  });
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
