import Link from 'next/link';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/player';
import { ledgerPageFor } from '@/lib/store/coins';
import { coins, relativeTime } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Coin history',
  description: 'Every coin you have earned, spent, won and lost.',
};

/** The signed-in person's own ledger, in full. */
export const dynamic = 'force-dynamic';

const PAGE = 50;

export default async function CoinHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  const { entries, total } = await ledgerPageFor(user.id, {
    limit: PAGE,
    offset: (pageNum - 1) * PAGE,
  });

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (n: number) => (n === 1 ? '/profile/coins' : `/profile/coins?page=${n}`);

  return (
    <>
      <div className="sec-head">
        <div>
          <Link href="/profile" className="eyebrow">
            ← Profile
          </Link>
          <h1>Coin history</h1>
          <div className="sh-sub">
            {total === 0
              ? 'Nothing here yet.'
              : `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'} · every coin earned, spent, won and lost.`}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="emptyq">
          {pageNum > 1 ? (
            <>
              That page is past the end of your history.{' '}
              <Link href="/profile/coins">Back to the first page</Link>.
            </>
          ) : (
            'Nothing yet. Coins arrive while you chat during a stream.'
          )}
        </div>
      ) : (
        <div className="card">
          {/* Two rows per game round — stake and payout — because a netted
              figure hides what was actually staked. */}
          <div className="tw" style={{ border: 0 }}>
            <table style={{ minWidth: 420 }}>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {entry.reason}
                      {entry.detail ? (
                        <span className="small muted"> · {entry.detail}</span>
                      ) : null}
                    </td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {relativeTime(entry.createdAt)}
                    </td>
                    <td
                      className="n"
                      style={{
                        textAlign: 'right',
                        color: entry.delta >= 0 ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      {entry.delta >= 0 ? '+' : '−'}
                      {coins(Math.abs(entry.delta))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* `entries.length` guards the pager as well as the count: a page number
          past the end has nothing to page through, and a bare "Page 9 of 2"
          under the notice below reads like a bug. */}
      {pages > 1 && entries.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
          {pageNum > 1 ? (
            <Link className="btn sm" href={href(pageNum - 1)}>
              ← Newer
            </Link>
          ) : null}
          <span className="small muted">
            Page {pageNum} of {pages}
          </span>
          {pageNum < pages ? (
            <Link className="btn sm" href={href(pageNum + 1)}>
              Older →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function SignedOut() {
  return (
    <div className="gate">
      <h1>Sign in</h1>
      <p>Your coin history is your own — sign in to see it.</p>
      <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/profile/coins">
        Sign in with Discord
      </Link>
    </div>
  );
}
