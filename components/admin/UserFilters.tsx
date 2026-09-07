'use client';

import { useRef } from 'react';
import type { MemberFilter, MemberSort, WatchFilter } from '@/lib/store/accounts';

/**
 * Search, filter and sort for the member list.
 *
 * One GET form, so the whole state of the screen lives in the URL: a mod who
 * has narrowed a list to "VIPs who have watched 2 hours, A–Z" can send that
 * link to somebody else and they see the same list, and the back button walks
 * back through the narrowing rather than out of the page.
 *
 * The selects submit on change and the box on Enter. The Apply button stays
 * for anybody without JavaScript — the form works perfectly well without it,
 * which is the only reason the whole thing is a plain form rather than state.
 *
 * `page` is deliberately not carried through. Page 4 of everybody is not page
 * 4 of the whales, and landing on an empty page after choosing a filter reads
 * as "no whales" rather than "you are past the end".
 */
export function UserFilters({
  q,
  filter,
  watched,
  sort,
}: {
  q: string;
  filter: MemberFilter;
  watched: WatchFilter;
  sort: MemberSort;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();

  return (
    <form ref={form} className="ufilters" action="/admin/users">
      <div className="uf-search">
        <input
          className="inp"
          name="q"
          defaultValue={q}
          placeholder="Search by Discord name, Kick or Razed username, or Discord id…"
          aria-label="Search users"
        />
      </div>

      <label className="uf-pick">
        <span>Show</span>
        <select className="inp s" name="filter" defaultValue={filter} onChange={submit}>
          <option value="all">Everyone</option>
          <option value="vip">VIPs</option>
          <option value="sub">Subs (active)</option>
          <option value="whale">Whales ($100k+ wagered)</option>
          <option value="razed">Razed linked</option>
          <option value="unlinked">No Kick link</option>
          <option value="frozen">Frozen</option>
        </select>
      </label>

      <label className="uf-pick">
        <span>Watched</span>
        <select className="inp s" name="watched" defaultValue={watched} onChange={submit}>
          <option value="any">Any</option>
          <option value="1h">1h or more</option>
          <option value="2h">2h or more</option>
          <option value="5h">5h or more</option>
          <option value="10h">10h or more</option>
        </select>
      </label>

      <label className="uf-pick">
        <span>Sort</span>
        <select className="inp s" name="sort" defaultValue={sort} onChange={submit}>
          <option value="recent">Recently active</option>
          <option value="name">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="joined">Newest first</option>
          <option value="coins">Most coins</option>
          <option value="watched">Most watched</option>
        </select>
      </label>

      <button className="btn sm" type="submit">
        Apply
      </button>
    </form>
  );
}
