import Link from 'next/link';
import { rows } from '@/lib/db';
import {
  searchUsers,
  type MemberFilter,
  type MemberSort,
  type WatchFilter,
} from '@/lib/store/accounts';
import { roleFor } from '@/lib/admin';
import { coins, dateShort, duration, money } from '@/lib/format';
import { auth } from '@/auth';
import { devBypass } from '@/lib/admin';
import { AdjustBalance } from '@/components/admin/AdjustBalance';
import { UserFilters } from '@/components/admin/UserFilters';

export const metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

const PAGE = 40;

const FILTERS: MemberFilter[] = ['all', 'vip', 'sub', 'whale', 'razed', 'unlinked', 'frozen'];
const WATCHED: WatchFilter[] = ['any', '1h', '2h', '5h', '10h'];
const SORTS: MemberSort[] = ['recent', 'name', 'name_desc', 'joined', 'coins', 'watched'];

/** What the count line says it is showing, so a short list is never a mystery. */
const FILTER_LABEL: Record<MemberFilter, string> = {
  all: 'accounts',
  vip: 'VIPs',
  sub: 'active subs',
  whale: 'whales',
  razed: 'Razed-linked accounts',
  unlinked: 'accounts with no Kick link',
  frozen: 'frozen accounts',
};

/** Anything not in the list falls back rather than reaching SQL. */
function pick<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    filter?: string;
    watched?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const { q } = params;
  const pageNum = Math.max(1, Number(params.page) || 1);
  const filter = pick(params.filter, FILTERS, 'all');
  const watched = pick(params.watched, WATCHED, 'any');
  const sort = pick(params.sort, SORTS, 'recent');

  // Adjusting a balance is Matty's, not a mod's — the column is simply absent
  // for anyone else rather than present and refusing.
  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const [{ members, total }, links] = await Promise.all([
    searchUsers({ query: q, filter, watched, sort, limit: PAGE, offset: (pageNum - 1) * PAGE }),
    rows<{ user_id: string; username: string; status: string }>(
      'SELECT user_id::text, username, status FROM razed_links',
    ),
  ]);

  const razedByUser = new Map(links.map((l) => [l.user_id, l]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const narrowed = filter !== 'all' || watched !== 'any' || Boolean(q?.trim());

  /** Every link out of here keeps the filter — only the page number moves. */
  const linkTo = (page: number) =>
    `/admin/users?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(filter !== 'all' ? { filter } : {}),
      ...(watched !== 'any' ? { watched } : {}),
      ...(sort !== 'recent' ? { sort } : {}),
      page: String(page),
    })}`;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {total} {FILTER_LABEL[filter]}
            {watched !== 'any' ? ` · ${watched.replace('h', ' hours')} watched or more` : ''}
          </span>
          <h1>Users</h1>
          <div className="sh-sub">
            Click a name for everything on that account — watch time, wager, coins, bets and every
            staff action against it. Balance adjustments write a normal ledger row with your name on
            it, so the total always equals the sum of the ledger.
          </div>
        </div>
      </div>

      <UserFilters q={q ?? ''} filter={filter} watched={watched} sort={sort} />

      {members.length === 0 ? (
        <div className="emptyq">
          {narrowed
            ? 'No accounts match that filter.'
            : 'No accounts yet — the list fills as people sign in.'}
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Coins</th>
                <th>Watched</th>
                <th>Wagered</th>
                <th>Kick</th>
                <th>Razed</th>
                <th>Joined</th>
                {isOwner ? <th>Balance</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const role = roleFor(member.discordId);
                const razed = razedByUser.get(String(member.id));
                const frozen = member.status === 'frozen';
                const subbed =
                  member.subActiveUntil !== null &&
                  new Date(member.subActiveUntil).getTime() > Date.now();
                return (
                  <tr key={member.id} style={frozen ? { opacity: 0.55 } : undefined}>
                    <td>
                      {/* The staff view, not the public profile: a mod clicking
                          a name is asking what this account has done, and the
                          public page is the one page that deliberately hides
                          it. It is still one click away from there. */}
                      <Link href={`/admin/users/${member.id}`}>{member.discordUsername}</Link>{' '}
                      {/* The multiplier that actually applies, never both — a
                          VIP who also subs earns 2.5×, not 4.5×. */}
                      {member.isVip ? (
                        <span className="tag gold">VIP</span>
                      ) : subbed ? (
                        <span className="tag blue">Sub</span>
                      ) : null}{' '}
                      {frozen ? <span className="tag red">Frozen</span> : null}
                    </td>
                    <td>
                      <span className={`tag ${role === 'owner' ? 'gold' : role ? 'blue' : ''}`}>
                        {role ?? 'member'}
                      </span>
                    </td>
                    <td className="g">{coins(member.balance)}</td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {member.watchMinutes > 0 ? duration(member.watchMinutes * 60) : '—'}
                    </td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {/* Null is "no approved Razed link", which is a different
                          thing from having wagered nothing under one. */}
                      {member.wagered === null ? '—' : money(member.wagered)}
                    </td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {member.kick?.kickUsername ?? '—'}
                    </td>
                    <td>
                      {razed ? (
                        <span className={`tag ${razed.status === 'approved' ? 'green' : 'warn'}`}>
                          {razed.username}
                        </span>
                      ) : (
                        <span className="tag">none</span>
                      )}
                    </td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {dateShort(member.createdAt)}
                    </td>
                    {isOwner ? (
                      <td style={{ textAlign: 'right' }}>
                        <AdjustBalance
                          userId={member.id}
                          username={member.discordUsername}
                          balance={member.balance}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          {pageNum > 1 ? (
            <Link className="btn sm" href={linkTo(pageNum - 1)}>
              ← Previous
            </Link>
          ) : null}
          <span className="small muted">
            Page {pageNum} of {pages}
          </span>
          {pageNum < pages ? (
            <Link className="btn sm" href={linkTo(pageNum + 1)}>
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Roles come from OWNER_DISCORD_IDS and MOD_DISCORD_IDS in the environment, not from this
        table — there is no way to grant yourself admin from inside the app. Watch time is counted
        from paid ticks rather than from watch coins, so a VIP&rsquo;s 2.5× multiplier does not
        inflate it. Wagered is the lifetime figure from the newest Razed snapshot and only counts
        under an approved link.
      </p>
    </>
  );
}
