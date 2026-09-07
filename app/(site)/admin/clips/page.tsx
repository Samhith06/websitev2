import { auth } from '@/auth';
import { devBypass, roleFor } from '@/lib/admin';
import { MAX_PINS, listClips, pinnedCount, type ClipSort } from '@/lib/store/clips';
import type { ClipSource } from '@/lib/types';
import { clipLength, compact, dateShort, formatMultiplier, money } from '@/lib/format';
import { AddClipForm, ClipRowActions, RefreshClipsButton } from '@/components/admin/ClipControls';
import {
  ClipFilters,
  type ClipShow,
  type ClipSourceFilter,
} from '@/components/admin/ClipFilters';

export const metadata = { title: 'Clips' };
export const dynamic = 'force-dynamic';

/**
 * Clips and big wins.
 *
 * The store layer for this has existed since the first migration — parsing,
 * pinning, publishing, the big-win validation — with no screen attached to it,
 * so the home carousel and the wall of fame could only be filled by writing
 * SQL by hand. This is the screen.
 *
 * Drafts are listed above published ones on purpose. A draft is a job someone
 * has started and not finished, and burying it under thirty published clips is
 * how it stays unfinished.
 */
const SHOWS: ClipShow[] = ['all', 'clip', 'big_win', 'pinned', 'max_win'];
const SOURCES: ClipSourceFilter[] = ['any', 'kick', 'youtube', 'instagram', 'x'];
const SORTS: ClipSort[] = ['featured', 'newest', 'oldest', 'plays', 'title', 'title_desc'];

/** Anything not in the list falls back rather than reaching SQL. */
function pick<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export default async function AdminClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string; source?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? '';
  const show = pick(params.show, SHOWS, 'all');
  const source = pick(params.source, SOURCES, 'any');
  const sort = pick(params.sort, SORTS, 'featured');

  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const [all, pins] = await Promise.all([
    listClips({
      limit: 200,
      query: q,
      sort,
      source: source === 'any' ? undefined : (source as ClipSource),
      kind: show === 'clip' || show === 'big_win' ? show : undefined,
      pinned: show === 'pinned' || undefined,
      maxWin: show === 'max_win' || undefined,
    }),
    pinnedCount(),
  ]);

  const drafts = all.filter((c) => c.status === 'draft');
  const published = all.filter((c) => c.status === 'published');
  const narrowed = Boolean(q.trim()) || show !== 'all' || source !== 'any';

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {published.length} published · {drafts.length} draft
            {narrowed ? ' · filtered' : ''}
          </span>
          <h1>Clips</h1>
          <div className="sh-sub">
            Nothing appears on the public site until it is published. {pins} of {MAX_PINS} pins
            used — pinned clips lead the carousel. A Kick clip that will not play needs
            &ldquo;Refresh clip data&rdquo;: its stream URL comes from Kick and cannot be guessed.
          </div>
        </div>
        <RefreshClipsButton />
      </div>

      <AddClipForm />

      <ClipFilters q={q} show={show} source={source} sort={sort} />

      <Section
        title="Drafts"
        empty={
          narrowed
            ? 'No drafts match that filter.'
            : 'No drafts — everything added has been published.'
        }
        clips={drafts}
        canDelete={isOwner}
      />

      <Section
        title="Published"
        empty={
          narrowed
            ? 'No published clips match that filter.'
            : 'Nothing is published yet, so the carousel and the wall of fame are empty.'
        }
        clips={published}
        canDelete={isOwner}
      />

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        A big win&rsquo;s multiplier is never stored — it is derived from the bet and the payout
        every time it is shown, so it cannot disagree with the two figures printed beside it.
        Deleting is owner-only; unpublishing hides a clip just as well and keeps the row.
      </p>
    </>
  );
}

function Section({
  title,
  empty,
  clips,
  canDelete,
}: {
  title: string;
  empty: string;
  clips: Awaited<ReturnType<typeof listClips>>;
  canDelete: boolean;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>
        {title}{' '}
        <span className="small muted" style={{ fontWeight: 400 }}>
          · {clips.length}
        </span>
      </h2>

      {clips.length === 0 ? (
        <div className="emptyq">{empty}</div>
      ) : (
        <div className="tw tclips">
          <table>
            <thead>
              <tr>
                <th>Clip</th>
                <th>Figures</th>
                <th>Watched</th>
                <th>When</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((clip) => (
                <tr key={clip.id}>
                  {/* Kind, source and length were three columns of their own,
                      which left the title squeezed into a two-word ribbon and
                      pushed the buttons off the right-hand edge. They are all
                      *about* the clip, so they sit under its name. */}
                  <td className="clipcell">
                    <a href={clip.url} target="_blank" rel="noreferrer noopener">
                      {clip.title}
                    </a>
                    <div className="clipmeta">
                      <span className={`tag ${clip.kind === 'big_win' ? 'gold' : ''}`}>
                        {clip.kind === 'big_win' ? 'big win' : 'clip'}
                      </span>
                      {clip.pinned ? <span className="tag gold">pinned</span> : null}
                      {clip.maxWin ? <span className="tag max">max win</span> : null}
                      <span className="small muted">
                        {clip.source} · {clip.aspect}
                        {clip.durationSeconds > 0 ? ` · ${clipLength(clip.durationSeconds)}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="n">
                    {clip.kind === 'big_win' && clip.bet && clip.payout ? (
                      <>
                        {money(clip.bet)} → {money(clip.payout)}{' '}
                        <b style={{ color: 'var(--gold)' }}>
                          {formatMultiplier(clip.bet, clip.payout)}
                        </b>
                        {clip.slotName ? (
                          <span className="small muted"> · {clip.slotName}</span>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  {/* Two different numbers, so both are labelled. "here" is
                      plays on this site; "kick" is Kick's own view count,
                      which counts views that never touched this site. */}
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    <b style={{ color: 'var(--text)' }}>{compact(clip.plays ?? 0)}</b> here
                    {typeof clip.views === 'number' ? (
                      <span className="small muted"> · {compact(clip.views)} kick</span>
                    ) : null}
                  </td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {dateShort(clip.occurredAt)}
                  </td>
                  <td className="acts">
                    <ClipRowActions
                      id={clip.id}
                      title={clip.title}
                      published={clip.status === 'published'}
                      pinned={Boolean(clip.pinned)}
                      canDelete={canDelete}
                      bigWin={clip.kind === 'big_win'}
                      maxWin={Boolean(clip.maxWin)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
