'use client';

import { useRef } from 'react';
import type { ClipSort } from '@/lib/store/clips';
import type { ClipSource } from '@/lib/types';

/** `any` is no filter at all, which is why it is not a `ClipSource`. */
export type ClipSourceFilter = ClipSource | 'any';
export type ClipShow = 'all' | 'clip' | 'big_win' | 'pinned' | 'max_win';

/**
 * Search, filter and sort for the clip list.
 *
 * The same shape as the member list's bar, deliberately: a mod moving between
 * the two staff screens should not have to learn a second set of controls.
 * One GET form, so the whole state of the screen lives in the URL and a
 * narrowed list can be sent to somebody else as a link.
 *
 * Drafts and published stay as two sections underneath — the filter narrows
 * both rather than replacing the split, because "what have I not finished" is
 * a different question from "where is that Aztec clip" and the screen should
 * still answer the first one while you are asking the second.
 */
export function ClipFilters({
  q,
  show,
  source,
  sort,
}: {
  q: string;
  show: ClipShow;
  source: ClipSourceFilter;
  sort: ClipSort;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();

  return (
    <form ref={form} className="ufilters" action="/admin/clips">
      <label className="uf-pick uf-search">
        <span>Search</span>
        <input
          className="inp s"
          name="q"
          defaultValue={q}
          placeholder="Title, slot name or link…"
        />
      </label>

      <label className="uf-pick">
        <span>Show</span>
        <select className="inp s" name="show" defaultValue={show} onChange={submit}>
          <option value="all">Everything</option>
          <option value="clip">Clips</option>
          <option value="big_win">Big wins</option>
          <option value="pinned">Pinned</option>
          <option value="max_win">Max wins</option>
        </select>
      </label>

      <label className="uf-pick">
        <span>Source</span>
        <select className="inp s" name="source" defaultValue={source} onChange={submit}>
          <option value="any">Any</option>
          <option value="kick">Kick</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="x">X</option>
        </select>
      </label>

      <label className="uf-pick">
        <span>Sort</span>
        <select className="inp s" name="sort" defaultValue={sort} onChange={submit}>
          <option value="featured">Carousel order</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="plays">Most watched</option>
          <option value="title">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
        </select>
      </label>

      <button className="btn sm" type="submit">
        Apply
      </button>
    </form>
  );
}
