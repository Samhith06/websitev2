import Link from 'next/link';
import { rows } from '@/lib/db';
import { searchUsers } from '@/lib/store/accounts';
import { roleFor } from '@/lib/admin';
import { coins, dateShort } from '@/lib/format';

export const metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

const PAGE = 40;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  const [{ members, total }, links] = await Promise.all([
    searchUsers({ query: q, limit: PAGE, offset: (pageNum - 1) * PAGE }),
    rows<{ user_id: string; username: string; status: string }>(
      'SELECT user_id::text, username, status FROM razed_links',
    ),
  ]);

  const razedByUser = new Map(links.map((l) => [l.user_id, l]));
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{total} accounts</span>
          <h1>Users</h1>
          <div className="sh-sub">
            Balance adjustments write a normal ledger row with your name on it — balances are never
            edited directly.
          </div>
        </div>
      </div>

      <form style={{ marginBottom: 14 }}>
        <input
          className="inp"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by Discord name, Kick username or Discord id…"
          aria-label="Search users"
        />
      </form>

      {members.length === 0 ? (
        <div className="emptyq">No accounts match that search.</div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Coins</th>
                <th>Kick</th>
                <th>Razed</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const role = roleFor(member.discordId);
                const razed = razedByUser.get(String(member.id));
                const frozen = member.status === 'frozen';
                return (
                  <tr key={member.id} style={frozen ? { opacity: 0.55 } : undefined}>
                    <td>
                      <Link href={`/u/${encodeURIComponent(member.discordUsername)}`}>
                        {member.discordUsername}
                      </Link>{' '}
                      {frozen ? <span className="tag red">Frozen</span> : null}
                    </td>
                    <td>
                      <span className={`tag ${role === 'owner' ? 'gold' : role ? 'blue' : ''}`}>
                        {role ?? 'member'}
                      </span>
                    </td>
                    <td className="g">{coins(member.balance)}</td>
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
            <Link
              className="btn sm"
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(pageNum - 1) })}`}
            >
              ← Previous
            </Link>
          ) : null}
          <span className="small muted">
            Page {pageNum} of {pages}
          </span>
          {pageNum < pages ? (
            <Link
              className="btn sm"
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(pageNum + 1) })}`}
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Roles come from OWNER_DISCORD_IDS and MOD_DISCORD_IDS in the environment, not from this
        table — there is no way to grant yourself admin from inside the app.
      </p>
    </>
  );
}
