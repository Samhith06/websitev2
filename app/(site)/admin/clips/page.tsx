import { auth } from '@/auth';
import { devBypass, roleFor } from '@/lib/admin';
import { MAX_PINS, listClips, pinnedCount } from '@/lib/store/clips';
import { clipLength, dateShort, formatMultiplier, money } from '@/lib/format';
import { AddClipForm, ClipRowActions, RefreshClipsButton } from '@/components/admin/ClipControls';

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
export default async function AdminClipsPage() {
  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const [all, pins] = await Promise.all([listClips({ limit: 200 }), pinnedCount()]);

  const drafts = all.filter((c) => c.status === 'draft');
  const published = all.filter((c) => c.status === 'published');

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {published.length} published · {drafts.length} draft
          </span>
          <h1>Clips</h1>
          <div className="sh-sub">
            Nothing appears on the public site until it is published. {pins} of {MAX_PINS} pins
            used — pinned clips lead the carousel.
          </div>
        </div>
        <RefreshClipsButton />
      </div>

      <AddClipForm />

      <Section
        title="Drafts"
        empty="No drafts — everything added has been published."
        clips={drafts}
        canDelete={isOwner}
      />

      <Section
        title="Published"
        empty="Nothing is published yet, so the carousel and the wall of fame are empty."
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
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Clip</th>
                <th>Source</th>
                <th>Kind</th>
                <th>Figures</th>
                <th>When</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((clip) => (
                <tr key={clip.id}>
                  <td>
                    <a href={clip.url} target="_blank" rel="noreferrer noopener">
                      {clip.title}
                    </a>
                    {clip.pinned ? <span className="tag gold"> pinned</span> : null}
                    {clip.durationSeconds > 0 ? (
                      <span className="small muted"> · {clipLength(clip.durationSeconds)}</span>
                    ) : null}
                  </td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {clip.source} · {clip.aspect}
                  </td>
                  <td>
                    <span className={`tag ${clip.kind === 'big_win' ? 'gold' : ''}`}>
                      {clip.kind === 'big_win' ? 'big win' : 'clip'}
                    </span>
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
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {dateShort(clip.occurredAt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ClipRowActions
                      id={clip.id}
                      title={clip.title}
                      published={clip.status === 'published'}
                      pinned={Boolean(clip.pinned)}
                      canDelete={canDelete}
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
