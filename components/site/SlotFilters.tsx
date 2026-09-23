'use client';

import { useRef } from 'react';

/**
 * Search, provider, bonus-buy and sort for /slots. One GET form, so the view
 * lives in the URL and can be shared; the selects submit on change and the
 * search box on Enter. `page` is not carried through a new filter.
 */
export function SlotFilters({
  q,
  provider,
  bonusBuy,
  sort,
  providers,
}: {
  q: string;
  provider: string;
  bonusBuy: boolean;
  sort: 'new' | 'az';
  providers: Array<{ name: string; count: number }>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();

  return (
    <form ref={form} className="ufilters" action="/slots">
      <label className="uf-pick uf-search">
        <span>Search</span>
        <input className="inp s" name="q" defaultValue={q} placeholder="Slot or provider…" />
      </label>

      <label className="uf-pick">
        <span>Provider</span>
        <select className="inp s" name="provider" defaultValue={provider} onChange={submit}>
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
      </label>

      <label className="uf-pick">
        <span>Sort</span>
        <select className="inp s" name="sort" defaultValue={sort} onChange={submit}>
          <option value="new">Newest</option>
          <option value="az">A–Z</option>
        </select>
      </label>

      <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}>
        <input type="checkbox" name="buy" value="1" defaultChecked={bonusBuy} onChange={submit} />
        Bonus buy only
      </label>

      <button className="btn sm" type="submit">
        Apply
      </button>
    </form>
  );
}
